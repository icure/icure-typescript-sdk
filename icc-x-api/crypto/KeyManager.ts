import { DataOwnerWithType, IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { KeyPair, RSAUtils } from './RSA'
import { ua2hex } from '../utils'
import { TransferKeysManager } from './TransferKeysManager'
import { IcureStorageFacade } from '../storage/IcureStorageFacade'
import { BaseExchangeKeysManager } from './BaseExchangeKeysManager'
import { keysIn } from 'lodash'

type KeyPairData = { pair: KeyPair<CryptoKey>; isVerified: boolean; isDevice: boolean }

/**
 * @internal This class is intended only for internal use and may be changed without notice.
 */
export class KeyManager {
  private readonly RSA: RSAUtils
  private readonly dataOwnerApi: IccDataOwnerXApi
  private readonly transferKeysManager: TransferKeysManager
  private readonly icureStorage: IcureStorageFacade
  private readonly baseExchangeKeyManager: BaseExchangeKeysManager

  private selfLegacyPublicKey: string | undefined
  private keys: Promise<{ [pubKeyFingerprint: string]: KeyPairData }> = Promise.reject('Key manager was not initialised properly')

  constructor(
    RSA: RSAUtils,
    dataOwnerApi: IccDataOwnerXApi,
    icureStorage: IcureStorageFacade,
    transferKeysManager: TransferKeysManager,
    baseExchangeKeyManager: BaseExchangeKeysManager
  ) {
    this.RSA = RSA
    this.icureStorage = icureStorage
    this.dataOwnerApi = dataOwnerApi
    this.transferKeysManager = transferKeysManager
    this.baseExchangeKeyManager = baseExchangeKeyManager
  }

  /**
   * Initializes all keys for the current data owner. This method needs to be called before any other method of this class can be used.
   * If no keys already exist for the current data owner or if none of the existing keys are available in the key storage then depending on the value
   * of {@link createNewKeyIfMissing}:
   * - If true a new key will be automatically created, then returned by this method.
   * - If false the method will fail with a predefined error.
   * - If it throws an error the method will propagate the error.
   * @param createNewKeyIfMissing if there is no key for the user and this is true the method will automatically create a new keypair for the user,
   * else the method will throw an exception.
   * @throws if the current user is not a data owner, or if there is no key and {@link createNewKeyIfMissing} is false.
   * @return the newly created key if no key could be loaded and {@link createNewKeyIfMissing} is true.
   */
  async initialiseKeys(
    createNewKeyIfMissing: (() => Promise<boolean>) | boolean
  ): Promise<{ newKeyPair: KeyPair<CryptoKey>; newKeyFingerprint: string } | undefined> {
    const loadTask = this.doLoadKeys(await this.dataOwnerApi.getCurrentDataOwner(), createNewKeyIfMissing)
    this.keys = loadTask.then(({ loadedKeys }) => loadedKeys)
    await this.keys
    return loadTask.then(({ newKey }) => (newKey ? { newKeyPair: newKey.pair, newKeyFingerprint: newKey.fingerprint } : undefined))
  }

  /**
   * Forces to reload keys for the current data owner. This could be useful if the data owner has logged in from another device in order to update the
   * transfer keys.
   */
  async reloadKeys(): Promise<void> {
    const loadTask = this.doLoadKeys(await this.dataOwnerApi.getCurrentDataOwner(), () => {
      throw "Can't create new keys at reload time: it should have already been created on initialisation"
    })
    this.keys = loadTask.then(({ loadedKeys }) => loadedKeys)
    await this.keys
  }

  /**
   * Get all verified key pairs for the current data owner (does not include keys reachable through transfer keys), which can safely be used for
   * encryption.
   * The keys returned by this method will be in the following order:
   * 1. Legacy public key if it is verified
   * 2. All device public keys, in alphabetical order according to the fingerprint
   * 3. All other verified keys, in alphabetical order according to the fingerprint
   * @return all verified keys, in order.
   */
  async getSelfVerifiedKeys(): Promise<{ fingerprint: string; pair: KeyPair<CryptoKey> }[]> {
    const allKeys = await this.keys
    const allKeysEntries = Object.entries(allKeys)

    const legacyKeyFp = this.selfLegacyPublicKey?.slice(-32)
    const legacyKeyData = legacyKeyFp ? allKeys[legacyKeyFp] : undefined
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

  // Get all keys.

  // Get specific key.

  // Get favored key.

  private async doLoadKeys(
    self: DataOwnerWithType,
    createNewKeyIfMissing: boolean | (() => Promise<boolean>)
  ): Promise<{
    loadedKeys: { [pubKeyFingerprint: string]: KeyPairData }
    newKey?: { pair: KeyPair<CryptoKey>; fingerprint: string }
  }> {
    // Load all keys for self from key store
    const selfPublicKeys = this.dataOwnerApi.getHexPublicKeysOf(self)
    const pubKeysFingerprints = Array.from(selfPublicKeys).map((x) => x.slice(-32))
    const verifiedKeysMap = await this.icureStorage.loadSelfVerifiedKeys(self.dataOwner.id!)
    const loadedStoredKeys: { [pubKeyFingerprint: string]: KeyPairData } =
      pubKeysFingerprints.length > 0 ? await this.loadKeysFromStorage(self, pubKeysFingerprints, verifiedKeysMap) : {}
    const loadedStoredKeysFingerprints = Object.keys(loadedStoredKeys)
    if (loadedStoredKeysFingerprints.length == 0) {
      if (createNewKeyIfMissing === true || (createNewKeyIfMissing !== false && (await createNewKeyIfMissing()))) {
        // No key existed or no key in store -> create new key
        const keysInfo = await this.createAndSaveNewKeyPair(self, verifiedKeysMap) // Self is outdated now
        this.selfLegacyPublicKey = keysInfo.updatedSelf.dataOwner.publicKey
        return {
          loadedKeys: { [keysInfo.publicKeyFingerprint]: { pair: keysInfo.keyPair, isVerified: true, isDevice: true } },
          newKey: { pair: keysInfo.keyPair, fingerprint: keysInfo.publicKeyFingerprint },
        }
      } else {
        throw `No key found for ${self.dataOwner.id} and settings do not allow creation of a new key.`
      }
    } else {
      this.selfLegacyPublicKey = self.dataOwner.publicKey
      if (loadedStoredKeysFingerprints.length != pubKeysFingerprints.length) {
        // Load also transfer keys
        const loadedTransferKeys = await this.transferKeysManager.loadSelfKeysFromTransfer(self, this.plainKeysByFingerprint(loadedStoredKeys))
        for (const [fp, pair] of Object.entries(loadedTransferKeys)) {
          loadedStoredKeys[fp] = { pair, isDevice: false, isVerified: verifiedKeysMap?.[fp] === true }
          await this.icureStorage.saveKey(self.dataOwner.id!, fp, await this.RSA.exportKeys(pair, 'jwk', 'jwk'), false)
        }
      }
      return { loadedKeys: loadedStoredKeys }
    }
  }

  private async createAndSaveNewKeyPair(
    self: DataOwnerWithType,
    verifiedPublicKeysMap: { [p: string]: boolean }
  ): Promise<{ publicKeyFingerprint: string; keyPair: KeyPair<CryptoKey>; updatedSelf: DataOwnerWithType }> {
    const generatedKeypair = await this.RSA.generateKeyPair()
    const publicKeyHex = ua2hex(await this.RSA.exportKey(generatedKeypair.publicKey, 'spki'))
    const publicKeyFingerprint = publicKeyHex.slice(-32)
    await this.icureStorage.saveKey(self.dataOwner.id!, publicKeyFingerprint, await this.RSA.exportKeys(generatedKeypair, 'jwk', 'jwk'), true)
    const { updatedDelegator } = await this.baseExchangeKeyManager.createOrUpdateEncryptedExchangeKeyFor(
      self.dataOwner.id!,
      self.dataOwner.id!,
      generatedKeypair,
      Array.from(this.dataOwnerApi.getHexPublicKeysOf(self)).filter((x) => verifiedPublicKeysMap[x.slice(-32)])
    )
    return { publicKeyFingerprint, keyPair: generatedKeypair, updatedSelf: updatedDelegator }
  }

  private async loadKeysFromStorage(
    self: DataOwnerWithType,
    pubKeysFingerprints: string[],
    verifiedKeys: { [keyFingerprint: string]: boolean }
  ): Promise<{ [pubKeyFingerprint: string]: KeyPairData }> {
    return pubKeysFingerprints.reduce(async (acc, currentFingerprint) => {
      const awaitedAcc = await acc
      let loadedPair: { pair: KeyPair<CryptoKey>; isDevice: boolean } | undefined = undefined
      try {
        const storedKeypair = await this.icureStorage.loadKey(self.dataOwner.id!, currentFingerprint)
        if (storedKeypair) {
          const importedKey = await this.RSA.importKeyPair('jwk', storedKeypair.pair.privateKey, 'jwk', storedKeypair.pair.publicKey)
          loadedPair = { pair: importedKey, isDevice: storedKeypair.isDevice }
        }
      } catch (e) {
        console.warn('Error while loading keypair', currentFingerprint, e)
      }
      // Make sure that if for some reason the key is missing we still have proper boolean values in loaded map
      const isVerified = verifiedKeys?.[currentFingerprint] === true
      return loadedPair
        ? {
            ...awaitedAcc,
            [currentFingerprint]: { ...loadedPair, isVerified },
          }
        : awaitedAcc
    }, Promise.resolve({} as { [pubKeyFingerprint: string]: KeyPairData }))
  }

  private plainKeysByFingerprint(richKeys: { [pubKeyFingerprint: string]: KeyPairData }): { [pubKeyFingerprint: string]: KeyPair<CryptoKey> } {
    const res: { [pubKeyFingerprint: string]: KeyPair<CryptoKey> } = {}
    Object.entries(richKeys).forEach(([fp, keyData]) => {
      res[fp] = keyData.pair
    })
    return res
  }
}
