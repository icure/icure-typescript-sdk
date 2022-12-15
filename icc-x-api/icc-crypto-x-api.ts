/* eslint-disable */
import { IccDeviceApi, IccHcpartyApi, IccPatientApi } from '../icc-api'
import { AESUtils } from './crypto/AES'
import { KeyPair, RSAUtils } from './crypto/RSA'
import { ShamirClass } from './crypto/shamir'

import * as _ from 'lodash'
import {
  Delegation,
  Device,
  Document,
  EncryptedEntity,
  EncryptedParentEntity,
  HealthcareParty,
  MaintenanceTask,
  Patient,
  PropertyStub,
  PropertyTypeStub,
  TypedValueObject,
  User,
} from '../icc-api/model/models'
import { b2a, b64_2uas, hex2ua, string2ua, ua2hex, ua2string, ua2utf8, utf8_2ua } from './utils/binary-utils'
import { fold, foldAsync, jwk2spki, keyPairFromPrivateKeyJwk, notConcurrent, pkcs8ToJwk, spkiToJwk } from './utils'
import { IccMaintenanceTaskXApi } from './icc-maintenance-task-x-api'
import { StorageFacade } from './storage/StorageFacade'
import { KeyStorageFacade } from './storage/KeyStorageFacade'
import { ExchangeKeysManager } from './crypto/ExchangeKeysManager'
import { CryptoPrimitives } from './crypto/CryptoPrimitives'
import { KeyManager } from './crypto/KeyManager'
import { DataOwner, IccDataOwnerXApi } from './icc-data-owner-x-api'
import { EntitiesEncryption } from './crypto/EntitiesEncryption'
import { IcureStorageFacade } from './storage/IcureStorageFacade'
import { ShamirKeysManager } from './crypto/ShamirKeysManager'

interface DelegatorAndKeys {
  delegatorId: string
  key: CryptoKey
  rawKey: string
}

type CachedDataOwner =
  | {
      type: 'patient'
      dataOwner: Patient
    }
  | {
      type: 'device'
      dataOwner: Device
    }
  | {
      type: 'hcp'
      dataOwner: HealthcareParty
    }

export class IccCryptoXApi {
  private readonly exchangeKeysManager: ExchangeKeysManager
  private readonly cryptoPrimitives: CryptoPrimitives
  private readonly keyManager: KeyManager
  private readonly dataOwnerApi: IccDataOwnerXApi
  private readonly entitiesEncrypiton: EntitiesEncryption
  private readonly icureStorage: IcureStorageFacade
  private readonly shamirManager: ShamirKeysManager

  get primitives(): CryptoPrimitives {
    return this.cryptoPrimitives
  }

  /**
   * @internal this method is for internal use only and may be changed without notice.
   */
  get exchangeKeys(): ExchangeKeysManager {
    return this.exchangeKeysManager
  }

  /**
   * @deprecated replace with {@link CryptoPrimitives.crypto} at {@link primitives}.
   */
  get crypto(): Crypto {
    return this.cryptoPrimitives.crypto
  }

  /**
   * @deprecated replace with {@link CryptoPrimitives.shamir} at {@link primitives}.
   */
  get shamir(): ShamirClass {
    return this.cryptoPrimitives.shamir
  }

  /**
   * @deprecated replace with {@link CryptoPrimitives.RSA} at {@link primitives}.
   */
  get RSA(): RSAUtils {
    return this.cryptoPrimitives.RSA
  }

  /**
   * @deprecated replace with {@link CryptoPrimitives.AES} at {@link primitives}.
   */
  get AES(): AESUtils {
    return this.cryptoPrimitives.AES
  }

  get keyStorage(): KeyStorageFacade {
    return this._keyStorage
  }

  get storage(): StorageFacade<string> {
    return this._storage
  }

  get entities(): EntitiesEncryption {
    return this.entitiesEncrypiton
  }

  get userKeysManager(): KeyManager {
    return this.keyManager
  }

  get shamirKeysManager(): ShamirKeysManager {
    return this.shamirKeysManager
  }

  hcPartyKeysCache: {
    [key: string]: DelegatorAndKeys
  } = {}

  //[delegateId][delegatorId] = delegateEncryptedHcPartyKey
  //for each delegate, it stores the list of delegators and the corresponding delegateEncryptedHcPartyKey (shared HcPartyKey, from delegator to delegate, encrypted with the RSA key of the delegate)
  hcPartyKeysRequestsCache: {
    [delegateId: string]: Promise<{
      [delegatorId: string]: { [delegatorPublicKeyFingerprint: string]: { [recipientPublicKeyFingerprint: string]: string } }
    }>
  } = {}

  cacheLastDeletionTimestamp: number | undefined = undefined

  dataOwnerCache: { [key: string]: Promise<CachedDataOwner> } = {}

  /**
   * @deprecated depending on your use case you should delete the calls to this method or call {@link forceReload}:
   * 1. Replace with `forceReload(true)` if one of the following parts of the current data owner may have been modified from a different api instance:
   *   - Hcp hierarchy
   *   - Key recovery data (transfer keys or shamir)
   *   - Exchange keys (formerly hcp keys) where the current data owner IS THE DELEGATOR.
   * 2. Replace with `forceReload(false)` if you just want to force the api to look for new exchange keys where the current data owner IS NOT THE
   *    DELEGATOR.
   * 3. Remove the call if the main goal was to force reload the data owner: data owner are not cached anymore.
   */
  emptyHcpCache(hcpartyId: string) {
    this.exchangeKeysManager.clearCache(false)
  }

  /**
   * Deletes values cached by the crypto api, to allow to detect changes in available exchange keys and private keys.
   * The method always fully clears the cache of exchange keys from any data owner which is not the current data owner. Additionally, by setting the
   * {@link reloadForExternalChangesToCurrentDataOwner} parameter to true the method will also clear the cache of private keys for the current data
   * owner and exchange keys where the current data owner is the delegator. Normally this should not be necessary because any changes performed by
   * this instance of the api are automatically cached, but if the data owner has logged in from another device as well the changes will be
   * undetected.
   * @param reloadForExternalChangesToCurrentDataOwner true if the cache should be cleared in a way that allows detecting also external changes to the
   * current data owner.
   */
  async forceReload(reloadForExternalChangesToCurrentDataOwner: boolean) {
    this.exchangeKeysManager.clearCache(reloadForExternalChangesToCurrentDataOwner)
    if (reloadForExternalChangesToCurrentDataOwner) {
      this.dataOwnerApi.clearCurrentDataOwnerIdsCache()
      await this.keyManager.reloadKeys()
    }
  }

  /**
   * Gets all delegate encrypted HcParty keys of the delegate with the given `delegateHcPartyId`, and for each key the delegator id
   * If the keys are not cached, they are retrieved from the backend.
   *
   * @param delegateHcPartyId The Health Care Party id
   * @returns  \{delegatorId: delegateEncryptedHcPartyKey\}
   */
  private getEncryptedAesExchangeKeysForDelegate(
    delegateHcPartyId: string
  ): Promise<{ [key: string]: { [key: string]: { [key: string]: string } } }> {
    return (
      this.hcPartyKeysRequestsCache[delegateHcPartyId] ||
      (this.hcPartyKeysRequestsCache[delegateHcPartyId] = this.forceGetEncryptedAesExchangeKeysForDelegate(delegateHcPartyId))
    )
  }

  private forceGetEncryptedAesExchangeKeysForDelegate(
    delegateHcPartyId: string
  ): Promise<{ [key: string]: { [key: string]: { [key: string]: string } } }> {
    return Promise.all([
      this.patientBaseApi.getPatientAesExchangeKeysForDelegate(delegateHcPartyId).catch(() => {}),
      this.hcpartyBaseApi.getAesExchangeKeysForDelegate(delegateHcPartyId).catch(() => {}),
      this.deviceBaseApi.getDeviceAesExchangeKeysForDelegate(delegateHcPartyId).catch(() => {}),
    ]).then(([a, b, c]) => ({ ...a, ...b, ...c }))
  }

  keychainLocalStoreIdPrefix = 'org.taktik.icure.ehealth.keychain.'
  keychainValidityDateLocalStoreIdPrefix = 'org.taktik.icure.ehealth.keychain-date.'
  hcpPreferenceKeyEhealthCert = 'eHealthCRTCrypt'
  hcpPreferenceKeyEhealthCertDate = 'eHealthCRTDate'
  rsaLocalStoreIdPrefix = 'org.taktik.icure.rsa.'

  private hcpartyBaseApi: IccHcpartyApi
  private patientBaseApi: IccPatientApi
  private deviceBaseApi: IccDeviceApi
  private readonly _crypto: Crypto

  private generateKeyConcurrencyMap: { [key: string]: PromiseLike<HealthcareParty | Patient> }
  private rsaKeyPairs: { [pubKeyFingerprint: string]: { publicKey: CryptoKey; privateKey: CryptoKey } } = {}

  private readonly _AES: AESUtils
  private readonly _RSA: RSAUtils
  private readonly _shamir: ShamirClass
  private readonly _storage: StorageFacade<string>
  private readonly _keyStorage: KeyStorageFacade

  constructor(
    host: string,
    headers: { [key: string]: string },
    hcpartyBaseApi: IccHcpartyApi, //Init with a hcparty x api for better performances
    patientBaseApi: IccPatientApi,
    deviceBaseApi: IccDeviceApi,
    crypto: Crypto = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : ({} as Crypto),
    storage: StorageFacade<string>,
    keyStorage: KeyStorageFacade
  ) {
    this.hcpartyBaseApi = hcpartyBaseApi
    this.patientBaseApi = patientBaseApi
    this.deviceBaseApi = deviceBaseApi
    this._crypto = crypto
    this.generateKeyConcurrencyMap = {}

    this._AES = new AESUtils(crypto)
    this._RSA = new RSAUtils(crypto)
    this._shamir = new ShamirClass(crypto)
    this._storage = storage
    this._keyStorage = keyStorage
  }

  private async loadAllKeysFromLocalStorage(dataOwnerId: string): Promise<void> {
    const pubKeys = await this.getDataOwnerHexPublicKeys((await this.getDataOwner(dataOwnerId)).dataOwner)

    for (const pk of pubKeys) {
      const fingerprint = pk.slice(-32)
      if (!this.rsaKeyPairs[fingerprint]) {
        await this.cacheKeyPair((await this.loadKeyPairNotImported(dataOwnerId, fingerprint))!)
      }
    }
  }

