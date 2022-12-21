import { DataOwnerWithType, IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { KeyPair } from './RSA'
import { ua2hex } from '../utils'
import { IcureStorageFacade } from '../storage/IcureStorageFacade'
import { BaseExchangeKeysManager } from './BaseExchangeKeysManager'
import { HealthcareParty } from '../../icc-api/model/HealthcareParty'
import { fingerprintToPublicKeysMapOf, loadPublicKeys } from './utils'
import { CryptoPrimitives } from './CryptoPrimitives'
import { KeyRecovery } from './KeyRecovery'
import { CryptoStrategies } from './CryptoStrategies'

type KeyPairData = { pair: KeyPair<CryptoKey>; isVerified: boolean; isDevice: boolean }

/**
 * Allows to manage public and private keys for the current user and his parent hierarchy.
 */
export class KeyManager {
  private readonly primitives: CryptoPrimitives
  private readonly dataOwnerApi: IccDataOwnerXApi
  private readonly keyRecovery: KeyRecovery
  private readonly icureStorage: IcureStorageFacade
  private readonly baseExchangeKeyManager: BaseExchangeKeysManager
  private readonly strategies: CryptoStrategies

  private selfLegacyPublicKey: string | undefined
  private selfKeys: { [pubKeyFingerprint: string]: KeyPairData } | undefined = undefined
  private parentKeys: { [parentId: string]: { [pubKeyFingerprint: string]: KeyPair<CryptoKey> } } | undefined = undefined

  constructor(
    primitives: CryptoPrimitives,
    dataOwnerApi: IccDataOwnerXApi,
    icureStorage: IcureStorageFacade,
    keyRecovery: KeyRecovery,
    baseExchangeKeyManager: BaseExchangeKeysManager,
    strategies: CryptoStrategies
  ) {
    this.primitives = primitives
    this.icureStorage = icureStorage
    this.dataOwnerApi = dataOwnerApi
    this.keyRecovery = keyRecovery
    this.baseExchangeKeyManager = baseExchangeKeyManager
    this.strategies = strategies
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
   * Get a key pair with the provided fingerprint if present.
   * @param fingerprint a key-pair/public-key fingerprint
   * @return the pair associated to the fingerprint and a boolean indicating if the pair is verified, if present, else undefined
   */
  getKeyPairForFingerprint(fingerprint: string): { pair: KeyPair<CryptoKey>; verified: boolean } | undefined {
    const foundVerified = this.getSelfVerifiedKeys().find((x) => x.fingerprint === fingerprint)
    if (foundVerified) return { pair: foundVerified.pair, verified: true }
    const foundOther = this.getDecryptionKeys()[fingerprint]
    if (foundOther) return { pair: foundOther, verified: false }
    return undefined
  }

  /**
   * @internal This method is intended for internal use only and may be changed without notice.
   * Initializes all keys for the current data owner. This method needs to be called before any other method of this class can be used.
   * @throws if the current user is not a data owner, or if there is no key and no new key could be created according to this manager crypt
   * strategies.
   * @return if a new key was created during initialisation the newly created key, else undefined.
   */
  async initialiseKeys(): Promise<{ newKeyPair: KeyPair<CryptoKey>; newKeyFingerprint: string } | undefined> {
    const self = await this.dataOwnerApi.getCurrentDataOwner()
    const loadedData = await this.doLoadKeys(self, true, () => this.strategies.createNewKeyPairIfNoVerifiedKeysFound())
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
      throw new Error("Can't create new keys at reload time: it should have already been created on initialisation")
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
    needsVerification: Boolean,
    createNewKeyIfMissing: () => Promise<boolean | KeyPair<CryptoKey>>
  ): Promise<{
    loadedKeys: { [pubKeyFingerprint: string]: KeyPairData }
    newKey?: { pair: KeyPair<CryptoKey>; fingerprint: string }
  }> {
    // Load all keys for self from key store
    const selfPublicKeys = this.dataOwnerApi.getHexPublicKeysOf(dataOwner.dataOwner)
    const pubKeysFingerprints = Array.from(selfPublicKeys).map((x) => x.slice(-32))
    const loadedKeys = pubKeysFingerprints.length > 0 ? await this.loadStoredKeys(dataOwner, pubKeysFingerprints) : {}
    const loadedKeysFingerprints = Object.keys(loadedKeys)
    this.selfLegacyPublicKey = dataOwner.dataOwner.publicKey
    if (loadedKeysFingerprints.length !== pubKeysFingerprints.length && loadedKeysFingerprints.length > 0) {
      // Try to recover existing keys.
      const recoveredKeys = this.keyRecovery.recoverKeys(dataOwner, this.plainKeysByFingerprint(loadedKeys))
      for (const [fp, pair] of Object.entries(recoveredKeys)) {
        loadedKeys[fp] = { pair, isDevice: false }
        await this.icureStorage.saveKey(dataOwner.dataOwner.id!, fp, await this.primitives.RSA.exportKeys(pair, 'jwk', 'jwk'), false)
      }
    }
    if (!needsVerification) return { loadedKeys: this.verifyKeys(loadedKeys, {}) }
    const verifiedKeysMap = await this.loadAndUpdateVerifiedKeysMap(loadedKeys, dataOwner)
    const verifiedKeys = this.verifyKeys(loadedKeys, verifiedKeysMap)
    if (Object.values(verifiedKeys).some((keyData) => keyData.isVerified || keyData.isDevice)) {
      return { loadedKeys: verifiedKeys }
    } else {
      // No verified key could be loaded (could happen for example if we recovered a key through shamir but can't verify it)
      const whatToDo = await createNewKeyIfMissing()
      if (whatToDo === false) {
        throw new Error(`No verified key found for ${dataOwner.dataOwner.id} and settings do not allow creation of a new key.`)
      } else {
        const updateInfo = await this.createAndSavePotentiallyNewKeyPair(whatToDo === true ? undefined : whatToDo, dataOwner, verifiedKeysMap) // dataOwner may be outdated now
        this.selfLegacyPublicKey = updateInfo.updatedSelf.dataOwner.publicKey
        return {
          loadedKeys: {
            ...verifiedKeys,
            [updateInfo.publicKeyFingerprint]: { pair: updateInfo.keyPair, isVerified: true, isDevice: whatToDo === true },
          },
          newKey: { pair: updateInfo.keyPair, fingerprint: updateInfo.publicKeyFingerprint },
        }
      }
    }
  }

  private async createAndSavePotentiallyNewKeyPair(
    importedKeyPair: undefined | KeyPair<CryptoKey>,
    selfDataOwner: DataOwnerWithType,
    verifiedPublicKeysMap: { [p: string]: boolean }
  ): Promise<{ publicKeyFingerprint: string; keyPair: KeyPair<CryptoKey>; updatedSelf: DataOwnerWithType }> {
    const keyPair = importedKeyPair ?? (await this.primitives.RSA.generateKeyPair())
    const publicKeyHex = ua2hex(await this.primitives.RSA.exportKey(keyPair.publicKey, 'spki'))
    const publicKeyFingerprint = publicKeyHex.slice(-32)
    await this.icureStorage.saveKey(
      selfDataOwner.dataOwner.id!,
      publicKeyFingerprint,
      await this.primitives.RSA.exportKeys(keyPair, 'jwk', 'jwk'),
      !importedKeyPair
    )
    await this.icureStorage.saveSelfVerifiedKeys(selfDataOwner.dataOwner.id!, { [publicKeyFingerprint]: true })
    const { updatedDelegator } = await this.baseExchangeKeyManager.createOrUpdateEncryptedExchangeKeyTo(
      selfDataOwner.dataOwner.id!,
      keyPair,
      await loadPublicKeys(
        this.primitives.RSA,
        Array.from(this.dataOwnerApi.getHexPublicKeysOf(selfDataOwner.dataOwner)).filter((x) => verifiedPublicKeysMap[x.slice(-32)])
      )
    )
    return { publicKeyFingerprint, keyPair: keyPair, updatedSelf: updatedDelegator }
  }

  private async loadStoredKeys(
    dataOwner: DataOwnerWithType,
    pubKeysFingerprints: string[]
  ): Promise<{ [pubKeyFingerprint: string]: { pair: KeyPair<CryptoKey>; isDevice: boolean } }> {
    return await pubKeysFingerprints.reduce(async (acc, currentFingerprint) => {
      const awaitedAcc = await acc
      let loadedPair: { pair: KeyPair<CryptoKey>; isDevice: boolean } | undefined = undefined
      try {
        const storedKeypair = await this.icureStorage.loadKey(dataOwner.dataOwner.id!, currentFingerprint, dataOwner.dataOwner.publicKey)
        if (storedKeypair) {
          const importedKey = await this.primitives.RSA.importKeyPair('jwk', storedKeypair.pair.privateKey, 'jwk', storedKeypair.pair.publicKey)
          loadedPair = { pair: importedKey, isDevice: storedKeypair.isDevice }
        }
      } catch (e) {
        console.warn('Error while loading keypair', currentFingerprint, e)
      }
      return loadedPair
        ? {
            ...awaitedAcc,
            [currentFingerprint]: loadedPair,
          }
        : awaitedAcc
    }, Promise.resolve({} as { [pubKeyFingerprint: string]: { pair: KeyPair<CryptoKey>; isDevice: boolean } }))
  }

  private async loadParentKeys(self: DataOwnerWithType): Promise<void> {
    let currId = (self.dataOwner as HealthcareParty).parentId
    const res: { [parentId: string]: { [pubKeyFingerprint: string]: KeyPair<CryptoKey> } } = {}
    while (currId) {
      const curr = await this.dataOwnerApi.getDataOwner(currId)
      res[currId] = this.plainKeysByFingerprint((await this.doLoadKeys(curr, false, () => Promise.resolve(false))).loadedKeys)
      currId = (curr.dataOwner as HealthcareParty).parentId
    }
    this.parentKeys = res
  }

  private async loadAndUpdateVerifiedKeysMap(
    loadedKeys: { [fingerprint: string]: { pair: KeyPair<CryptoKey>; isDevice: boolean } },
    dataOwner: DataOwnerWithType
  ): Promise<{ [pubKeyFingerprint: string]: boolean }> {
    const cached = await this.icureStorage.loadSelfVerifiedKeys(dataOwner.dataOwner.id!)
    const cachedKeys = new Set(Object.keys(cached).map((x) => x.slice(-32)))
    const loadedKeysDevice = new Set(
      Object.entries(loadedKeys)
        .filter(([_, x]) => x.isDevice)
        .map(([x]) => x.slice(-32))
    )
    const unknownKeys = Array.from(this.dataOwnerApi.getHexPublicKeysOf(dataOwner.dataOwner)).filter((key) => {
      const fp = key.slice(-32)
      return !(cachedKeys.has(fp) || loadedKeysDevice.has(fp))
    })
    const strategyVerified = await this.strategies.verifyOwnPublicKeys(dataOwner.dataOwner, unknownKeys)
    const merged = Object.fromEntries([
      ...Object.entries(strategyVerified).map(([k, v]) => [k.slice(-32), v]),
      ...Array.from(loadedKeysDevice).map((fp) => [fp, true]),
    ])
    await this.icureStorage.saveSelfVerifiedKeys(dataOwner.dataOwner.id!, merged)
    return await this.icureStorage.loadSelfVerifiedKeys(dataOwner.dataOwner.id!)
  }

  private verifyKeys(
    keys: { [pubKeyFingerprint: string]: { pair: KeyPair<CryptoKey>; isDevice: boolean } },
    verifiedKeysMap: { [pubKeyFingerprint: string]: boolean }
  ): { [pubKeyFingerprint: string]: KeyPairData } {
    return Object.fromEntries(
      Object.entries(keys).map(([fp, keyData]) => [fp, { ...keyData, isVerified: verifiedKeysMap?.[fp] === true }] as [string, KeyPairData])
    )
  }

  private plainKeysByFingerprint(richKeys: { [pubKeyFingerprint: string]: { pair: KeyPair<CryptoKey> } }): {
    [pubKeyFingerprint: string]: KeyPair<CryptoKey>
  } {
    return Object.fromEntries(Object.entries(richKeys).map(([fp, keyData]) => [fp, keyData.pair]))
  }

  private ensureInitialised() {
    if (!this.parentKeys || !this.selfKeys) throw new Error('Key manager was not properly initialised')
  }
}
