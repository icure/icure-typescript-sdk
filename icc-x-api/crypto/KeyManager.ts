import { DataOwner, DataOwnerWithType, IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { KeyPair } from './RSA'
import { ua2hex } from '../utils'
import { IcureStorageFacade } from '../storage/IcureStorageFacade'
import { BaseExchangeKeysManager } from './BaseExchangeKeysManager'
import { fingerprintToPublicKeysMapOf, loadPublicKeys } from './utils'
import { CryptoPrimitives } from './CryptoPrimitives'
import { KeyRecovery } from './KeyRecovery'
import { CryptoStrategies } from './CryptoStrategies'

type KeyPairData = { pair: KeyPair<CryptoKey>; isVerified: boolean; isDevice: boolean }
type KeyRecovererAndVerifier = (
  keysData: {
    dataOwner: DataOwner
    unknownKeys: string[]
    unavailableKeys: string[]
  }[]
) => Promise<{
  [dataOwnerId: string]: {
    recoveredKeys: { [keyPairFingerprint: string]: KeyPair<CryptoKey> }
    keyAuthenticity: { [keyPairFingerprint: string]: boolean }
  }
}>
type CurrentOwnerKeyGenerator = (self: DataOwner) => Promise<KeyPair<CryptoKey> | boolean>

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

  private selfId: string | undefined
  private selfLegacyPublicKey: string | undefined
  private keysCache: { [selfOrParentId: string]: { [pubKeyFingerprint: string]: KeyPairData } } | undefined = undefined

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
   * on this device or which have been verified using {@link CryptoStrategies} on this device.
   * @param verifiedOnly if true only the verified public keys will be returned.
   * @return the spki representation of public keys of available keypairs for the current user.
   */
  async getCurrentUserAvailablePublicKeysHex(verifiedOnly: boolean): Promise<string[]> {
    this.ensureInitialised()
    let selectedData = Object.values(this.keysCache![this.selfId!])
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
    return await Promise.all(
      Object.values(this.keysCache!)
        .flatMap((pairsForParent) => Object.values(pairsForParent))
        .map(async (keyPairData) => ua2hex(await this.primitives.RSA.exportKey(keyPairData.pair.publicKey, 'spki')))
    )
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
    const newKey = await this.doLoadKeys(
      (x) => this.strategies.recoverAndVerifySelfHierarchyKeys(x),
      (x) => this.strategies.generateNewKeyForDataOwner(x)
    )
    return newKey ? { newKeyPair: newKey.pair, newKeyFingerprint: newKey.fingerprint } : undefined
  }

  /**
   * @internal This method is intended for internal use only and may be changed without notice.
   * Forces to reload keys for the current data owner. This could be useful if the data owner has logged in from another device in order to update the
   * transfer keys.
   * This method will complete only after keys have been reloaded successfully.
   */
  async reloadKeys(): Promise<void> {
    await this.doLoadKeys(
      (x) =>
        Promise.resolve(
          x.reduce(
            (acc, { dataOwner }) => ({ ...acc, [dataOwner.id]: { recoveredKeys: {}, keyAuthenticity: {} } }),
            {} as {
              [dataOwnerId: string]: {
                recoveredKeys: { [keyPairFingerprint: string]: KeyPair<CryptoKey> }
                keyAuthenticity: { [keyPairFingerprint: string]: boolean }
              }
            }
          )
        ),
      (x) => {
        throw new Error("Can't create new keys at reload time: it should have already been created on initialisation")
      }
    )
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
    const selfKeys = this.keysCache![this.selfId!]
    const allKeysEntries = Object.entries(selfKeys)

    const legacyKeyFp = this.selfLegacyPublicKey?.slice(-32)
    const legacyKeyData = legacyKeyFp ? selfKeys[legacyKeyFp] : undefined
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
   * Get all verified keys for a member of the current data owner hierarchy in no particular order.
   * @param dataOwner the current data owner or a member of his hierarchy.
   * @throws if the provided data owner is not part of the current data owner hierarchy
   */
  async getVerifiedPublicKeysFor(dataOwner: DataOwner): Promise<string[]> {
    this.ensureInitialised()
    const availableKeys = this.keysCache![dataOwner.id!]
    if (!availableKeys) throw new Error(`Data owner ${dataOwner.id} is not part of the hierarchy of the current data owner ${this.selfId}`)
    const availableVerifiedKeysFp = new Set(Object.entries(availableKeys).flatMap(([fp, info]) => (info.isVerified || info.isDevice ? [fp] : [])))
    const otherVerifiedFp = new Set(
      Object.entries(await this.icureStorage.loadSelfVerifiedKeys(dataOwner.id)).flatMap(([fp, verified]) => (verified ? [fp] : []))
    )
    return Array.from(this.dataOwnerApi.getHexPublicKeysOf(dataOwner)).filter((key) => {
      const fp = key.slice(-32)
      return availableVerifiedKeysFp.has(fp) || otherVerifiedFp.has(fp)
    })
  }

  /**
   * @internal This method is intended for internal use only and may be changed without notice.
   * Get all key pairs for the current data owner and his parents. These keys should be used only for decryption as they may have not been verified.
   * @return all key pairs available for decryption.
   */
  getDecryptionKeys(): { [fingerprint: string]: KeyPair<CryptoKey> } {
    this.ensureInitialised()
    return Object.values(this.keysCache!).reduce((acc, curr) => {
      return {
        ...acc,
        ...this.plainKeysByFingerprint(curr),
      }
    }, {} as { [fp: string]: KeyPair<CryptoKey> })
  }

  private async doLoadKeys(
    keyRecovererAndVerifier: KeyRecovererAndVerifier,
    currentOwnerKeyGenerator: CurrentOwnerKeyGenerator
  ): Promise<{ pair: KeyPair<CryptoKey>; fingerprint: string } | undefined> {
    // Load all keys for self from key store
    const hierarchy = await this.dataOwnerApi.getCurrentDataOwnerHierarchy()
    const self = hierarchy[hierarchy.length - 1]
    this.selfId = self.dataOwner.id!
    const keysData = []
    for (const dowt of hierarchy) {
      const availableKeys = await this.loadAndRecoverKeysFor(dowt)
      const verifiedKeysMap = await this.icureStorage.loadSelfVerifiedKeys(dowt.dataOwner.id!)
      const allPublicKeys = this.dataOwnerApi.getHexPublicKeysOf(dowt.dataOwner)
      const fpToFullMap = fingerprintToPublicKeysMapOf(dowt.dataOwner)
      const unavailableKeys = Object.keys(availableKeys).flatMap((fp) => {
        const fullPublicKey = fpToFullMap[fp]
        return allPublicKeys.has(fullPublicKey) ? [] : [fullPublicKey]
      })
      const unknownKeys = Array.from(allPublicKeys).filter(
        (x) => !(x.slice(-32) in verifiedKeysMap) && !(availableKeys?.[x.slice(-32)]?.isDevice === true)
      )
      keysData.push({ dowt, availableKeys, unavailableKeys, unknownKeys })
    }
    const recoveryAndVerificationResult = await keyRecovererAndVerifier(
      keysData.map(({ dowt, unavailableKeys, unknownKeys }) => ({ dataOwner: dowt.dataOwner, unavailableKeys, unknownKeys }))
    )
    const keysCache: { [dataOwnerId: string]: { [fp: string]: KeyPairData } } = {}
    for (const keyData of keysData) {
      const currAuthenticity = this.ensureFingerprintKeys(recoveryAndVerificationResult[keyData.dowt.dataOwner.id].keyAuthenticity)
      const currExternallyRecovered = this.ensureFingerprintKeys(recoveryAndVerificationResult[keyData.dowt.dataOwner.id].recoveredKeys)
      for (const [fp, keyPair] of Object.entries(currExternallyRecovered)) {
        const jwkPair = await this.primitives.RSA.exportKeys(keyPair, 'jwk', 'jwk')
        await this.icureStorage.saveKey(keyData.dowt.dataOwner.id!, fp, jwkPair, true)
      }
      const updatedVerifiedMap = await this.icureStorage.saveSelfVerifiedKeys(
        keyData.dowt.dataOwner.id!,
        [...Object.keys(currAuthenticity), ...Object.keys(currExternallyRecovered)].reduce(
          (acc, currFp) => ({
            ...acc,
            [currFp]: currFp in currExternallyRecovered || currAuthenticity[currFp],
          }),
          {}
        )
      )
      const keysWithExternallyRecovered = {
        ...keyData.availableKeys,
        ...Object.fromEntries(Object.entries(currExternallyRecovered).map(([k, v]) => [k, { pair: v, isDevice: false }])),
      }
      const additionallyRecovered = await this.recoverAndCacheKeys(keyData.dowt, this.plainKeysByFingerprint(keysWithExternallyRecovered))
      const keys = {
        ...keysWithExternallyRecovered,
        ...Object.fromEntries(Object.entries(additionallyRecovered).map(([k, v]) => [k, { pair: v, isDevice: false }])),
      }
      keysCache[keyData.dowt.dataOwner.id!] = this.verifyKeys(keys, updatedVerifiedMap)
    }
    if (Object.entries(keysCache).some(([ownerId, data]) => ownerId !== self.dataOwner.id && !this.hasVerifiedKey(data))) {
      throw new Error('Some parent hcps have no verified keys: impossible to generate locally a new key for a parent.')
    } else if (this.hasVerifiedKey(keysCache[self.dataOwner.id])) {
      this.keysCache = keysCache
      this.selfLegacyPublicKey = self.dataOwner.publicKey
      return undefined
    } else {
      const whatToDo = await currentOwnerKeyGenerator(self.dataOwner)
      if (whatToDo === false) {
        throw new Error(`No verified key found for ${self.dataOwner.id} and settings do not allow creation of a new key.`)
      } else {
        const updateInfo = await this.createAndSaveNewKeyPair(whatToDo === true ? undefined : whatToDo, self)
        // self may be outdated now
        this.selfLegacyPublicKey = updateInfo.updatedSelf.dataOwner.publicKey
        this.keysCache = {
          ...keysCache,
          [self.dataOwner.id!]: {
            ...keysCache[self.dataOwner.id],
            [updateInfo.publicKeyFingerprint]: { pair: updateInfo.keyPair, isDevice: true, isVerified: true },
          },
        }
        return { pair: updateInfo.keyPair, fingerprint: updateInfo.publicKeyFingerprint }
      }
    }
  }

  private async createAndSaveNewKeyPair(
    importedKeyPair: undefined | KeyPair<CryptoKey>,
    selfDataOwner: DataOwnerWithType
  ): Promise<{ publicKeyFingerprint: string; keyPair: KeyPair<CryptoKey>; updatedSelf: DataOwnerWithType }> {
    const keyPair = importedKeyPair ?? (await this.primitives.RSA.generateKeyPair())
    const publicKeyHex = ua2hex(await this.primitives.RSA.exportKey(keyPair.publicKey, 'spki'))
    const publicKeyFingerprint = publicKeyHex.slice(-32)
    await this.icureStorage.saveKey(
      selfDataOwner.dataOwner.id!,
      publicKeyFingerprint,
      await this.primitives.RSA.exportKeys(keyPair, 'jwk', 'jwk'),
      true
    )
    const verifiedPublicKeysMap = await this.icureStorage.saveSelfVerifiedKeys(selfDataOwner.dataOwner.id!, { [publicKeyFingerprint]: true })
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

  private verifyKeys(
    keys: { [pubKeyFingerprint: string]: { pair: KeyPair<CryptoKey>; isDevice: boolean } },
    verifiedKeysMap: { [pubKeyFingerprint: string]: boolean }
  ): { [pubKeyFingerprint: string]: KeyPairData } {
    return Object.fromEntries(
      Object.entries(keys).map(
        ([fp, keyData]) => [fp, { ...keyData, isVerified: keyData.isDevice || verifiedKeysMap?.[fp] === true }] as [string, KeyPairData]
      )
    )
  }

  private plainKeysByFingerprint(richKeys: { [pubKeyFingerprint: string]: { pair: KeyPair<CryptoKey> } }): {
    [pubKeyFingerprint: string]: KeyPair<CryptoKey>
  } {
    return Object.fromEntries(Object.entries(richKeys).map(([fp, keyData]) => [fp, keyData.pair]))
  }

  private ensureInitialised() {
    if (!this.keysCache) throw new Error('Key manager was not properly initialised')
  }

  private async recoverAndCacheKeys(
    dataOwner: DataOwnerWithType,
    availableKeys: { [pubKeyFingerprint: string]: KeyPair<CryptoKey> }
  ): Promise<{ [p: string]: KeyPair<CryptoKey> }> {
    const recoveredKeys = await this.keyRecovery.recoverKeys(dataOwner, availableKeys)
    for (const [fp, pair] of Object.entries(recoveredKeys)) {
      await this.icureStorage.saveKey(dataOwner.dataOwner.id!, fp, await this.primitives.RSA.exportKeys(pair, 'jwk', 'jwk'), false)
    }
    return recoveredKeys
  }

  private async loadAndRecoverKeysFor(dataOwner: DataOwnerWithType): Promise<{ [keyFp: string]: { pair: KeyPair<CryptoKey>; isDevice: boolean } }> {
    const selfPublicKeys = this.dataOwnerApi.getHexPublicKeysOf(dataOwner.dataOwner)
    const pubKeysFingerprints = Array.from(selfPublicKeys).map((x) => x.slice(-32))
    const loadedKeys = pubKeysFingerprints.length > 0 ? await this.loadStoredKeys(dataOwner, pubKeysFingerprints) : {}
    const loadedKeysFingerprints = Object.keys(loadedKeys)
    if (loadedKeysFingerprints.length !== pubKeysFingerprints.length && loadedKeysFingerprints.length > 0) {
      const recoveredKeys = await this.recoverAndCacheKeys(dataOwner, this.plainKeysByFingerprint(loadedKeys))
      for (const [fp, pair] of Object.entries(recoveredKeys)) {
        loadedKeys[fp] = { pair, isDevice: false }
      }
    }
    return loadedKeys
  }

  private ensureFingerprintKeys<T>(obj: { [shouldBeFingerprint: string]: T }): { [definitelyFingerprint: string]: T } {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.slice(-32), v]))
  }

  private hasVerifiedKey(keysData: { [fp: string]: KeyPairData }) {
    return Object.values(keysData).some((x) => x.isVerified || x.isDevice)
  }
}
