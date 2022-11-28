import { KeyStorageFacade } from '../storage/KeyStorageFacade'
import { StorageEntryKeysFactory } from '../storage/StorageEntryKeysFactory'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { KeyPair, RSAUtils } from './RSA'
import { ua2hex } from '../utils'
import { TransferKeysManager } from './TransferKeysManager'

/**
 * @internal This class is intended only for internal use and may be changed without notice.
 */
export class KeyManager {
  private readonly RSA: RSAUtils
  private readonly dataOwnerApi: IccDataOwnerXApi
  private readonly keyStorage: KeyStorageFacade
  private readonly storageEntryKeysFactory: StorageEntryKeysFactory
  private readonly transferKeysManager: TransferKeysManager

  private keys: { [pubKeyFingerprint: string]: { pair: KeyPair<CryptoKey>; isDevice: boolean } } | undefined

  constructor(
    RSA: RSAUtils,
    dataOwnerApi: IccDataOwnerXApi,
    keyStorage: KeyStorageFacade,
    storageEntryKeysFactory: StorageEntryKeysFactory,
    transferKeysManager: TransferKeysManager
  ) {
    this.RSA = RSA
    this.keyStorage = keyStorage
    this.storageEntryKeysFactory = storageEntryKeysFactory
    this.dataOwnerApi = dataOwnerApi
    this.transferKeysManager = transferKeysManager
  }

  // TODO automatically create new key should be optional
  /**
   * @internal This method is intended only for internal use and may be changed without notice.
   * Initializes all keys for the current data owner. This method needs to be called before any other method of this class can be used.
   * If no keys already exist for the current data owner or if none of the existing keys are available in the key storage then a new key will be
   * automatically created, then returned by this method.
   * @throws if the current user is not a data owner.
   * @return the newly created key if no key could be loaded.
   */
  async initialiseKeys(): Promise<{ newKeyPair: KeyPair<CryptoKey>; newKeyFingerprint: string } | undefined> {
    const loaded = await this.loadKeys()
    this.keys = loaded.loadedKeys
    return loaded.newKey ? { newKeyPair: loaded.newKey.pair, newKeyFingerprint: loaded.newKey.fingerprint } : undefined
  }

  /**
   * Get all key pairs stored on this device (does not include keys reachable through transfer keys).
   * There should be only one key stored on the device, but this method could return multiple keys for retro-compatibility.
   * If no transfer keys were manually stored in the key storage as if they were normal device keys all the keys returned by this method should be
   * trustworthy.
   * This means the keys are valid candidates for being part of a new transfer key (see also {@link TransferKeysManager.updateTransferKeys}).
   */
  getDeviceKeys(): { [pubKeyFingerprint: string]: KeyPair<CryptoKey> } {
    const res: { [pubKeyFingerprint: string]: KeyPair<CryptoKey> } = {}
    Object.entries(this.getKeys())
      .sort(([a], [b]) => {
        // need to make sure that the comparison is independent of the locale, but the actual ordering is not that important
        return a == b ? 0 : a > b ? 1 : -1
      })
      .forEach(([fp, { pair }]) => {
        res[fp] = pair
      })
    return res
  }

  // Get all keys.

  // Get specific key.

  // Get favored key.

  private async loadKeys(): Promise<{
    loadedKeys: { [pubKeyFingerprint: string]: { pair: KeyPair<CryptoKey>; isDevice: boolean } }
    newKey?: { pair: KeyPair<CryptoKey>; fingerprint: string }
  }> {
    // Load all keys for self from key store
    const self = await this.dataOwnerApi.getCurrentDataOwner()
    const selfPublicKeys = this.dataOwnerApi.getHexPublicKeysOf(self)
    const pubKeysFingerprints = Array.from(selfPublicKeys).map((x) => x.slice(-32))
    const loadedStoredKeys: { [pubKeyFingerprint: string]: KeyPair<CryptoKey> } =
      pubKeysFingerprints.length > 0 ? await this.loadKeysFromStorage(pubKeysFingerprints) : {}
    const loadedStoredKeysFingerprints = Object.keys(loadedStoredKeys)
    if (loadedStoredKeysFingerprints.length == 0) {
      // No key existed or no key in store -> create new key
      const keysInfo = await this.createAndSaveNewKeyPair()
      return {
        loadedKeys: { [keysInfo.publicKeyFingerprint]: { pair: keysInfo.keyPair, isDevice: true } },
        newKey: { pair: keysInfo.keyPair, fingerprint: keysInfo.publicKeyFingerprint },
      }
    } else {
      const loadedKeys: { [pubKeyFingerprint: string]: { pair: KeyPair<CryptoKey>; isDevice: boolean } } = {}
      Object.entries(loadedStoredKeys).forEach(([fp, pair]) => {
        loadedKeys[fp] = { pair, isDevice: true }
      })
      if (loadedStoredKeysFingerprints.length != pubKeysFingerprints.length) {
        // Load also transfer keys
        const loadedTransferKeys = await this.transferKeysManager.loadSelfKeysFromTransfer(loadedStoredKeys)
        Object.entries(loadedTransferKeys).forEach(([fp, pair]) => {
          loadedKeys[fp] = { pair, isDevice: false }
        })
        // For security reasons loaded transfer keys should not be stored in local storage.
        // TODO actually it would be fine to store transfer keys in local storage, as long as we can distinguish them from keys created on the device.
      }
      return { loadedKeys }
    }
  }

  private async createAndSaveNewKeyPair(): Promise<{ publicKeyFingerprint: string; keyPair: KeyPair<CryptoKey> }> {
    const self = await this.dataOwnerApi.getCurrentDataOwner()
    const generatedKeypair = await this.RSA.generateKeyPair()
    const publicKeyHex = ua2hex(await this.RSA.exportKey(generatedKeypair.publicKey, 'spki'))
    const publicKeyFingerprint = publicKeyHex.slice(-32)
    await this.keyStorage.storeKeyPair(
      this.storageEntryKeysFactory.entryKeyForDataOwnerKeypair(self.dataOwner.id!, publicKeyFingerprint),
      await this.RSA.exportKeys(generatedKeypair, 'jwk', 'jwk')
    )
    const updatedSelf = {
      ...self.dataOwner,
      aesExchangeKeys: {
        ...(self.dataOwner.aesExchangeKeys ?? {}),
        [publicKeyHex]: {}, // This is definitely a new key
      },
    }
    await this.dataOwnerApi.updateDataOwner({ type: self.type, dataOwner: updatedSelf })
    return { publicKeyFingerprint, keyPair: generatedKeypair }
  }

  private async loadKeysFromStorage(pubKeysFingerprints: string[]): Promise<{ [pubKeyFingerprint: string]: KeyPair<CryptoKey> }> {
    const self = await this.dataOwnerApi.getCurrentDataOwner()
    return pubKeysFingerprints.reduce(async (acc, currentFingerprint) => {
      const awaitedAcc = await acc
      let loadedPair: KeyPair<CryptoKey> | undefined = undefined
      try {
        const storageKey = this.storageEntryKeysFactory.entryKeyForDataOwnerKeypair(self.dataOwner.id!, currentFingerprint)
        const storedKeypair = await this.keyStorage.getKeypair(storageKey)
        if (storedKeypair != undefined) {
          loadedPair = await this.RSA.importKeyPair('jwk', storedKeypair.privateKey, 'jwk', storedKeypair.publicKey)
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
    }, Promise.resolve({} as { [pubKeyFingerprint: string]: KeyPair<CryptoKey> }))
  }

  private getKeys() {
    if (!this.keys) throw "Key manager was not properly initialised and can't be used,"
    return this.keys
  }
}
