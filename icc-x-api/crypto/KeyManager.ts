import { DataOwner, DataOwnerWithType, IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { KeyPair, RSAUtils } from './RSA'
import { ua2hex } from '../utils'
import { TransferKeysManager } from './TransferKeysManager'
import { IcureStorageFacade } from '../storage/IcureStorageFacade'
import { BaseExchangeKeysManager } from './BaseExchangeKeysManager'
import { HealthcareParty } from '../../icc-api/model/HealthcareParty'
import { loadPublicKeys } from './utils'
import { CryptoPrimitives } from './CryptoPrimitives'

type KeyPairData = { pair: KeyPair<CryptoKey>; isVerified: boolean; isDevice: boolean }

/**
 * Allows to manage public and private keys for the current user and his parent hierarchy.
 */
export class KeyManager {
  private readonly primitives: CryptoPrimitives
  private readonly dataOwnerApi: IccDataOwnerXApi
  private readonly transferKeysManager: TransferKeysManager
  private readonly icureStorage: IcureStorageFacade
  private readonly baseExchangeKeyManager: BaseExchangeKeysManager

  private selfLegacyPublicKey: string | undefined
  private selfKeys: { [pubKeyFingerprint: string]: KeyPairData } | undefined = undefined
  private parentKeys: { [parentId: string]: { [pubKeyFingerprint: string]: KeyPair<CryptoKey> } } | undefined = undefined

  constructor(
    primitives: CryptoPrimitives,
    dataOwnerApi: IccDataOwnerXApi,
    icureStorage: IcureStorageFacade,
    transferKeysManager: TransferKeysManager,
    baseExchangeKeyManager: BaseExchangeKeysManager
  ) {
    this.primitives = primitives
    this.icureStorage = icureStorage
    this.dataOwnerApi = dataOwnerApi
    this.transferKeysManager = transferKeysManager
    this.baseExchangeKeyManager = baseExchangeKeyManager
  }

  /**
   * Get the public keys of available key pairs for the current user in hex-encoded spki representation (uses cached keys: no request is done to the
   * server).
   * By setting {@link verifiedOnly} to true only the public keys for verified key pairs will be returned: these will include only key pairs created
   * on this device or which have been verified using a {@link PublicKeyVerifier} on this device.
   * @param verifiedOnly if true only the verified public keys will be returned.
   * @return the spki representation of public keys of available keypairs for the current user.
   */
  async getCurrentUserAvailablePublicKeysHex(verifiedOnly: boolean): Promise<string[]> {
    this.ensureInitialised()
    let selectedData = Object.values(this.selfKeys!)
    if (verifiedOnly) {
      selectedData = selectedData.filter((data) => data.isVerified || data.isDevice)
    }
    return await Promise.all(selectedData.map(async (keyData) => ua2hex(await this.primitives.RSA.exportKey(keyData.pair.publicKey, 'spki'))))
  }

  /**
   * Get the public keys of available key pairs for the current user and his parents in hex-encoded spki representation (uses cached keys: no request
   * is done to the server).
   * Note that this will also include unverified keys.
   * @return the spki representation of public keys of available keypairs for the current user.
   */
  async getCurrentUserHierarchyAvailablePublicKeysHex(): Promise<string[]> {
    return [
      ...(await this.getCurrentUserAvailablePublicKeysHex(false)),
      ...(await Promise.all(
        Object.values(this.parentKeys!)
          .flatMap((pairsForParent) => Object.values(pairsForParent))
          .map(async (pair) => ua2hex(await this.primitives.RSA.exportKey(pair.publicKey, 'spki')))
      )),
    ]
  }

  /**
   * @internal This method is intended for internal use only and may be changed without notice.
   * Initializes all keys for the current data owner. This method needs to be called before any other method of this class can be used.
   * If no device or verified keys are available the current data owner, the behaviour of this method depends on the value of
   * {@link createNewKeyIfMissing}:
   * - If true or returns true a new (device) key will be automatically created, then returned by this method.
   * - If false or returns false the method will fail with a predefined error.
   * - If it throws an error the method will propagate the error.
   * @param createNewKeyIfMissing if there is no key for the user and this is true the method will automatically create a new keypair for the user,
   * else the method will throw an exception.
   * @throws if the current user is not a data owner, or if there is no key and {@link createNewKeyIfMissing} is false.
   * @return the newly created key if no key could be loaded and {@link createNewKeyIfMissing} is true.
   */
  async initialiseKeys(
    createNewKeyIfMissing: (() => Promise<boolean>) | boolean
  ): Promise<{ newKeyPair: KeyPair<CryptoKey>; newKeyFingerprint: string } | undefined> {
    const self = await this.dataOwnerApi.getCurrentDataOwner()
    const loadedData = await this.doLoadKeys(self, true, createNewKeyIfMissing)
    this.selfKeys = loadedData.loadedKeys
    await this.loadParentKeys(self)
    return loadedData.newKey ? { newKeyPair: loadedData.newKey.pair, newKeyFingerprint: loadedData.newKey.fingerprint } : undefined
  }

  /**
   * @internal This method is intended for internal use only and may be changed without notice.
   * Forces to reload keys for the current data owner. This could be useful if the data owner has logged in from another device in order to update the
   * transfer keys.
   * This method will complete only after keys have been reloaded successfully.
   */
  async reloadKeys(): Promise<void> {
    const self = await this.dataOwnerApi.getCurrentDataOwner()
    this.selfKeys = await this.doLoadKeys(self, true, () => {
      throw "Can't create new keys at reload time: it should have already been created on initialisation"
    }).then(({ loadedKeys }) => loadedKeys)
    await this.loadParentKeys(self)
  }

  /**
   * @internal This method is intended for internal use only and may be changed without notice.
   * Get all verified key pairs for the current data owner which can safely be used for encryption. This includes all key pairs created on the current
   * device and all recovered key pairs which have been verified.
   * The keys returned by this method will be in the following order:
   * 1. Legacy key pair if it is verified
   * 2. All device key pais, in alphabetical order according to the fingerprint
   * 3. Other verified key pairs, in alphabetical order according to the fingerprint
   * @return all verified keys, in order.
   */
  getSelfVerifiedKeys(): { fingerprint: string; pair: KeyPair<CryptoKey> }[] {
    this.ensureInitialised()
    const allKeysEntries = Object.entries(this.selfKeys!)

    const legacyKeyFp = this.selfLegacyPublicKey?.slice(-32)
    const legacyKeyData = legacyKeyFp ? this.selfKeys![legacyKeyFp] : undefined
    const legacyEntry = legacyKeyData?.isVerified && legacyKeyFp ? [{ fingerprint: legacyKeyFp, pair: legacyKeyData.pair }] : []

    function filteredEntries(filterFunction: (fp: string, data: KeyPairData) => boolean) {
      return allKeysEntries
        .filter(([fp, data]) => filterFunction(fp, data) && fp !== legacyKeyFp)
        .sort(([a], [b]) => {
          // need to make sure that the comparison is independent of the locale, but the actual ordering is not that important
          return a == b ? 0 : a > b ? 1 : -1
        })
        .map(([fingerprint, { pair }]) => ({ fingerprint, pair }))
    }
    return [...legacyEntry, ...filteredEntries((_, data) => data.isDevice), ...filteredEntries((_, data) => !data.isDevice && data.isVerified)]
  }

  /**
   * @internal This method is intended for internal use only and may be changed without notice.
   * Get all key pairs for the current data owner and his parents. These keys should be used only for decryption as they may have not been verified.
   * @return all key pairs available for decryption.
   */
  getDecryptionKeys(): { [fingerprint: string]: KeyPair<CryptoKey> } {
    this.ensureInitialised()
    return Object.values(this.parentKeys!).reduce((acc, curr) => {
      return {
        ...acc,
        ...curr,
      }
    }, this.plainKeysByFingerprint(this.selfKeys!))
  }

  private async doLoadKeys(
    dataOwner: DataOwnerWithType,
    failIfNoVerifiedKey: Boolean,
    createNewKeyIfMissing: boolean | (() => Promise<boolean>)
  ): Promise<{
    loadedKeys: { [pubKeyFingerprint: string]: KeyPairData }
    newKey?: { pair: KeyPair<CryptoKey>; fingerprint: string }
  }> {
    // Load all keys for self from key store
    const selfPublicKeys = this.dataOwnerApi.getHexPublicKeysOf(dataOwner)
    const pubKeysFingerprints = Array.from(selfPublicKeys).map((x) => x.slice(-32))
    const verifiedKeysMap = await this.icureStorage.loadSelfVerifiedKeys(dataOwner.dataOwner.id!)
    const loadedStoredKeys: { [pubKeyFingerprint: string]: KeyPairData } =
      pubKeysFingerprints.length > 0 ? await this.loadKeysFromStorage(dataOwner, pubKeysFingerprints, verifiedKeysMap) : {}
    const loadedStoredKeysFingerprints = Object.keys(loadedStoredKeys)
    if (Object.values(loadedStoredKeys).some((keyData) => keyData.isVerified || keyData.isDevice)) {
      this.selfLegacyPublicKey = dataOwner.dataOwner.publicKey
      if (loadedStoredKeysFingerprints.length != pubKeysFingerprints.length) {
        // Load also transfer keys
        const loadedTransferKeys = await this.transferKeysManager.loadSelfKeysFromTransfer(dataOwner, this.plainKeysByFingerprint(loadedStoredKeys))
        for (const [fp, pair] of Object.entries(loadedTransferKeys)) {
          loadedStoredKeys[fp] = { pair, isDevice: false, isVerified: verifiedKeysMap?.[fp] === true }
          await this.icureStorage.saveKey(dataOwner.dataOwner.id!, fp, await this.primitives.RSA.exportKeys(pair, 'jwk', 'jwk'), false)
        }
      }
      return { loadedKeys: loadedStoredKeys }
    } else if (createNewKeyIfMissing === true || (createNewKeyIfMissing !== false && (await createNewKeyIfMissing()))) {
      // No verified key could be loaded (could happen if we recovered a key through shamir but can't verify it)
      const updateInfo = await this.createAndSaveNewKeyPair(dataOwner, verifiedKeysMap) // dataOwner is outdated now
      this.selfLegacyPublicKey = updateInfo.updatedSelf.dataOwner.publicKey
      return {
        loadedKeys: {
          ...loadedStoredKeys,
          [updateInfo.publicKeyFingerprint]: { pair: updateInfo.keyPair, isVerified: true, isDevice: true },
        },
        newKey: { pair: updateInfo.keyPair, fingerprint: updateInfo.publicKeyFingerprint },
      }
    } else if (failIfNoVerifiedKey) {
      throw `No verified key found for ${dataOwner.dataOwner.id} and settings do not allow creation of a new key.`
    } else {
      return { loadedKeys: loadedStoredKeys }
    }
  }

  private async createAndSaveNewKeyPair(
    dataOwner: DataOwnerWithType,
    verifiedPublicKeysMap: { [p: string]: boolean }
  ): Promise<{ publicKeyFingerprint: string; keyPair: KeyPair<CryptoKey>; updatedSelf: DataOwnerWithType }> {
    const generatedKeypair = await this.primitives.RSA.generateKeyPair()
    const publicKeyHex = ua2hex(await this.primitives.RSA.exportKey(generatedKeypair.publicKey, 'spki'))
    const publicKeyFingerprint = publicKeyHex.slice(-32)
    await this.icureStorage.saveKey(
      dataOwner.dataOwner.id!,
      publicKeyFingerprint,
      await this.primitives.RSA.exportKeys(generatedKeypair, 'jwk', 'jwk'),
      true
    )
    const { updatedDelegator } = await this.baseExchangeKeyManager.createOrUpdateEncryptedExchangeKeyFor(
      dataOwner.dataOwner.id!,
      dataOwner.dataOwner.id!,
      generatedKeypair,
      await loadPublicKeys(
        this.primitives.RSA,
        Array.from(this.dataOwnerApi.getHexPublicKeysOf(dataOwner)).filter((x) => verifiedPublicKeysMap[x.slice(-32)])
      )
    )
    return { publicKeyFingerprint, keyPair: generatedKeypair, updatedSelf: updatedDelegator }
  }

  private async loadKeysFromStorage(
    dataOwner: DataOwnerWithType,
    pubKeysFingerprints: string[],
    verifiedKeys: { [keyFingerprint: string]: boolean }
  ): Promise<{ [pubKeyFingerprint: string]: KeyPairData }> {
    return pubKeysFingerprints.reduce(async (acc, currentFingerprint) => {
      const awaitedAcc = await acc
      let loadedPair: { pair: KeyPair<CryptoKey>; isDevice: boolean } | undefined = undefined
      try {
        const storedKeypair = await this.icureStorage.loadKey(dataOwner.dataOwner.id!, currentFingerprint)
        if (storedKeypair) {
          const importedKey = await this.primitives.RSA.importKeyPair('jwk', storedKeypair.pair.privateKey, 'jwk', storedKeypair.pair.publicKey)
          loadedPair = { pair: importedKey, isDevice: storedKeypair.isDevice }
        }
      } catch (e) {
        console.warn('Error while loading keypair', currentFingerprint, e)
      }
      // Make sure that if for some reason the key is missing we still have proper boolean values in loaded map
      const isVerified = loadedPair?.isDevice || verifiedKeys?.[currentFingerprint] === true
      return loadedPair
        ? {
            ...awaitedAcc,
            [currentFingerprint]: { ...loadedPair, isVerified },
          }
        : awaitedAcc
    }, Promise.resolve({} as { [pubKeyFingerprint: string]: KeyPairData }))
  }

  private async loadParentKeys(self: DataOwnerWithType): Promise<void> {
    let currId = (self.dataOwner as HealthcareParty).parentId
    const res: { [parentId: string]: { [pubKeyFingerprint: string]: KeyPair<CryptoKey> } } = {}
    while (currId) {
      const curr = await this.dataOwnerApi.getDataOwner(currId)
      res[currId] = this.plainKeysByFingerprint((await this.doLoadKeys(curr, false, false)).loadedKeys)
      currId = (curr.dataOwner as HealthcareParty).parentId
    }
    this.parentKeys = res
  }

  private plainKeysByFingerprint(richKeys: { [pubKeyFingerprint: string]: KeyPairData }): { [pubKeyFingerprint: string]: KeyPair<CryptoKey> } {
    return Object.fromEntries(Object.entries(richKeys).map(([fp, keyData]) => [fp, keyData.pair]))
  }

  private ensureInitialised() {
    if (!this.parentKeys || !this.selfKeys) throw 'Key manager was not properly initialised'
  }
}