  /**
   * @deprecated you should not need this method anymore to deal with the encryption of iCure entities because everything related to entities
   * encryption should be done either through the entity-specific extended api or through the {@link EntitiesEncryption} object available at
   * {@link entities}.
   * Note that keys returned by the current implementation of this method may not be safe for encryption/sharing.
   * If instead you are using this method to retrieve key pairs for other purposes, for example because you want to reuse the user keys in iCure for
   * other services consider the following alternatives:
   * - If you want to use all iCure facilities including key recovery and key verification you can use {@link KeyManager.getKeyPairForFingerprint}.
   *   Note that this solution can only give access to keys for the data owner of the instantiated api and his parents.
   * - Alternatively you can use directly your choice of {@link KeyStorageFacade} and {@link StorageEntryKeysFactory}: if these are the same you use
   *   for the iCure API client the keys will be shared with it. Note however that the iCure api client uses
   *   {@link StorageEntryKeysFactory.cachedRecoveredKeypairOfDataOwner} to cache recovered keys of a data owner which may not have originated from
   *   this device, so you should only use {@link StorageEntryKeysFactory.deviceKeypairOfDataOwner} if you want to make sure the keys you use are safe
   *   for encryption.
   */
  async getCachedRsaKeyPairForFingerprint(
    dataOwnerId: string,
    pubKeyOrFingerprint: string
  ): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
    const fingerprint = pubKeyOrFingerprint.slice(-32)
    const res = this.keyManager.getDecryptionKeys()[fingerprint]
    if (!res) console.warn(`Could not find any keypair for fingerprint ${fingerprint}`)
    return res
  }

  /**
   * @deprecated You have different options to replace this method, depending on what you actually need. All options return the hex-encoded spki
   * representation of the public keys.
   * - If you want only the public keys for which we have a private key available
   *   - you can replicate the current behaviour using {@link KeyManager.getCurrentUserHierarchyAvailablePublicKeysHex} (the key manager is available
   *     at {@link userKeysManager}). This includes keys for the current user and his parents.
   *   - use {@link KeyManager.getCurrentUserAvailablePublicKeysHex} to get public keys only for the current data owner, ignoring any keys of the
   *     parent hierarchy. In this case you can also apply a filter to only get verified keys (safe for encryption).
   * - If you need all public keys for the data owner, including those for which there is no corresponding private key available on the device use
   *   {@link IccDataOwnerXApi.getHexPublicKeysOf} with the current data owner. If you don't have it available you may get it from
   *   {@link IccDataOwnerXApi.getCurrentDataOwner}, but this will require to do a request to the iCure server (other options use only cached data).
   */
  async getPublicKeys(): Promise<string[]> {
    return this.userKeysManager.getCurrentUserHierarchyAvailablePublicKeysHex()
  }

  private async getPublicKeysAsSpki(): Promise<string[]> {
    return await Object.values(this.rsaKeyPairs).reduce(async (p, rsa) => {
      return (await p).concat([ua2hex(await this.RSA.exportKey(rsa.publicKey, 'spki'))])
    }, Promise.resolve([] as string[]))
  }

  /**
   * @deprecated replace with {@link CryptoPrimitives.randomUuid} at {@link primitives}.
   */
  randomUuid() {
    return this.primitives.randomUuid()
  }

  /**
   * @deprecated replace with {@link CryptoPrimitives.sha256} at {@link primitives}.
   */
  sha256(data: ArrayBuffer | Uint8Array) {
    return this.primitives.sha256(data)
  }

  /**
   * @deprecated Use {@link ShamirKeysManager.updateSelfSplits} from {@link shamirKeysManager} instead. Note that the new method completely replaces
   * all current values if a split for the provided key already exists.
   */
  encryptShamirRSAKey(hcp: HealthcareParty, notaries: Array<HealthcareParty>, threshold?: number): Promise<HealthcareParty> {
    return this.loadKeyPairImported(hcp.id!).then((keyPair) =>
      this._RSA.exportKey(keyPair.privateKey, 'pkcs8').then(async (exportedKey) => {
        const privateKey = exportedKey as ArrayBuffer
        const nLen = notaries.length
        const shares = nLen == 1 ? [privateKey] : this._shamir.share(ua2hex(privateKey), nLen, threshold || nLen).map((share) => hex2ua(share))
        const publicKeys = await this.getPublicKeys()

        return _.reduce(
          notaries,
          (queue, notary, idx) => {
            return queue.then(async (hcp) => {
              const { owner: hcParty, aesExchangeKeys } = await this.getOrCreateHcPartyKeys(hcp, notary.id!)
              const [publicKeyIdentifier, hcPartyKeys] = Object.entries(aesExchangeKeys)[0]

              try {
                const importedAESHcPartyKey = await this.decryptHcPartyKey(
                  notary.id!,
                  hcParty.id!,
                  notary.id!,
                  publicKeyIdentifier,
                  hcPartyKeys,
                  publicKeys
                )
                const encryptedShamirPartition = await this.AES.encrypt(importedAESHcPartyKey.key, shares[idx])

                hcParty.privateKeyShamirPartitions = hcParty.privateKeyShamirPartitions || {}
                hcParty.privateKeyShamirPartitions[notary.id!] = ua2hex(encryptedShamirPartition)
              } catch (e) {
                console.log('Error during encryptedShamirRSAKey', notary.id, e)
              }
              return hcParty
            })
          },
          Promise.resolve(hcp)
        )
      })
    )
  }

  /**
   * @deprecated You should not need this method anymore because the api will automatically try to recover the available shamir keys on startup.
   */
  async decryptShamirRSAKey(hcp: HealthcareParty, notaries: Array<HealthcareParty>): Promise<void> {
    try {
      const publicKeys = await this.getPublicKeys()
      const nLen = notaries.length
      let decryptedPrivatedKey
      if (nLen == 1) {
        const notaryHcPartyId = notaries[0].id!
        const encryptedAesKeyMap = await this.getEncryptedAesExchangeKeys(hcp, notaryHcPartyId)
        const importedAESHcPartyKey = await Promise.all(
          Object.entries(encryptedAesKeyMap).map(
            async ([idPubKey, keysMap]) => await this.decryptHcPartyKey(notaryHcPartyId, hcp.id!, notaryHcPartyId, idPubKey, keysMap, publicKeys)
          )
        )
        const cryptedPrivatedKey = hcp.privateKeyShamirPartitions![notaryHcPartyId]
        decryptedPrivatedKey = ua2hex(
          await this.AES.decryptSome(
            importedAESHcPartyKey.map((k) => k.key),
            hex2ua(cryptedPrivatedKey)
          )
        )
      } else {
        const decryptedShares: string[] = await _.reduce(
          notaries,
          (queue, notary) => {
            return queue.then(async (shares: string[]) => {
              try {
                // now, we get the encrypted shares in db and decrypt them. This assumes that the
                // the notaries' private keys are in localstorage. We should implement a way for the notaries to
                // give hcp the decrypted shares without having to also share their private keys.
                const encryptedAesKeyMap = await this.getEncryptedAesExchangeKeys(hcp, notary.id!)
                const importedAESHcPartyKey = await Promise.all(
                  Object.entries(encryptedAesKeyMap).map(
                    async ([idPubKey, keysMap]) => await this.decryptHcPartyKey(notary.id!, hcp.id!, notary.id!, idPubKey, keysMap, publicKeys)
                  )
                )
                const encryptedShare = hcp.privateKeyShamirPartitions![notary.id!]
                const decryptedShamirPartition = ua2hex(
                  await this.AES.decryptSome(
                    importedAESHcPartyKey.map((k) => k.key),
                    hex2ua(encryptedShare)
                  )
                )
                shares.push(decryptedShamirPartition)
              } catch (e) {
                console.log('Error during encryptedShamirRSAKey', notary.id, e)
              }
              return shares
            })
          },
          Promise.resolve([] as string[])
        )

        decryptedPrivatedKey = this._shamir.combine(decryptedShares)
      }

      const importedPrivateKey = await this._RSA.importKey('pkcs8', hex2ua(decryptedPrivatedKey), ['decrypt'])
      const importedPublicKey = await this._RSA.importKey('spki', hex2ua(hcp.publicKey!), ['encrypt'])

      const exportedKeyPair = await this._RSA.exportKeys({ publicKey: importedPublicKey, privateKey: importedPrivateKey }, 'jwk', 'jwk')
      await this._keyStorage.storeKeyPair(`${this.rsaLocalStoreIdPrefix}${hcp.id!}`, exportedKeyPair)
    } catch (e) {
      console.log('Cannot decrypt shamir RSA key')
    }
  }

  /**
   * @deprecated you should not need this method anymore because everything related to entities encryption should be done either through the
   * entity-specific extended api or through the {@link EntitiesEncryption} object available at {@link entities}. Please contact us if you have a
   * scenario where you really need to get the exchange keys for the user.
   * Note that currently this method does not cache results anymore (but the updated methods do).
   */
  async decryptHcPartyKey(
    loggedHcPartyId: string,
    delegatorId: string,
    delegateHcPartyId: string,
    publicKey: string,
    encryptedHcPartyKeys: { [key: string]: string },
    publicKeys: string[]
  ): Promise<DelegatorAndKeys> {
    if (publicKeys.length) {
      const reason = `Cannot decrypt RSA encrypted AES HcPartyKey from ${delegatorId} to ${delegateHcPartyId}: no public key`
      console.warn(reason)
      throw new Error(reason)
    }
    const keysFpSet = new Set(publicKeys.map((x) => x.slice(-32)))
    const filteredKeys = Object.fromEntries(Object.entries(this.keyManager.getDecryptionKeys()).filter(([fp]) => keysFpSet.has(fp)))
    const decrypted = await this.exchangeKeysManager.base.tryDecryptExchangeKeys([encryptedHcPartyKeys], filteredKeys)
    const res = decrypted.successfulDecryptions[0]
    if (!res) {
      const error =
        `Cannot decrypt RSA encrypted AES HcPartyKey from ${delegatorId} to ${delegateHcPartyId}: impossible to decrypt. ` +
        'No private key was found or could be used to decrypt the aes exchange keys`'
      console.warn(error)
      throw new Error(error)
    }
    return {
      delegatorId,
      key: res,
      rawKey: ua2hex(await this.primitives.AES.exportKey(res, 'raw')),
    }
  }

  /**
   * @deprecated you should not need this method anymore. The new API will automatically load on startup all keys available through the key storage
   * facade and/or recoverable through transfer keys or shamir split. If no verified key (safe for encryption) can be found during the instantiation
   * of the API, depending on the parameters passed to the factory one of two scenarios will happen:
   * - A new key will be automatically created on the device and stored using the key storage facade.
   * - The api instantiation fails with an exception. This is ideal if you want to try to recover an existing key pair before creating a new one.
   *
   * If you were using this method to allow the user to recover an existing key that is not available in the storage facade nor recoverable through
   * transfer keys or shamir split (for example by scanning a qr code, or by loading a file from the computer to the web browser's local storage)
   * you will have to:
   * - add it to the {@link KeyStorageFacade} using a key from {@link StorageEntryKeysFactory.deviceKeypairOfDataOwner} to make the key available as
   *   if it was created on this device (therefore safe for encryption), or
   * - add it to the {@link KeyStorageFacade} using a key from {@link StorageEntryKeysFactory.cachedRecoveredKeypairOfDataOwner}. The key in this case
   *   won't be considered safe for encryption, but it will be available for decryption.
   * Note that if you want to do this when the API is already instantiated you need to call `this.forceReload(true)` ({@link forceReload}) to use the
   * new key.
   *
   * It is currently not allowed to create new key pairs if a verified key pair is already available on the device, as this would be wasteful. If you
   * think you have a use case where this is necessary please contact us.
   *
   * If you want to convert a `JsonWebKey` pair to a `CryptoKey` pair you should use directly the method in `primitives.RSA`.
   */
  async cacheKeyPair(keyPairInJwk: KeyPair<JsonWebKey>): Promise<KeyPair<CryptoKey>> {
    const cryptoKeyPair = await this.primitives.RSA.importKeyPair('jwk', keyPairInJwk.privateKey, 'jwk', keyPairInJwk.publicKey)
    const pubHex = ua2hex(await this.primitives.RSA.exportKey(cryptoKeyPair.publicKey, 'spki'))
    const fingerprint = pubHex.slice(-32)
    if (!this.keyManager.getDecryptionKeys()[fingerprint]) {
      const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
      const selfKeys = this.dataOwnerApi.getHexPublicKeysOf(await this.dataOwnerApi.getCurrentDataOwner())
      if (!selfKeys.has(pubHex)) {
        throw `Impossible to add key pair with fingerprint ${fingerprint} to data owner ${selfId}: the data owner has no matching public key`
      }
      await this.icureStorage.saveKey(selfId, fingerprint, keyPairInJwk, true)
      // Force reload to check if more private keys can be recovered or more exchange keys become available.
      await this.forceReload(true)
    }
    return cryptoKeyPair
  }

  /**
   * TODO should be in medispring api
   * Gets the secret ID (SFKs) that should be used in the prescribed context (confidential or not) from decrypted SPKs of the given `parent`, decrypted by the HcP with the given `hcpartyId` AND by its HcP parents
   * @param parent :the object of which delegations (SPKs) to decrypt
   * @param hcpartyId :the id of the delegate HcP
   * @param confidential :weather the key is going to be used for a confidential piece or data or not
   * @returns - **extractedKeys** array containing secret IDs (SFKs) from decrypted SPKs, from both given HcP and its parents ; can contain duplicates
   * - **hcpartyId** the given `hcpartyId` OR, if a parent exist, the HcP id of the top parent in the hierarchy  (even if that parent has no delegations)
   */
  async extractPreferredSfk(parent: EncryptedParentEntity, hcpartyId: string, confidential: boolean) {
    const secretForeignKeys = await this.extractSFKsHierarchyFromDelegations(parent, hcpartyId)
    const keys = secretForeignKeys
      .filter(({ extractedKeys }) => extractedKeys.length > 0)
      .filter((x, idx) => (confidential ? x.hcpartyId === hcpartyId : idx === 0))[0]

    return (
      (keys &&
        (confidential
          ? keys.extractedKeys.find(
              (k) => !secretForeignKeys.some(({ extractedKeys, hcpartyId: parentHcpId }) => hcpartyId !== parentHcpId && extractedKeys.includes(k))
            )
          : keys.extractedKeys[0])) ||
      undefined
    )
  }

  /**
   * @deprecated you should not need this method anymore because everything related to entities encryption should be done either through the
   * entity-specific extended api or through the {@link EntitiesEncryption} object available at {@link entities}. Please contact us if you have a
   * scenario where you really need to get the exchange keys for the user.
   */
  async decryptAndImportAesHcPartyKeysForDelegators(
    delegatorsHcPartyIdsSet: Array<string>,
    delegateHcPartyId: string,
    minCacheDurationInSeconds: number = 60
  ): Promise<Array<DelegatorAndKeys>> {
    return await delegatorsHcPartyIdsSet.reduce(async (acc, delegator) => {
      const awaitedAcc = await acc
      const keys = await this.exchangeKeysManager.getDecryptionExchangeKeysFor(delegator, delegateHcPartyId)
      const keysForDelegator = await keys.reduce(async (accForKey, cryptoKey) => {
        const awaitedAccForKey = await accForKey
        const rawKey = ua2hex(await this.primitives.RSA.exportKey(cryptoKey, 'spki'))
        return [
          ...awaitedAccForKey,
          {
            key: cryptoKey,
            delegatorId: delegator,
            rawKey: rawKey,
          },
        ]
      }, Promise.resolve([] as DelegatorAndKeys[]))
      return [...awaitedAcc, ...keysForDelegator]
    }, Promise.resolve([] as DelegatorAndKeys[]))
  }

  /**
   * Gets an array of decrypted HcPartyKeys from the given `delegations`, that are shared with / can be decrypted by the HcP with the given `healthcarePartyId` (or by its parents when `fallbackOnParent` is true)
   *
   * 1. Checks whether the delegations' object has a delegation for the
   * given healthCarePartyId.
   * 2. Enumerates all the delegators (delegation.owner) present in
   * the delegations.
   * 3. Decrypt's delegators' keys and returns them.
   *
   * @param dataOwnerId : the id of the delegate HCP
   * @param delegations : delegations (can be SPKs, CFKs, EKs) for all delegates
   * @param fallbackOnParent  default true; use parent's healthCarePartyId in case there's no delegation for the `healthcarePartyId`
   * @returns  - **delegatorId** : the id of the delegator HcP that shares the **key** with the `healthcarePartyId`
   *  - **key** the decrypted HcPartyKey, shared between **delegatorId** and `healthcarePartyId`
   */
  private async getDecryptedAesExchangeKeysOfDelegateAndParentsFromGenericDelegations(
    dataOwnerId: string,
    delegations: { [key: string]: Array<Delegation> },
    fallbackOnParent = true
  ): Promise<Array<DelegatorAndKeys>> {
    const delegationsArray = delegations[dataOwnerId] ?? []

    if (!delegationsArray.length && fallbackOnParent) {
      const { dataOwner: hcp } = await this.getDataOwner(dataOwnerId)
      return (hcp as any).parentId
        ? await this.getDecryptedAesExchangeKeysOfDelegateAndParentsFromGenericDelegations((hcp as any).parentId, delegations)
        : []
    } else {
      const delegatorIds = new Set<string>()
      delegationsArray.forEach((del) => delegatorIds.add(del.owner!))
      return this.decryptAndImportAesHcPartyKeysForDelegators(Array.from(delegatorIds), dataOwnerId)
    }
  }

  /**
   * Retrieve the owner HealthCareParty key and use it to encrypt
   * both the delegations (createdObject.id) and the cryptedForeignKeys
   * (parentObject.id), and returns them in an object.
   */
  private async initObjectDelegations(
    createdObject: any,
    parentObject: any,
    ownerId: string,
    secretForeignKeyOfParent: string | null
  ): Promise<{
    owner: HealthcareParty | Device | Patient
    delegations: any
    cryptedForeignKeys: any
    secretForeignKeys: any[]
    secretId: string
  }> {
    const publicKeys = await this.getPublicKeys()

    this.throwDetailedExceptionForInvalidParameter('createdObject.id', createdObject.id, 'initObjectDelegations', arguments)

    if (parentObject) this.throwDetailedExceptionForInvalidParameter('parentObject.id', parentObject.id, 'initObjectDelegations', arguments)

    const secretId = this.randomUuid()
    return this.getDataOwner(ownerId).then(async ({ dataOwner: owner }) => {
      const { owner: modifiedOwner, aesExchangeKeys } = await this.getOrCreateHcPartyKeys(owner, ownerId)
      const importedAESHcPartyKey = await this.decryptAnyAesExchangeKeyForOwner(aesExchangeKeys, ownerId, ownerId, ownerId, publicKeys)

      const encryptedDelegation = await this._AES.encrypt(
        importedAESHcPartyKey.key,
        string2ua(createdObject.id + ':' + secretId).buffer as ArrayBuffer,
        importedAESHcPartyKey.rawKey
      )
      const encryptedSecretForeignKey = parentObject
        ? await this._AES.encrypt(
            importedAESHcPartyKey.key,
            string2ua(createdObject.id + ':' + parentObject.id).buffer as ArrayBuffer,
            importedAESHcPartyKey.rawKey
          )
        : undefined

      return {
        owner: modifiedOwner,
        delegations: _.fromPairs([
          [
            ownerId,
            [
              {
                owner: ownerId,
                delegatedTo: ownerId,
                key: ua2hex(encryptedDelegation!),
              },
            ],
          ],
        ]),
        cryptedForeignKeys:
          (encryptedSecretForeignKey
            ? _.fromPairs([
                [
                  ownerId,
                  [
                    {
                      owner: ownerId,
                      delegatedTo: ownerId,
                      key: ua2hex(encryptedSecretForeignKey!),
                    },
                  ],
                ],
              ])
            : {}) || {},
        secretForeignKeys: (secretForeignKeyOfParent && [secretForeignKeyOfParent]) || [],
        secretId: secretId,
      }
    })
  }

  private async decryptAnyAesExchangeKeyForOwner(
    aesExchangeKeys: { [p: string]: { [p: string]: string } },
    loggedHcPartyId: string,
    delegatorId: string,
    delegateHcPartyId: string,
    publicKeys: string[]
  ) {
    const importedAESHcPartyKey = await Object.entries(aesExchangeKeys).reduce(async (acc, [publicKeyIdentifier, hcPartyKeys]) => {
      const accValue = await acc
      if (accValue) {
        return accValue
      }
      try {
        return await this.decryptHcPartyKey(loggedHcPartyId, delegatorId, delegateHcPartyId, publicKeyIdentifier, hcPartyKeys, publicKeys)
      } catch (e) {
        return undefined
      }
    }, Promise.resolve(undefined as DelegatorAndKeys | undefined))

    if (!importedAESHcPartyKey) {
      throw new Error(`No hcParty key can be decrypted from ${delegatorId} to ${delegateHcPartyId} using currently available private keys`)
    }
    return importedAESHcPartyKey
  }

  /**
   * Gets updated instances of SPKs and CKFs for the child object `modifiedObject`.
   * These updated SPKs and CKFs contain new SPKs/CFKs to provide delegation from delegator HcP with id `ownerId` to delegate HcP with id `delegateId`
   *
   * 1. if `secretIdOfModifiedObject` is not provided, the method will throw an exception; this `secretIdOfModifiedObject` is used to generate a new delegation (SPK) in step 3;
   *  the `secretIdOfModifiedObject` is returned, unmodified, as `secretId`
   * 2. if the owner (delegator) did not perform a delegation to the delegate, then this HcP delegation (creation of a new HcPKey) is performed now
   * 3. creates a new delegation (Secret Primary Keys) on the `modifiedObject` encrypted with the HcPKey from owner to the delegate;
   * 4. if `parentObject` != null, creates a new CFK on the `modifiedObject` encrypted with the HcPKey from owner to the delegate;
   * 5. this new delegation (from step 3) is added to the list of existing delegations (Secret Primary Keys) on the `modifiedObject` for the delegate given by `delegateId`
   * 6. if the CFK (from step 4) can be created, this new CFK is added to the list of existing CFKs on the `modifiedObject` for the delegate given by `delegateId`
   * 7. then some duplicates delegations (SPKs) and CKFs are removed
   *
   * @param modifiedObject : the object of which SPKs and CFKs will be cloned, the clones will be modified and then used as returned values ; it's a 'child' of `parentObject`; will NOT be mutated
   * @param parentObject : will NOT be mutated
   * @param ownerId : the HcP id of the delegator
   * @param delegateId : the HcP id of the delegate
   * @param secretIdOfModifiedObject : the secret id used in the child object to generate its SPK
   * @returns - **delegations**  existing delegations (SPKs) of the `modifiedObject`, appended with results from step 5
   * - **cryptedForeignKeys** existing CFKs of the `modifiedObject`, appended with results from steps 6
   * - **secretId** which is the given input parameter `secretIdOfModifiedObject`
   */

  private extendedDelegationsAndCryptedForeignKeys<T extends EncryptedEntity, P extends EncryptedParentEntity>(
    modifiedObject: T,
    parentObject: P | null,
    ownerId: string,
    delegateId: string,
    secretIdOfModifiedObject: string | null
  ): Promise<{
    modifiedObject: T
    delegations: { [key: string]: Array<Delegation> }
    cryptedForeignKeys: { [key: string]: Array<Delegation> }
    secretId: string | null
  }> {
    this.throwDetailedExceptionForInvalidParameter('modifiedObject.id', modifiedObject.id, 'extendedDelegationsAndCryptedForeignKeys', arguments) //modifiedObject should never be null

    if (parentObject)
      this.throwDetailedExceptionForInvalidParameter('parentObject.id', parentObject?.id, 'extendedDelegationsAndCryptedForeignKeys', arguments)

    this.throwDetailedExceptionForInvalidParameter(
      'secretIdOfModifiedObject',
      secretIdOfModifiedObject,
      'extendedDelegationsAndCryptedForeignKeys',
      arguments
    )

    return this.getDataOwner(ownerId)
      .then(async ({ dataOwner: owner }) => {
        const publicKeys = await this.getPublicKeys()
        const { owner: modifiedOwner, aesExchangeKeys } = await this.getOrCreateHcPartyKeys(owner, delegateId)
        const importedAESHcPartyKey = await this.decryptAnyAesExchangeKeyForOwner(aesExchangeKeys, ownerId, delegateId, ownerId, publicKeys)

        modifiedObject = modifiedObject?.id === owner.id ? (modifiedOwner as T) : modifiedObject

        return {
          previousDecryptedDelegations: await Promise.all(
            ((modifiedObject.delegations || {})[delegateId] || []).map(
              (d: Delegation) =>
                (d.key &&
                  d.owner === ownerId &&
                  this._AES.decrypt(importedAESHcPartyKey.key, hex2ua(d.key), importedAESHcPartyKey.rawKey).catch(() => {
                    console.log(
                      `Cannot decrypt delegation from ${d.owner} to ${d.delegatedTo} for object with id ${modifiedObject.id}:`,
                      modifiedObject
                    )
                    return Promise.resolve()
                  })) ||
                Promise.resolve()
            ) as Array<Promise<ArrayBuffer>>
          ),

          previousDecryptedCryptedForeignKeys: await Promise.all(
            ((modifiedObject.cryptedForeignKeys || {})[delegateId] || []).map(
              (d: Delegation) =>
                (d.key &&
                  d.owner === ownerId &&
                  this._AES.decrypt(importedAESHcPartyKey.key, hex2ua(d.key), importedAESHcPartyKey.rawKey).catch(() => {
                    console.log(
                      `Cannot decrypt cryptedForeignKeys from ${d.owner} to ${d.delegatedTo} for object with id ${modifiedObject.id}:`,
                      modifiedObject
                    )
                    return Promise.resolve()
                  })) ||
                Promise.resolve()
            ) as Array<Promise<ArrayBuffer>>
          ),

          cryptedDelegation: await this._AES.encrypt(
            importedAESHcPartyKey.key,
            string2ua(modifiedObject.id + ':' + secretIdOfModifiedObject!).buffer as ArrayBuffer,
            importedAESHcPartyKey.rawKey
          ),

          cryptedForeignKey: parentObject
            ? await this._AES.encrypt(
                importedAESHcPartyKey.key,
                string2ua(modifiedObject.id + ':' + parentObject.id).buffer as ArrayBuffer,
                importedAESHcPartyKey.rawKey
              )
            : undefined,
        }
      })
      .then(({ previousDecryptedDelegations, previousDecryptedCryptedForeignKeys, cryptedDelegation, cryptedForeignKey }) => {
        //try to limit the extent of the modifications to the delegations by preserving the redundant delegation already present and removing duplicates
        //For delegate delegateId, we create:
        // 1. an array of objects { d : {owner,delegatedTo,encrypted(key)}} with one object for each existing delegation and the new key concatenated
        // 2. an array of objects { k : decrypted(key)} with one object for the existing delegations and the new key concatenated
        // We merge them to get one array of objects: { d: {owner,delegatedTo,encrypted(key)}, k: decrypted(key)}
        const delegationCryptedDecrypted = (
          _.merge(
            ((modifiedObject.delegations || {})[delegateId] || []).map((d: Delegation) => ({
              d,
            })),
            (previousDecryptedDelegations || []).map((dd) => (dd ? ua2string(dd) : null)).map((k) => ({ k }))
          ) as { d: Delegation; k: string }[]
        )
          .filter(({ d, k }) => !!k || d.owner !== ownerId) //Only keep the ones created by us that can still be decrypted
          .map(({ d, k }) => ({
            d,
            k: k || this.randomUuid(),
          })) // Use some unique id that ensures the delegation not created by us are going to be held
          .concat([
            {
              d: {
                owner: ownerId,
                delegatedTo: delegateId,
                key: ua2hex(cryptedDelegation!),
              },
              k: modifiedObject.id + ':' + secretIdOfModifiedObject!,
            },
          ])

        const allDelegations = _.cloneDeep(modifiedObject.delegations || {})

        //Only keep one version of the decrypted key
        allDelegations[delegateId] = _.uniqBy(delegationCryptedDecrypted, (x: any) => x.k).map((x: any) => x.d)

        const cryptedForeignKeysCryptedDecrypted = (
          _.merge(
            ((modifiedObject.cryptedForeignKeys || {})[delegateId] || []).map((d: Delegation) => ({
              d,
            })),
            (previousDecryptedCryptedForeignKeys || []).map((dd) => (dd ? ua2string(dd) : null)).map((k) => ({ k }))
          ) as { d: Delegation; k: string }[]
        )
          .filter(({ d, k }) => !!k || d.owner !== ownerId) //Only keep the ones created by us that can still be decrypted
          .map(({ d, k }: { d: Delegation; k: string }) => ({
            d,
            k: k || this.randomUuid(),
          })) // Use some unique id that ensures the delegation not created by us are going to be held
          .concat(
            cryptedForeignKey
              ? [
                  {
                    d: {
                      owner: ownerId,
                      delegatedTo: delegateId,
                      key: ua2hex(cryptedForeignKey),
                    },
                    k: modifiedObject.id + ':' + parentObject?.id,
                  },
                ]
              : []
          )

        const allCryptedForeignKeys = _.cloneDeep(modifiedObject.cryptedForeignKeys || {})
        if (cryptedForeignKeysCryptedDecrypted.length > 0) {
          allCryptedForeignKeys[delegateId] = _.uniqBy(cryptedForeignKeysCryptedDecrypted, (x: any) => x.k).map((x: any) => x.d)
        }

        return {
          modifiedObject,
          delegations: allDelegations,
          cryptedForeignKeys: allCryptedForeignKeys,
          secretId: secretIdOfModifiedObject,
        }
      })
  }

  // What we need is to find aes exchange keys on the owner ! Even just with whom he shared information, we don't care about aes exchange keys
  private async _getDelegateIdsOf(owner: HealthcareParty | Patient | Device): Promise<string[]> {
    const mapOfAesExchKeysDelegates = Object.entries(owner.aesExchangeKeys ?? {}).reduce(
      (map, [, aesExchKeys]) => map.concat(Object.keys(aesExchKeys).filter((delegateId) => !map.includes(delegateId))),
      [] as string[]
    )

    return owner.hcPartyKeys
      ? mapOfAesExchKeysDelegates.concat(Object.keys(owner.hcPartyKeys).filter((delegateId) => !mapOfAesExchKeysDelegates.includes(delegateId)))
      : mapOfAesExchKeysDelegates
  }

  /**
   * @deprecated you should not need this method anymore because everything related to entities encryption should be done either through the
   * entity-specific extended api or through the {@link EntitiesEncryption} object available at {@link entities}. Please contact us if you have a
   * scenario where you really need to get the exchange keys for the user.
   * Note that currently this method does not cache results anymore (but the updated methods do).
   */
  async getEncryptedAesExchangeKeys(
    owner: HealthcareParty | Patient | Device,
    delegateId: string
  ): Promise<{ [pubKeyIdentifier: string]: { [pubKeyFingerprint: string]: string } }> {
    const publicKeys = Array.from(this.dataOwnerApi.getHexPublicKeysOf(owner))
    const mapOfAesExchangeKeys = Object.entries(owner.aesExchangeKeys ?? {})
      .filter((e) => e[1][delegateId] && Object.keys(e[1][delegateId]).some((k1) => publicKeys.some((pk) => pk.endsWith(k1))))
      .reduce((map, e) => {
        const candidates = Object.entries(e[1][delegateId]) //[fingerprint of delegate pub key, key], [fingerprint of owner pub key, key]
        const [publicKeyFingerprint, encryptedAesExchangeKey] = candidates[candidates.findIndex(([k, v]) => publicKeys.some((pk) => pk.endsWith(k)))]
        return { ...map, [e[0]]: { [publicKeyFingerprint]: encryptedAesExchangeKey } }
      }, {} as { [pubKeyIdentifier: string]: { [pubKeyFingerprint: string]: string } })

    if (!owner.publicKey || mapOfAesExchangeKeys[owner.publicKey] || !owner.hcPartyKeys?.[delegateId]) {
      return mapOfAesExchangeKeys
    }
    const delegate = (await this.dataOwnerApi.getDataOwner(delegateId)).dataOwner
    if (delegate.publicKey && publicKeys.includes(delegate.publicKey)) {
      return {
        ...mapOfAesExchangeKeys,
        [owner.publicKey]: { [delegate.publicKey!.slice(-32)]: owner.hcPartyKeys[delegateId][1] },
      }
    } else if (publicKeys.includes(owner.publicKey)) {
      return { ...mapOfAesExchangeKeys, [owner.publicKey]: { [owner.publicKey.slice(-32)]: owner.hcPartyKeys[delegateId][0] } }
    }
    return mapOfAesExchangeKeys
  }

  private async getOrCreateHcPartyKeys(
    owner: HealthcareParty | Patient | Device,
    delegateId: string
  ): Promise<{
    owner: HealthcareParty | Patient | Device
    aesExchangeKeys: { [pubKeyIdentifier: string]: { [pubKeyFingerprint: string]: string } }
  }> {
    const aesExchangeKeys = await this.getEncryptedAesExchangeKeys(owner, delegateId)
    if (Object.keys(aesExchangeKeys).length) {
      return { owner, aesExchangeKeys }
    }

    const modifiedOwner = await this.generateKeyForDelegate(owner.id!, delegateId)
    return { owner: modifiedOwner, aesExchangeKeys: await this.getEncryptedAesExchangeKeys(modifiedOwner, delegateId) }
  }

  /**
   * @deprecated you should not use this method because initialisation of encrypted entities keys is done automatically by the entity-specific
   * extended api. Also note that it is now forbidden to initialise an entity as a data owner which is not the current data owner: you should instead
   * create the entity as the current data owner then create a delegation to the other data owner.
   */
  async initEncryptionKeys(
    createdObject: any,
    ownerId: string
  ): Promise<{
    encryptionKeys: any
    secretId: string
  }> {
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) {
      throw 'Impossible to initialise keys as a data owner which is not the current data owner'
    }
    const { updatedEntity, rawEncryptionKey } = await this.entities.entityWithInitialisedEncryptionMetadata(
      {
        ...createdObject,
        delegations: undefined,
        encryptionKeys: undefined,
        cryptedForeignKeys: undefined,
        secretForeignKeys: undefined,
      } as EncryptedEntity,
      undefined,
      undefined
    )
    return {
      encryptionKeys: updatedEntity.encryptionKeys,
      secretId: rawEncryptionKey,
    }
  }

  /**
   * Gets an updated instance of the EKs of `modifiedObject`.
   * The updated EKs contain a new EK to provide delegation from delegator HcP with id `ownerId` to delegate HcP with id `delegateId`.
   * @param modifiedObject : the object of which EKs will be cloned, the clone will be used to append the new EK, and then used as return value; will NOT be mutated
   * @param ownerId : delegator HcP id
   * @param delegateId : delegate HcP id
   * @param secretEncryptionKeyOfObject : secret Id for the EK (Content Encryption Key)
   * @returns
   *   - **encryptionKeys** existing EKs of the `modifiedObject`, appended with a new EK item (owner: `ownerId`, delegatedTo: `delegateId`, encrypted key with secretId:
   *     `secretEncryptionKeyOfObject` )
   *   - **secretId** which is the given input parameter `secretEncryptionKeyOfObject`
   */
  private async appendEncryptionKeys<T extends EncryptedEntity>(
    modifiedObject: T,
    ownerId: string,
    delegateId: string,
    secretEncryptionKeyOfObject: string
  ): Promise<{
    modifiedObject: T
    encryptionKeys: { [key: string]: Array<Delegation> }
    secretId: string | null //secretEncryptionKeyOfObject is returned to avoid the need for a new decryption when chaining calls
  }> {
    this.throwDetailedExceptionForInvalidParameter('modifiedObject.id', modifiedObject.id, 'appendEncryptionKeys', arguments) //modifiedObject should never be null

    this.throwDetailedExceptionForInvalidParameter('secretEncryptionKeyOfObject', secretEncryptionKeyOfObject, 'appendEncryptionKeys', arguments)

    const owner = (await this.getDataOwner(ownerId)).dataOwner
    const publicKeys = await this.getPublicKeys()
    const { owner: modifiedOwner, aesExchangeKeys } = await this.getOrCreateHcPartyKeys(owner, delegateId)
    modifiedObject = modifiedObject?.id === owner.id ? (modifiedOwner as T) : modifiedObject
    const importedAESHcPartyKey = await this.decryptAnyAesExchangeKeyForOwner(aesExchangeKeys, ownerId, ownerId, delegateId, publicKeys)
    const previousDecryptedEncryptionKeys = await Promise.all(
      ((modifiedObject.encryptionKeys || {})[delegateId] || []).map(
        (d: Delegation) =>
          (d.key &&
            d.owner === ownerId &&
            this._AES.decrypt(importedAESHcPartyKey.key, hex2ua(d.key), importedAESHcPartyKey.rawKey).catch(() => {
              console.log(
                `Cannot decrypt encryption key from ${d.owner} to ${d.delegatedTo} for object with id ${modifiedObject.id}:`,
                modifiedObject
              )
              return Promise.resolve()
            })) ||
          Promise.resolve()
      ) as Array<Promise<ArrayBuffer>>
    )
    const encryptedEncryptionKey = await this._AES.encrypt(
      importedAESHcPartyKey.key,
      string2ua(modifiedObject.id + ':' + secretEncryptionKeyOfObject)
    )
    //try to limit the extent of the modifications to the delegations by preserving the redundant encryption keys already present and removing duplicates
    //For delegate delegateId, we create:
    // 1. an array of objects { d : {owner,delegatedTo,encrypted(key)}} with one object for the existing encryption keys and the new key concatenated
    // 2. an array of objects { k : decrypted(key)} with one object for the existing delegations and the new key concatenated
    // We merge them to get one array of objects: { d: {owner,delegatedTo,encrypted(key)}, k: decrypted(key)}
    const encryptionKeysCryptedDecrypted = (
      _.merge(
        ((modifiedObject.encryptionKeys || {})[delegateId] || []).map((d: Delegation) => ({
          d,
        })),
        (previousDecryptedEncryptionKeys || []).map((dd) => (dd ? ua2string(dd) : null)).map((k) => ({ k }))
      ) as { d: Delegation; k: string }[]
    )
      .filter(({ d, k }: { d: Delegation; k: string }) => !!k || d.owner !== ownerId) //Only keep the ones created by us that can still be decrypted
      .map(({ d, k }: { d: Delegation; k: string }) => ({ d, k: k || this.randomUuid() }))
      .concat([
        {
          d: {
            owner: ownerId,
            delegatedTo: delegateId,
            key: ua2hex(encryptedEncryptionKey),
          },
          k: modifiedObject.id + ':' + secretEncryptionKeyOfObject!,
        },
      ])

    const allEncryptionKeys = _.cloneDeep(modifiedObject.encryptionKeys || {})
    allEncryptionKeys[delegateId] = _.uniqBy(encryptionKeysCryptedDecrypted, (x: any) => x.k).map((x: any) => x.d)

    return {
      modifiedObject: modifiedObject,
      encryptionKeys: allEncryptionKeys,
      secretId: secretEncryptionKeyOfObject,
    }
  }

  /**
   * Gets an updated `child` object that will have its SPKs, CFKs, KSs updated to include delegations from delegator HcP with id `ownerId` to delegate HcP with id `delegateId`
   * The SFKs of `child` are not updated, so this method assumes this is not the initial delegation on the `child` object
   * The method also performs some deduplication of all types of delegations.
   * @param parent : the parent object of `child`; will NOT be mutated
   * @param child : the object that will be mutated and returned
   * @param ownerId delegator HcP id
   * @param delegateId delegate HcP id
   * @param secretDelegationKey  the secret Id used in the child object to generate the SPK
   * @param secretEncryptionKey  the secret Id used in the child object to generate the EK (Content Encryption Key)
   * @returns - an updated `child` object that will contain updated SPKs, CFKs, EKs
   *  */

  private async addDelegationsAndEncryptionKeys<T extends EncryptedEntity>(
    parent: EncryptedParentEntity | null,
    child: T,
    ownerId: string,
    delegateId: string,
    secretDelegationKey: string | null,
    secretEncryptionKey: string | null
  ): Promise<T> {
    if (parent) this.throwDetailedExceptionForInvalidParameter('parent.id', parent.id, 'addDelegationsAndEncryptionKeys', arguments)

    this.throwDetailedExceptionForInvalidParameter('child.id', child.id, 'addDelegationsAndEncryptionKeys', arguments)

    const extendedChildObjectSPKsAndCFKs = secretDelegationKey
      ? await this.extendedDelegationsAndCryptedForeignKeys(child, parent, ownerId, delegateId, secretDelegationKey)
      : { modifiedObject: child, delegations: {}, cryptedForeignKeys: {}, secretId: null }

    const extendedChildObjectEKs = secretEncryptionKey
      ? await this.appendEncryptionKeys(extendedChildObjectSPKsAndCFKs.modifiedObject, ownerId, delegateId, secretEncryptionKey)
      : { encryptionKeys: {}, modifiedObject: extendedChildObjectSPKsAndCFKs.modifiedObject }

    const latestObject = extendedChildObjectEKs.modifiedObject

    return _.assign(latestObject, {
      // Conservative version ... We might want to be more aggressive with the deduplication of keys
      // For each delegate, we are going to concatenate to the src (the new delegations), the object in dest (the current delegations)
      // for which we do not find an equivalent delegation (same delegator, same delegate)
      delegations: _.assignWith(child.delegations, extendedChildObjectSPKsAndCFKs.delegations, (dest, src) =>
        (src || []).concat(_.filter(dest, (d: Delegation) => !src.some((s: Delegation) => s.owner === d.owner && s.delegatedTo === d.delegatedTo)))
      ),
      cryptedForeignKeys: _.assignWith(child.cryptedForeignKeys, extendedChildObjectSPKsAndCFKs.cryptedForeignKeys, (dest, src) =>
        (src || []).concat(_.filter(dest, (d: Delegation) => !src.some((s: Delegation) => s.owner === d.owner && s.delegatedTo === d.delegatedTo)))
      ),
      encryptionKeys: _.assignWith(child.encryptionKeys, extendedChildObjectEKs.encryptionKeys, (dest, src) =>
        (src || []).concat(_.filter(dest, (d: Delegation) => !src.some((s: Delegation) => s.owner === d.owner && s.delegatedTo === d.delegatedTo)))
      ),
    })
  }

  /**
   * @deprecated (light) You should use:
   * - {@link EntitiesEncryption.secretIdsOf} in {@link entities} to get the secret foreign keys (now secret ids)
   * - {@link IccDataOwnerXApi.getCurrentDataOwnerHierarchyIds} to get the full hierarchy for the current data owner (cached). The first element is
   *   the id of the topmost parent, while the last is the current data owner.
   * Note that the behaviour of this method has some subtle changes compared to the past:
   * - throws an error if the provided hcpartyId is not part of the current data owner hierarchy.
   * - does not provide any guarantees on the ordering of the extracted keys
   * - deduplicates extracted keys
   */
  async extractDelegationsSFKs(document: EncryptedEntity | null, hcpartyId?: string): Promise<{ extractedKeys: Array<string>; hcpartyId?: string }> {
    if (!document || !hcpartyId) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    const delegationsForAllDelegates = document.delegations
    if (!delegationsForAllDelegates || !Object.keys(delegationsForAllDelegates).length) {
      console.log(`There is no delegation in document (${document.id})`)
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    return {
      extractedKeys: await this.entities.secretIdsOf(document, hcpartyId),
      hcpartyId: (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0],
    }
  }

  /**
   * Gets the secret IDs (SFKs) inside decrypted SPKs of the given `document`, decrypted by the HcP with the given `hcpartyId` AND by its HcP parents
   * @param document : the object of which delegations (SPKs) to decrypt
   * @param hcpartyId : the id of the delegate HcP
   * @returns - **extractedKeys** array containing secret IDs (SFKs) from decrypted SPKs, from both given HcP and its parents ; can contain duplicates
   * - **hcpartyId** the given `hcpartyId` OR, if a parent exist, the HcP id of the top parent in the hierarchy  (even if that parent has no delegations)
   */
  private extractSFKsHierarchyFromDelegations(
    document: EncryptedEntity | null,
    hcpartyId?: string
  ): Promise<Array<{ hcpartyId: string; extractedKeys: Array<string> }>> {
    if (!document || !hcpartyId) {
      return Promise.resolve([])
    }
    const delegationsForAllDelegates = document.delegations
    if (!delegationsForAllDelegates || !Object.keys(delegationsForAllDelegates).length) {
      console.log(`There is no delegation in document (${document.id})`)
      return Promise.resolve([])
    }
    return this.extractKeysHierarchyFromDelegationLikes(hcpartyId, document.id!, delegationsForAllDelegates)
  }

  // noinspection JSUnusedGlobalSymbols

  /**
   * @deprecated (light) You should use:
   * - {@link EntitiesEncryption.parentIdsOf} in {@link entities} to get the crypted foreign keys (now parent ids)
   * - {@link IccDataOwnerXApi.getCurrentDataOwnerHierarchyIds} to get the full hierarchy for the current data owner (cached). The first element is
   *   the id of the topmost parent, while the last is the current data owner.
   * Note that the behaviour of this method has some subtle changes compared to the past:
   * - throws an error if the provided hcpartyId is not part of the current data owner hierarchy.
   * - does not provide any guarantees on the ordering of the extracted keys
   * - deduplicates extracted keys
   */
  async extractCryptedFKs(document: EncryptedEntity | null, hcpartyId: string): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    if (!document || !document.cryptedForeignKeys) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    const cfksForAllDelegates = document.cryptedForeignKeys
    if (!cfksForAllDelegates || !Object.keys(cfksForAllDelegates).length) {
      console.log(`There is no cryptedForeignKeys in document (${document.id})`)
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    return {
      extractedKeys: await this.entities.parentIdsOf(document, hcpartyId),
      hcpartyId: (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0],
    }
  }

  /**
   * @deprecated If you were using this method to encrypt/decrypt directly the `encryptedEntities` you should instead rely on the extended apis
   * methods. If instead you were using this method to get keys for encryption/decryption of attachments you should replace it with:
   * - {@link EntitiesEncryption.encryptionKeysOf} in {@link entities} to get the encryption keys.
   * - {@link IccDataOwnerXApi.getCurrentDataOwnerHierarchyIds} to get the full hierarchy for the current data owner (cached). The first element is
   *   the id of the topmost parent, while the last is the current data owner.
   * Note that the behaviour of this method has some subtle changes compared to the past:
   * - throws an error if the provided hcpartyId is not part of the current data owner hierarchy.
   * - does not provide any guarantees on the ordering of the extracted keys
   * - deduplicates extracted keys
   */
  async extractEncryptionsSKs(document: EncryptedEntity, hcpartyId: string): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    if (!document.encryptionKeys) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    const eckeysForAllDelegates = document.encryptionKeys
    if (!eckeysForAllDelegates || !Object.keys(eckeysForAllDelegates).length) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    return {
      extractedKeys: await this.entities.encryptionKeysOf(document, hcpartyId),
      hcpartyId: (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0],
    }
  }

  private extractDelegationsSFKsAndEncryptionSKs(ety: EncryptedEntity, ownerId: string) {
    const delegationsSfksOwnerPromise = this.extractDelegationsSFKs(ety, ownerId).then((xks) => xks.extractedKeys) //Will climb up hierarchy
    const encryptionKeysOwnerPromise = this.extractEncryptionsSKs(ety, ownerId).then((xks) => xks.extractedKeys) //Will climb up hierarchy

    return Promise.all([delegationsSfksOwnerPromise, encryptionKeysOwnerPromise])
  }

  /**
   * Get decrypted generic secret IDs (secretIdSPKs, parentIds, secretIdEKs) from generic delegations (SPKs, CFKs, EKs)
   * 1. Get HealthCareParty from it's Id.
   * 2. Decrypt the keys of the given HCP.
   * 3. Decrypt the parent's key if it has parent.
   * 4. Return the decrypted key corresponding to the Health Care Party.
   * @param hcpartyId : the id of the delegate HcP (including its parents) for which to decrypt `extractedKeys`
   * @param objectId : the id of the object/document of which delegations to decrypt ; used just to log to console a message (Cryptographic mistake) in case the object id inside SPK, CFK, EK is different from this one
   * @param delegations : generic delegations (can be SPKs, CFKs, EKs) for all delegates from where to extract `extractedKeys`
   * @returns - **extractedKeys** array containing secret IDs from decrypted generic delegations, from both HCP with given `hcpartyId` and its parents; can contain duplicates
   * - **hcpartyId** the given `hcpartyId` OR, if a parent exist, the HCP id of the top parent in the hierarchy  (even if that parent has no delegations)
   */
  private async extractKeysHierarchyFromDelegationLikes(
    hcpartyId: string,
    objectId: string,
    delegations: { [key: string]: Array<Delegation> }
  ): Promise<Array<{ hcpartyId: string; extractedKeys: Array<string> }>> {
    const { dataOwner: hcp } = await this.getDataOwner(hcpartyId)
    const extractedKeys = []
    if (delegations[hcpartyId]?.length) {
      const decryptedAndImportedAesHcPartyKeys = await this.getDecryptedAesExchangeKeysOfDelegateAndParentsFromGenericDelegations(
        hcpartyId,
        delegations,
        false
      )
      const collatedAesKeysFromDelegatorToHcpartyId = decryptedAndImportedAesHcPartyKeys.reduce(
        (map, k) => ({ ...map, [k.delegatorId]: (map[k.delegatorId] ?? []).concat([k]) }),
        {} as { [key: string]: { key: CryptoKey; rawKey: string }[] }
      )
      extractedKeys.push(...(await this.decryptKeyInDelegationLikes(delegations[hcpartyId], collatedAesKeysFromDelegatorToHcpartyId, objectId)))
    }

    return (hcp as HealthcareParty).parentId
      ? [
          ...(await this.extractKeysHierarchyFromDelegationLikes((hcp as HealthcareParty).parentId!, objectId, delegations)),
          { extractedKeys: extractedKeys, hcpartyId: hcpartyId },
        ]
      : [{ extractedKeys: extractedKeys, hcpartyId: hcpartyId }]
  }

  /**
   * @deprecated You should not use this method anymore, and instead replace it with the appropriate methods from {@link entities} depending on where
   * the delegations come from:
   * - {@link EntitiesEncryption.secretIdsOf} for {@link EncryptedEntity.delegations} (see {@link extractDelegationsSFKs} for more info)
   * - {@link EntitiesEncryption.encryptionKeysOf} for {@link EncryptedEntity.encryptionKeys} (see {@link extractEncryptionsSKs} for more info
   * - {@link EntitiesEncryption.parentIdsOf} for {@link EncryptedEntity.cryptedForeignKeys} (see {@link extractCryptedFKs} for more info)
   */
  async extractKeysFromDelegationsForHcpHierarchy(
    dataOwnerId: string,
    objectId: string,
    delegations: { [key: string]: Array<Delegation> }
  ): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    return {
      extractedKeys: await this.entities.extractMergedHierarchyFromDelegationAndOwner(
        delegations,
        dataOwnerId,
        (x) => !!x,
        () => Promise.resolve(true)
      ),
      hcpartyId: (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0],
    }
  }

  /**
   * This method covers the use case when a DataOwner found back access to its data, and needs to use the delegations of its delegates instead
   * of its own ones
   *
   * @param dataOwner The current data owner from whom we want to decrypt the aesExchangeKeys
   * @param delegations The object delegations to decrypt
   * @param objectId The object to decrypt id
   * @private
   */
  private async _extractDelegationsKeysUsingDataOwnerDelegateAesExchangeKeys(
    dataOwner: Patient | Device | HealthcareParty,
    delegations: { [p: string]: Array<Delegation> },
    objectId: string
  ) {
    // Find other keys through aesExchangeKeys
    const dataOwnerPubKeys = await this.getPublicKeys()
    const keysToDecrypt = fold(
      Object.entries(dataOwner.aesExchangeKeys!),
      {} as { [delegateId: string]: { [pubKey: string]: { [pubKeyFingerprint: string]: string } } },
      (acc, [pub, aesForPub]) => {
        if (dataOwnerPubKeys.find((pubKey) => pubKey.slice(-32) == pub.slice(-32)) == undefined) {
          // We get AES Keys only from delegates of keys we don't currently have
          // Otherwise, decrypted AES Keys would have previously worked
          Object.entries(aesForPub).forEach(([delegateId, aesKeys]) => {
            if (delegateId != dataOwner.id) {
              const aesAcc = {} as { [pubKeyFingerprint: string]: string }
              Object.entries(aesKeys)
                .filter(([encrPubKey]) => dataOwnerPubKeys.some((pubKey) => pubKey.slice(-32) == encrPubKey))
                .forEach(([pubKeyFingerprint, aesEncr]) => {
                  aesAcc[pubKeyFingerprint] = aesEncr
                })

              if (acc[delegateId] == undefined) {
                acc[delegateId] = {}
              }
              acc[delegateId][pub] = aesAcc
            }
          })
        }
        return acc
      }
    )

    const decryptedAndImportedAesHcPartyKeys = await foldAsync(
      Object.entries(keysToDecrypt),
      [] as DelegatorAndKeys[],
      async (delKeysAcc, [delegateId, keysForDelegate]) => {
        try {
          delKeysAcc.push(await this.decryptAnyAesExchangeKeyForOwner(keysForDelegate, dataOwner.id!, dataOwner.id!, delegateId, dataOwnerPubKeys))
        } catch (e) {
          console.log(`Could not decrypt aesExchangeKeys for delegate ${delegateId}`)
        }
        return delKeysAcc
      }
    )

    const collatedAesKeysFromDelegatorToHcpartyId = decryptedAndImportedAesHcPartyKeys.reduce(
      (map, k) => ({ ...map, [k.delegatorId]: (map[k.delegatorId] ?? []).concat([k]) }),
      {} as { [key: string]: { key: CryptoKey; rawKey: string }[] }
    )

    const delegateIdsWithNewExtractedAesKeys = Object.keys(keysToDecrypt)
    const delegationsToDecrypt = fold(Object.entries(delegations), [] as Delegation[], (acc, [delegateId, del]) => {
      if (delegateIdsWithNewExtractedAesKeys.find((id) => id == delegateId) != undefined) {
        acc.push(...delegations[delegateId])
      }
      return acc
    })

    return this.decryptKeyInDelegationLikes(delegationsToDecrypt, collatedAesKeysFromDelegatorToHcpartyId, objectId!)
  }

  /**
   * Gets an array of generic secret IDs decrypted from a list of generic delegations (SPKs, CFKs, EKs) `delegationsArray`
   * If a particular generic delegation thows an exception when decrypted, the return value for it's secret ID will be 'false' and a message is logged to console
   * For each one of the delegations in the `delegationsArray`, it tries to decrypt with the decryptedHcPartyKey of the owner of that delegation;
   *
   * @param delegationsArray : generic delegations array
   * @param aesKeys : **key** HcP ids of delegators/owners in the `delegationsArray`, each with its own decryptedHcPartyKey
   * @param masterId : is the object id to which the generic delegation belongs to
   * - used only to check whether the object.id matches the one stored in the decrypted generic delegation item
   * - even if there's no match, the secret ID is kept as a valid result (and a message logged to console)
   * @returns array of generic secret IDs (secretIdSPK, parentId, secretIdEK)
   */
  private async decryptKeyInDelegationLikes(
    delegationsArray: Array<Delegation>,
    aesKeysForDataOwnerId: { [key: string]: { key: CryptoKey; rawKey: string }[] },
    masterId: string
  ): Promise<Array<string>> {
    const decryptPromises: Array<Promise<string | undefined>> = delegationsArray.map(async (genericDelegationItem) => {
      const aesKeys = aesKeysForDataOwnerId[genericDelegationItem.owner!]
      if (aesKeys?.length) {
        return aesKeys.reduce(async (acc, aesKey) => {
          const accValue = await acc
          if (accValue) {
            return accValue
          }
          try {
            const decryptedGenericDelegationKey = await this._AES.decrypt(aesKey.key, hex2ua(genericDelegationItem.key!), aesKey.rawKey)
            const results = ua2string(decryptedGenericDelegationKey).split(':')

            const objectId = results[0] //must be the ID of the object, for checksum
            const genericSecretId = results[1]

            const details =
              'object ID: ' + masterId + '; generic delegation from ' + genericDelegationItem.owner + ' to ' + genericDelegationItem.delegatedTo

            if (!objectId) console.warn('Object id is empty; ' + details)
            if (!genericSecretId) console.warn('Secret id is empty; ' + details)

            if (objectId !== masterId) {
              /*console.log(
                "Cryptographic mistake: object ID is not equal to the expected concatenated id within decrypted generic delegation. This may happen when patients have been merged; " +
                  details
              )*/
            }
            return genericSecretId
          } catch (err) {
            console.log(
              `Could not decrypt generic delegation in object with ID: ${masterId} from ${genericDelegationItem.owner} to ${genericDelegationItem.delegatedTo}: ${err}`
            )

            return undefined
          }
        }, Promise.resolve(undefined as string | undefined))
      } else {
        console.log(`Could not find aes key for object with ID: ${masterId}`)
      }
    })
    return Promise.all(decryptPromises).then((genericSecretId) => genericSecretId.filter((id) => !!id) as string[])
  }

  private getPublicKeyFromPrivateKey(privateKey: JsonWebKey, dataOwner: Patient | Device | HealthcareParty) {
    if (!privateKey.n || !privateKey.e) {
      throw new Error('No public key can be deduced from incomplete private key')
    }

    const publicKeyFromPrivateKey = jwk2spki(privateKey)
    const publicKeys = [dataOwner.publicKey].concat(Object.keys(dataOwner.aesExchangeKeys ?? {})).filter((x) => !!x)

    if (!publicKeys.length) {
      throw new Error('No public key has been defined for hcp')
    }

    const publicKey = publicKeys.find((it) => it === publicKeyFromPrivateKey)
    if (!publicKey) {
      throw new Error('No public key can be found for this private key')
    }

    return publicKey
  }

  /**
   * @deprecated you should not need this method anymore: the new API will automatically load on startup all keys available through the key storage
   * facade and/or recoverable through transfer keys or shamir split. If you were using this method to load a key recovered through other means you
   * need to add the key pair to the {@link KeyStorageFacade} (see {@link cacheKeyPair} for more information).
   * You can convert the private key pkcs8 array to a jwk key using {@link pkcs8ToJwk} then you can extract the full key pair using
   * {@link keyPairFromPrivateKeyJwk}.
   */
  async loadKeyPairsAsTextInBrowserLocalStorage(healthcarePartyId: string, privateKey: Uint8Array) {
    await this.cacheKeyPair(keyPairFromPrivateKeyJwk(pkcs8ToJwk(privateKey)))
  }

  /**
   * @deprecated you should not need this method anymore: the new API will automatically load on startup all keys available through the key storage
   * facade and/or recoverable through transfer keys or shamir split. If you were using this method to load a key recovered through other means you
   * need to add the key pair to the {@link KeyStorageFacade} (see {@link cacheKeyPair} for more information).
   * You can extract the full key pair using {@link keyPairFromPrivateKeyJwk}.
   */
  async loadKeyPairsAsJwkInBrowserLocalStorage(healthcarePartyId: string, privateKey: JsonWebKey) {
    await this.cacheKeyPair(keyPairFromPrivateKeyJwk(privateKey))
  }

  /**
   * @deprecated you should not need this method anymore: the new API will automatically load on startup all keys available through the key storage
   * facade and/or recoverable through transfer keys or shamir split. If you were using this method to load a key recovered through other means you
   * need to add the key pair to the {@link KeyStorageFacade} (see {@link cacheKeyPair} for more information).
   */
  loadKeyPairsInBrowserLocalStorage(healthcarePartyId: string, file: Blob): Promise<void> {
    const fr = new FileReader()
    return new Promise((resolve, reject) => {
      fr.onerror = reject
      fr.onabort = reject
      fr.onload = (e: any) => {
        const privateKey = e.target.result as string
        this.loadKeyPairsAsTextInBrowserLocalStorage(healthcarePartyId, hex2ua(privateKey))
          .then(() => resolve())
          .catch(reject)
      }
      fr.readAsText(file)
    })
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * @deprecated keychains are not part of iCure's api: this method will be removed.
   */
  saveKeychainInBrowserLocalStorage(id: string, keychain: number) {
    this._storage.setItem(
      this.keychainLocalStoreIdPrefix + id,
      b2a(new Uint8Array(keychain).reduce((data, byte) => data + String.fromCharCode(byte), ''))
    )
  }

  /**
   * @deprecated keychains are not part of iCure's api: this method will be removed.
   */
  saveKeychainInBrowserLocalStorageAsBase64(id: string, keyChainB64: string) {
    this._storage.setItem(this.keychainLocalStoreIdPrefix + id, keyChainB64)
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * @deprecated keychains are not part of iCure's api: this method will be removed.
   */
  async saveKeychainValidityDateInBrowserLocalStorage(id: string, date: string) {
    if (!id) return

    if (!date) {
      await this._storage.removeItem(this.keychainValidityDateLocalStoreIdPrefix + id)
    } else {
      await this._storage.setItem(this.keychainValidityDateLocalStoreIdPrefix + id, date)
    }
  }

  /**
   * @deprecated keychains are not part of iCure's api: this method will be removed.
   * Populate the HCP.options dict with an encrypted eHealth certificate and unencryped expiry date.
   * Any potentially unencrypted certificates will be pruned from the HCP.
   * @param hcpId Id of the hcp to modify
   * @returns modified HCP
   */
  async saveKeyChainInHCPFromLocalStorage(hcpId: string): Promise<HealthcareParty> {
    return await this.hcpartyBaseApi.getHealthcareParty(hcpId).then(async (hcp: HealthcareParty) => {
      let aesKey: CryptoKey | null = null
      try {
        aesKey = _.find(
          await this.decryptAndImportAesHcPartyKeysForDelegators([hcp.id!], hcp.id!),
          (delegator: DelegatorAndKeys) => delegator.delegatorId === hcp.id
        )!.key
      } catch (e) {
        console.error('Error while importing the AES key.')
      }
      if (!aesKey) {
        console.error('No encryption key!')
      }

      const opts = hcp.options || {}

      const crt = await this.getKeychainInBrowserLocalStorageAsBase64(hcp.id!!)
      if (!!aesKey && !!crt) {
        let crtEncrypted: ArrayBuffer | null = null
        try {
          crtEncrypted = await this.AES.encrypt(aesKey, new Uint8Array(string2ua(atob(crt))))
        } catch (e) {
          console.error('Error while encrypting the certificate', e)
        }

        // add the encrypted certificate to the options
        _.set(opts, this.hcpPreferenceKeyEhealthCert, ua2string(new Uint8Array(crtEncrypted!)))
      }

      const crtValidityDate = this.getKeychainValidityDateInBrowserLocalStorage(hcp.id!!)
      if (!!crtValidityDate) {
        _.set(opts, this.hcpPreferenceKeyEhealthCertDate, crtValidityDate)
      }

      hcp.options = opts
      return hcp
    })
  }

  /**
   * @deprecated keychains are not part of iCure's api: this method will be removed.
   */
  importKeychainInBrowserFromHCP(hcpId: string): Promise<void> {
    return this.hcpartyBaseApi.getHealthcareParty(hcpId).then(async (hcp: HealthcareParty) => {
      let crtCryp: Uint8Array | null = null
      if (!!hcp.options && !!hcp.options[this.hcpPreferenceKeyEhealthCert]) {
        crtCryp = string2ua(hcp.options[this.hcpPreferenceKeyEhealthCert])
      }

      const crtValidityDate = _.get(hcp.options, this.hcpPreferenceKeyEhealthCertDate)

      // store the validity date
      if (!!crtValidityDate) {
        this.saveKeychainValidityDateInBrowserLocalStorage(hcp.id!!, crtValidityDate)
      }

      let crt: ArrayBuffer | null = null
      let decryptionKey: CryptoKey | null = null
      try {
        decryptionKey = _.find(
          await this.decryptAndImportAesHcPartyKeysForDelegators([hcp.id!], hcp.id!),
          (delegator: DelegatorAndKeys) => delegator.delegatorId === hcp.id
        )!.key
      } catch (e) {
        console.error('Error while importing the AES key.')
      }
      if (!decryptionKey) {
        throw new Error('No encryption key! eHealth certificate cannot be decrypted.')
      }

      if (!!crtCryp && decryptionKey) {
        try {
          crt = await this.AES.decrypt(decryptionKey, crtCryp)
        } catch (e) {
          console.error(e)
        }
      }

      if (!crt) {
        throw new Error(`Error while saving certificate in browser local storage! Hcp ${hcp.id} has no certificate.`)
      } else {
        this.saveKeychainInBrowserLocalStorageAsBase64(hcp.id!!, btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(crt)))))
      }

      return
    })
  }

  /**
   * @deprecated e-health certificates and keychains are not part of iCure's api: this method will be removed.
   * Synchronizes the eHealth certificate from the database into the LocalStorage, returning information on the presence
   * of certificate data in either place.
   *
   * @param hcpId The healthcare party id
   * @returns A Promise for an object that represents the existence of a certificate in local storage and in the DB,
   * through the two boolean properties "local" and "remote".
   */
  syncEhealthCertificateFromDatabase(hcpId: string): Promise<{ remote: boolean; local: boolean }> {
    return this.hcpartyBaseApi.getHealthcareParty(hcpId).then((hcp: HealthcareParty) => {
      const remoteCertificate = _.get(hcp.options, this.hcpPreferenceKeyEhealthCert)
      const localCertificate = this.getKeychainInBrowserLocalStorageAsBase64(hcp.id!)

      if (remoteCertificate) {
        return this.importKeychainInBrowserFromHCP(hcp.id!)
          .then(() => ({ local: true, remote: true }))
          .catch(() => ({ local: !!localCertificate, remote: true }))
      } else {
        return { local: !!localCertificate, remote: !!remoteCertificate }
      }
    })
  }

  /**
   * @deprecated keychains are not part of iCure's api: this method will be removed.
   */
  getKeychainInBrowserLocalStorageAsBase64(id: string) {
    return this._storage.getItem(this.keychainLocalStoreIdPrefix + id)
  }

  /**
   * @deprecated keychains are not part of iCure's api: this method will be removed.
   */
  getKeychainValidityDateInBrowserLocalStorage(id: string) {
    return this._storage.getItem(this.keychainValidityDateLocalStoreIdPrefix + id)
  }

  /**
   * @deprecated keychains are not part of iCure's api: this method will be removed.
   */
  async loadKeychainFromBrowserLocalStorage(id: string) {
    const lsItem = await this._storage.getItem(this.keychainLocalStoreIdPrefix + id)
    return lsItem !== undefined ? b64_2uas(lsItem) : null
  }

  /**
   * @deprecated you should not need this method anymore to deal with the encryption of iCure entities because everything related to entities
   * encryption should be done either through the entity-specific extended api or through the {@link EntitiesEncryption} object available at
   * {@link entities}. If instead you were using the method for other reasons check {@link getCachedRsaKeyPairForFingerprint} to get an idea of
   * possible replacements.
   */
  async loadKeyPairNotImported(id: string, publicKeyFingerPrint?: string): Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey } | undefined> {
    if (publicKeyFingerPrint) {
      const cached = this.keyManager.getKeyPairForFingerprint(publicKeyFingerPrint)?.pair
      if (cached) {
        return this.primitives.RSA.exportKeys(cached, 'jwk', 'jwk')
      }
    } else {
      const defaultKey = await this._keyStorage.getKeypair(this.rsaLocalStoreIdPrefix + id)
      if (defaultKey) return defaultKey
    }
    console.warn(`No key can be found in local storage for id ${id} and publicKeyFingerPrint ${publicKeyFingerPrint}`)
  }

  /**
   * Loads and imports the RSA key pair (hcparty) from local storage
   *
   * @param id  doc id - hcPartyId
   * @returns {Promise} -> {CryptoKey} - imported RSA
   */
  private loadKeyPairImported(id: string) {
    return new Promise(async (resolve: (value: { publicKey: CryptoKey; privateKey: CryptoKey }) => any, reject) => {
      try {
        const jwkKeyPair = await this._keyStorage.getKeypair(this.rsaLocalStoreIdPrefix + id)
        if (jwkKeyPair !== undefined) {
          if (jwkKeyPair.publicKey && jwkKeyPair.privateKey) {
            this._RSA.importKeyPair('jwk', jwkKeyPair.privateKey, 'jwk', jwkKeyPair.publicKey).then(resolve, (err) => {
              console.error('Error in RSA.importKeyPair: ' + err)
              reject(err)
            })
          } else {
            const message = 'Error in RSA.importKeyPair: Invalid key'
            console.error(message)
            reject(Error(message))
          }
        } else {
          const message = 'Error in RSA.importKeyPair: Missing key'
          console.error(message)
          reject(Error(message))
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * @deprecated use {@link IccIcureMaintenanceXApi.applyKeyPairUpdate} instead.
   */
  async giveAccessBackTo(delegateUser: User, ownerId: string, ownerNewPublicKey: string): Promise<CachedDataOwner> {
    const delegateId = delegateUser.healthcarePartyId ?? delegateUser.patientId ?? delegateUser.deviceId
    if (!delegateId) {
      throw new Error(`DelegateUser ${delegateUser.id} must be a data Owner`)
    }

    const delegatePublicKeys = await this.getPublicKeys()
    const newPubKeyCryptoKey = await this._RSA.importKey('jwk', spkiToJwk(hex2ua(ownerNewPublicKey)), ['encrypt'])
    const dataOwnerToUpdate = await this.getDataOwner(ownerId)

    const newAesExchangeKeys = await foldAsync(
      Object.entries(dataOwnerToUpdate.dataOwner.aesExchangeKeys ?? {}),
      dataOwnerToUpdate.dataOwner.aesExchangeKeys ?? {},
      async (pubAcc, [pubKey, newAesExcKeys]) => {
        const existingKeys = pubAcc[pubKey] ?? {}

        pubAcc[pubKey] = await foldAsync(Object.entries(newAesExcKeys), existingKeys, async (delAcc, [delId, delKeys]) => {
          if (delId == delegateId && pubKey != ownerNewPublicKey) {
            // Add the AES Key encrypted with the new public key in the aesExchangeKeys
            try {
              // First, we decrypt it using the delegate RSA Public Key
              const encrAesKeyInfo = await this.decryptHcPartyKey(
                delegateId,
                dataOwnerToUpdate.dataOwner.id!,
                delegateId,
                pubKey,
                delKeys,
                delegatePublicKeys
              ).then(async (delegatorAndKeys) => {
                // Then, we encrypt it using the owner new RSA Public Key (provided in argument)
                return await this.encryptAesKeyOnlyForProvidedKeys(delegatorAndKeys?.rawKey, dataOwnerToUpdate, [newPubKeyCryptoKey])
                  .then((encrAes) => Object.values(encrAes)[0])
                  .then((encrAesInfo) => {
                    return { pubKeyUsedToEncryptAes: Object.keys(encrAesInfo)[0], encryptedAes: Object.values(encrAesInfo)[0] }
                  })
              })

              delKeys[encrAesKeyInfo.pubKeyUsedToEncryptAes] = encrAesKeyInfo.encryptedAes
            } catch (e) {
              console.log(`${delegateId} could not re-encrypt AES Key of ${dataOwnerToUpdate.dataOwner.id}`)
            } finally {
              delAcc[delId] = delKeys
            }
          } else {
            // Otherwise, we don't transform the aesExchangeKeys for this delegate
            delAcc[delId] = delKeys
          }
          return delAcc
        })
        return pubAcc
      }
    )

    // After adding the potential new aesExchangeKeys, we save the updated data owner
    return this._saveDataOwner({
      type: dataOwnerToUpdate.type,
      dataOwner: { ...dataOwnerToUpdate.dataOwner, aesExchangeKeys: newAesExchangeKeys },
    } as CachedDataOwner)
  }

  // TODO all add new key pairs methods have been removed: the api can be successfully instantiated only if there is a key pair available

  private async addNewKeyPairForOwnerId(
    maintenanceTasksApi: IccMaintenanceTaskXApi,
    user: User,
    ownerId: string,
    generateTransferKey: boolean = true,
    sendMaintenanceTasks: boolean = true
  ): Promise<{ dataOwner: HealthcareParty | Patient | Device; publicKey: string; privateKey: string }> {
    return this.addNewKeyPairForOwner(maintenanceTasksApi, user, await this.getDataOwner(ownerId), generateTransferKey, sendMaintenanceTasks)
  }

  private async addNewKeyPairForOwner(
    maintenanceTasksApi: IccMaintenanceTaskXApi,
    user: User,
    cdo: CachedDataOwner,
    generateTransferKey: boolean = true,
    sendMaintenanceTasks: boolean = true
  ): Promise<{ dataOwner: HealthcareParty | Patient | Device; publicKey: string; privateKey: string }> {
    const generatedKeypair = await this.RSA.generateKeyPair()
    return this.addKeyPairForOwner(maintenanceTasksApi, user, cdo, generatedKeypair, generateTransferKey, sendMaintenanceTasks)
  }

  private async addRawKeyPairForOwnerId(
    maintenanceTasksApi: IccMaintenanceTaskXApi,
    user: User,
    ownerId: string,
    keypair: { publicKey: string; privateKey: string },
    generateTransferKey: boolean = true,
    sendMaintenanceTasks: boolean = true
  ): Promise<{ dataOwner: HealthcareParty | Patient | Device; publicKey: string; privateKey: string }> {
    return this.addRawKeyPairForOwner(maintenanceTasksApi, user, await this.getDataOwner(ownerId), keypair, generateTransferKey, sendMaintenanceTasks)
  }

  private async addRawKeyPairForOwner(
    maintenanceTasksApi: IccMaintenanceTaskXApi,
    user: User,
    cdo: CachedDataOwner,
    keypair: { publicKey: string; privateKey: string },
    generateTransferKey: boolean = true,
    sendMaintenanceTasks: boolean = true
  ): Promise<{ dataOwner: HealthcareParty | Patient | Device; publicKey: string; privateKey: string }> {
    const importedPrivateKey = await this._RSA.importKey('pkcs8', hex2ua(keypair.privateKey), ['decrypt'])
    const importedPublicKey = await this._RSA.importKey('spki', hex2ua(keypair.publicKey), ['encrypt'])

    return this.addKeyPairForOwner(
      maintenanceTasksApi,
      user,
      cdo,
      { publicKey: importedPublicKey, privateKey: importedPrivateKey },
      generateTransferKey,
      sendMaintenanceTasks
    )
  }

  private async addKeyPairForOwner(
    maintenanceTasksApi: IccMaintenanceTaskXApi,
    user: User,
    cdo: CachedDataOwner,
    keypair: { publicKey: CryptoKey; privateKey: CryptoKey },
    generateTransferKey: boolean = true,
    sendMaintenanceTasks: boolean = true
  ): Promise<{ dataOwner: HealthcareParty | Patient | Device; publicKey: string; privateKey: string }> {
    const publicKeyHex = ua2hex(await this.RSA.exportKey(keypair.publicKey!, 'spki'))

    const gen = (await this._AES.generateCryptoKey(true)) as string

    await this.cacheKeyPair({
      publicKey: await this.RSA.exportKey(keypair.publicKey!, 'jwk'),
      privateKey: await this.RSA.exportKey(keypair.privateKey!, 'jwk'),
    })

    const { type: ownerType, dataOwner: ownerToUpdate } = await this.createOrUpdateAesExchangeKeysFor(cdo, gen, {
      pubKey: keypair.publicKey,
      privKey: keypair.privateKey,
    }).then(async (dataOwnerWithUpdatedAesKeys) =>
      generateTransferKey
        ? await this.createOrUpdateTransferKeysFor(dataOwnerWithUpdatedAesKeys, gen, { pubKey: keypair.publicKey, privKey: keypair.privateKey })
        : dataOwnerWithUpdatedAesKeys
    )

    const modifiedDataOwnerAndType = await this._saveDataOwner({ type: ownerType, dataOwner: ownerToUpdate })
    const sentMaintenanceTasks = sendMaintenanceTasks
      ? await this.sendMaintenanceTasks(maintenanceTasksApi, user, modifiedDataOwnerAndType.dataOwner, keypair.publicKey)
      : []

    return {
      dataOwner: sentMaintenanceTasks.length
        ? await this.retrieveDataOwnerInfoAfterPotentialUpdate(modifiedDataOwnerAndType.dataOwner)
        : modifiedDataOwnerAndType.dataOwner,
      publicKey: publicKeyHex,
      privateKey: ua2hex((await this.RSA.exportKey(keypair.privateKey!, 'pkcs8')) as ArrayBuffer),
    }
  }

  private async _saveDataOwner(dataOwner: CachedDataOwner): Promise<CachedDataOwner> {
    const ownerType = dataOwner.type
    const ownerToUpdate = dataOwner.dataOwner

    return ownerType === 'hcp'
      ? await (this.dataOwnerCache[ownerToUpdate.id!] = this.hcpartyBaseApi
          .modifyHealthcareParty(ownerToUpdate as HealthcareParty)
          .then((x) => ({ type: 'hcp', dataOwner: x } as CachedDataOwner)))
      : ownerType === 'patient'
      ? await (this.dataOwnerCache[ownerToUpdate.id!] = this.patientBaseApi
          .modifyPatient(ownerToUpdate as Patient)
          .then((x) => ({ type: 'patient', dataOwner: x } as CachedDataOwner)))
      : await (this.dataOwnerCache[ownerToUpdate.id!] = this.deviceBaseApi
          .updateDevice(ownerToUpdate as Device)
          .then((x) => ({ type: 'device', dataOwner: x } as CachedDataOwner)))
  }

  private async createOrUpdateAesExchangeKeysFor(
    cdo: CachedDataOwner,
    decryptedAesExchangeKey: string,
    keyToEncrypt: { pubKey: CryptoKey; privKey: CryptoKey }
  ): Promise<CachedDataOwner> {
    const publicKeyHex = ua2hex(await this.RSA.exportKey(keyToEncrypt.pubKey!, 'spki'))
    const existingAesExchangeKeys = cdo.dataOwner.aesExchangeKeys ?? {}
    existingAesExchangeKeys[publicKeyHex] = await this.encryptAesKeyFor(decryptedAesExchangeKey, cdo.dataOwner, keyToEncrypt.pubKey)

    return { type: cdo.type, dataOwner: { ...cdo.dataOwner, aesExchangeKeys: existingAesExchangeKeys } } as CachedDataOwner
  }

  private async createOrUpdateTransferKeysFor(
    dataOwner: CachedDataOwner,
    decryptedAesExchangeKey: string,
    keyToEncrypt: { pubKey: CryptoKey; privKey: CryptoKey }
  ): Promise<CachedDataOwner> {
    const pubKeyToEncryptHex = ua2hex(await this.RSA.exportKey(keyToEncrypt.pubKey, 'spki'))

    const encryptedKey = ua2hex(
      await this._AES.encrypt(
        await this._AES.importKey('raw', hex2ua(decryptedAesExchangeKey)),
        (await this.RSA.exportKey(keyToEncrypt.privKey!, 'pkcs8')) as ArrayBuffer,
        decryptedAesExchangeKey
      )
    )

    const dataOwnerExistingPubKeys = Array.from(await this.getDataOwnerHexPublicKeys(dataOwner.dataOwner))

    const transferKeys = fold(dataOwnerExistingPubKeys, dataOwner.dataOwner.transferKeys ?? {}, (pubAcc, pubKeyHex) => {
      if (pubKeyHex !== pubKeyToEncryptHex) {
        const existingKeys = pubAcc[pubKeyHex] ?? {}
        existingKeys[pubKeyToEncryptHex] = encryptedKey
        pubAcc[pubKeyHex] = existingKeys
      }
      return pubAcc
    })

    return { type: dataOwner.type, dataOwner: { ...dataOwner.dataOwner, transferKeys: transferKeys } } as CachedDataOwner
  }

  private async encryptAesKeyFor(
    aesKey: string,
    dataOwner: HealthcareParty | Patient | Device,
    doNewPublicKey: CryptoKey
  ): Promise<{ [delId: string]: { [pk: string]: string } }> {
    const dataOwnerAllPubKeys = [doNewPublicKey].concat(await this.getDataOwnerPublicKeys(dataOwner))
    return this.encryptAesKeyOnlyForProvidedKeys(aesKey, dataOwner, dataOwnerAllPubKeys)
  }

  private async encryptAesKeyOnlyForProvidedKeys(
    aesKey: string,
    dataOwner: HealthcareParty | Patient | Device,
    dataOwnerPubKeys: CryptoKey[]
  ): Promise<{ [delId: string]: { [pk: string]: string } }> {
    const encryptedAesForDataOwner = await foldAsync(dataOwnerPubKeys, {} as { [pubKeyFingerprint: string]: string }, async (encrAes, pubKey) => {
      encrAes[ua2hex(await this.RSA.exportKey(pubKey, 'spki')).slice(-32)] = ua2hex(await this._RSA.encrypt(pubKey, hex2ua(aesKey)))
      return encrAes
    })

    return { [dataOwner.id!]: encryptedAesForDataOwner }
  }

  private retrieveDataOwnerInfoAfterPotentialUpdate(dataOwnerToUpdate: HealthcareParty | Patient | Device): Promise<CachedDataOwner> {
    this.emptyHcpCache(dataOwnerToUpdate.id!)

    return this.getDataOwner(dataOwnerToUpdate.id!).then(({ type, dataOwner }) => {
      return {
        type: type,
        dataOwner: {
          ...dataOwner,
          transferKeys: dataOwnerToUpdate.transferKeys,
          hcPartyKeys: fold(Object.entries(dataOwnerToUpdate.hcPartyKeys ?? {}), dataOwner.hcPartyKeys ?? {}, (acc, [delegateId, hcKeys]) => {
            acc[delegateId] = hcKeys
            return acc
          }),
          aesExchangeKeys: fold(
            Object.entries(dataOwnerToUpdate.aesExchangeKeys ?? {}),
            dataOwner.aesExchangeKeys ?? {},
            (pubAcc, [pubKey, newAesExcKeys]) => {
              const existingKeys = pubAcc[pubKey] ?? {}
              pubAcc[pubKey] = fold(Object.entries(newAesExcKeys), existingKeys, (delAcc, [delId, delKeys]) => {
                delAcc[delId] = delKeys
                return delAcc
              })
              return pubAcc
            }
          ),
        },
      } as CachedDataOwner
    })
  }

  private async sendMaintenanceTasks(
    maintenanceTaskApi: IccMaintenanceTaskXApi,
    user: User,
    dataOwner: HealthcareParty | Patient | Device,
    newPublicKey: CryptoKey
  ): Promise<MaintenanceTask[]> {
    const hexNewPubKey = ua2hex(await this.RSA.exportKey(newPublicKey, 'spki'))
    const nonAccessiblePubKeys = Array.from(this.getDataOwnerHexPublicKeys(dataOwner).values())
      .filter((existingPubKey) => existingPubKey != hexNewPubKey)
      .filter(async (existingPubKey) => (await this.getPublicKeysAsSpki()).find((pubKey) => pubKey == existingPubKey) == undefined)

    if (nonAccessiblePubKeys.length) {
      const tasksForDelegates = Object.entries(await this.getEncryptedAesExchangeKeysForDelegate(dataOwner.id!))
        .filter(([delegatorId]) => delegatorId != dataOwner.id)
        .flatMap(([delegatorId, delegatorKeys]) => {
          return Object.entries(delegatorKeys).flatMap(([, aesExchangeKeys]) => {
            return Object.keys(aesExchangeKeys).map((delegatePubKey) => {
              return { delegateId: delegatorId, maintenanceTask: this.createMaintenanceTask(dataOwner, delegatePubKey) }
            })
          })
        })

      const tasksForDelegator = (await this._getDelegateIdsOf(dataOwner))
        .filter((delegateId) => delegateId != dataOwner.id)
        .map((delegateId) => {
          return { delegateId: delegateId, maintenanceTask: this.createMaintenanceTask(dataOwner, hexNewPubKey) }
        })

      return await tasksForDelegates.concat(tasksForDelegator).reduce(async (existingTasks, task) => {
        const taskToCreate = await maintenanceTaskApi?.newInstance(user, task.maintenanceTask, [task.delegateId])
        const createdTask: MaintenanceTask = taskToCreate ? await maintenanceTaskApi?.createMaintenanceTaskWithUser(user, taskToCreate) : undefined
        return createdTask ? (await existingTasks).concat(createdTask) : await existingTasks
      }, Promise.resolve([] as MaintenanceTask[]))
    } else {
      return []
    }
  }

  private createMaintenanceTask(concernedDataOwner: HealthcareParty | Patient | Device, concernedPubKey: string) {
    return new MaintenanceTask({
      id: this.randomUuid(),
      taskType: 'KEY_PAIR_UPDATE',
      status: MaintenanceTask.StatusEnum.Pending,
      properties: [
        new PropertyStub({
          id: 'dataOwnerConcernedId',
          type: new PropertyTypeStub({ type: PropertyTypeStub.TypeEnum.STRING }),
          typedValue: new TypedValueObject({
            type: TypedValueObject.TypeEnum.STRING,
            stringValue: concernedDataOwner.id,
          }),
        }),
        new PropertyStub({
          id: 'dataOwnerConcernedPubKey',
          type: new PropertyTypeStub({ type: PropertyTypeStub.TypeEnum.STRING }),
          typedValue: new TypedValueObject({
            type: TypedValueObject.TypeEnum.STRING,
            stringValue: concernedPubKey,
          }),
        }),
      ],
    })
  }

  private getDataOwnerHexPublicKeys(dataOwner: HealthcareParty | Patient | Device): Set<string> {
    return new Set(
      (dataOwner.publicKey ? [dataOwner.publicKey] : [])
        .concat(dataOwner.aesExchangeKeys ? Object.keys(dataOwner.aesExchangeKeys) : [])
        .filter((pubKey) => !!pubKey)
    )
  }

  private async getDataOwnerPublicKeys(dataOwner: HealthcareParty | Patient | Device): Promise<CryptoKey[]> {
    return await Promise.all(
      Array.from(this.getDataOwnerHexPublicKeys(dataOwner)).map(
        async (pubKey) => await this._RSA.importKey('jwk', spkiToJwk(hex2ua(pubKey)), ['encrypt'])
      )
    )
  }

  /**
   * @deprecated You don't need to manually generate exchange keys as they will be automatically created by the api when needed.
   * Note that this method has some changes compared to previous version:
   * - The method may return any data owner (including devices)
   * - The method will throw an exception if the provided ownerId does not match the current data owner
   */
  async generateKeyForDelegate(ownerId: string, delegateId: string): Promise<DataOwner> {
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) {
      throw 'You can only create delegation where the delegator is the current data owner'
    }
    return (
      (await this.exchangeKeysManager.getOrCreateEncryptionExchangeKeysTo(delegateId)).updatedDelegator?.dataOwner ??
      (await this.dataOwnerApi.getDataOwner(ownerId))
    )
  }

  /**
   * @deprecated replace with {@link IccDataOwnerXApi.getDataOwner}. Note that data owners are not cached anymore.
   */
  getDataOwner(ownerId: string, loadIfMissingFromCache: boolean = true) {
    return this.dataOwnerApi.getDataOwner(ownerId)
  }

  /**
   * @deprecated the crypto api will automatically verify on startup the validity of private keys. Currently, the api only verifies if there are
   * verified private keys (in the meaning of safe for encryption), but if you think there may be situations where the keypair could be corrupted and
   * encryption->decryption may give invalid results we can also include this test.
   */
  async checkPrivateKeyValidity(dataOwner: HealthcareParty | Patient | Device): Promise<boolean> {
    const publicKeys = Array.from(new Set([dataOwner.publicKey].concat(Object.keys(dataOwner.aesExchangeKeys ?? {})).filter((x) => !!x))) as string[]

    return await publicKeys.reduce(async (pres, publicKey) => {
      const res = await pres
      try {
        const k = await this._RSA.importKey('jwk', spkiToJwk(hex2ua(publicKey)), ['encrypt'])
        const cipher = await this._RSA.encrypt(k, utf8_2ua('shibboleth'))
        const ikp = await this.getCachedRsaKeyPairForFingerprint(dataOwner.id!, publicKey.slice(-32))
        const plainText = ua2utf8(await this._RSA.decrypt(ikp.privateKey, new Uint8Array(cipher)))
        return plainText === 'shibboleth' || res
      } catch (e) {
        return res
      }
    }, Promise.resolve(false))
  }

  private throwDetailedExceptionForInvalidParameter(argName: string, argValue: any, methodName: string, methodArgs: any) {
    if (argValue) return

    let details = '\nMethod name: icc-crypto-x-api.' + methodName + '()\nArguments:'

    if (methodArgs) {
      try {
        const argsArray = [...methodArgs]
        _.each(argsArray, (arg, index) => (details += '\n[' + index + ']: ' + JSON.stringify(arg)))
      } catch (ex) {
        details += '; a problem occured while logging arguments details: ' + ex
      }
    }

    throw '### THIS SHOULD NOT HAPPEN: ' + argName + ' has an invalid value: ' + argValue + details
  }

  /**
   * @deprecated (See {@link extractEncryptionsSKs} for a detailed explanation) Use only for attachment encryption keys and replace with:
   * - {@link EntitiesEncryption.encryptionKeysOf} in {@link entities} to get the encryption keys.
   * - {@link IccDataOwnerXApi.getCurrentDataOwnerHierarchyIds} to get the full hierarchy for the current data owner (cached). The first element is
   *   the id of the topmost parent, while the last is the current data owner.
   */
  async getEncryptionDecryptionKeys(dataOwnerId: string, document: EncryptedEntity): Promise<Array<string> | undefined> {
    return this.entities.encryptionKeysOf(document, dataOwnerId)
  }

  /**
   * @deprecated For the encryption/decryption of iCure entities you should rely solely on the extended apis methods. For encryption/decryption of
   * attachments you should use the following methods instead:
   * - {@link EntitiesEncryption.encryptWithKey} to encrypt data with a specific key
   * - {@link EntitiesEncryption.encryptDataOf} to encrypt data using a key which is retrieved automatically from the entity
   * - {@link EntitiesEncryption.decryptWithKey} to encrypt data with a specific key
   * - {@link EntitiesEncryption.decryptDataOf} to encrypt data using a key which is retrieved automatically from the entity
   */
  async encryptDecrypt(
    method: 'encrypt' | 'decrypt',
    content: Uint8Array | ArrayBuffer,
    edKey?: string,
    user?: User,
    documentObject?: Document
  ): Promise<Uint8Array | Array<any> | any> {
    if (!content || !(edKey || (user?.healthcarePartyId && documentObject))) return content

    if (edKey) {
      const importedEdKey = await this._AES.importKey('raw', hex2ua(edKey.replace(/-/g, '')))
      try {
        return await this._AES[method](importedEdKey, content)
      } catch (e) {
        return content
      }
    }

    const encryptionKeys = await this.entities.encryptionKeysOf(documentObject!, user?.healthcarePartyId!)
    const importedEdKey = await this._AES.importKey('raw', hex2ua(encryptionKeys[0].replace(/-/g, '')))
    try {
      return await this._AES[method](importedEdKey, content)
    } catch (e) {
      return content
    }
  }
}
