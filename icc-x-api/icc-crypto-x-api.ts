/* eslint-disable */
import { AESUtils } from './crypto/AES'
import { KeyPair, RSAUtils } from './crypto/RSA'
import { ShamirClass } from './crypto/shamir'
import * as _ from 'lodash'
import { Delegation, Device, Document, EncryptedEntity, EncryptedParentEntity, HealthcareParty, Patient, User } from '../icc-api/model/models'
import { b2a, b64_2uas, hex2ua, string2ua, ua2hex, ua2string, ua2utf8, utf8_2ua } from './utils/binary-utils'
import { keyPairFromPrivateKeyJwk, pkcs8ToJwk, spkiToJwk } from './utils'
import { StorageFacade } from './storage/StorageFacade'
import { KeyStorageFacade } from './storage/KeyStorageFacade'
import { ExchangeKeysManager } from './crypto/ExchangeKeysManager'
import { CryptoPrimitives } from './crypto/CryptoPrimitives'
import { UserEncryptionKeysManager } from './crypto/UserEncryptionKeysManager'
import { DataOwner, DataOwnerWithType, IccDataOwnerXApi } from './icc-data-owner-x-api'
import { ExtendedApisUtils } from './crypto/ExtendedApisUtils'
import { IcureStorageFacade } from './storage/IcureStorageFacade'
import { ShamirKeysManager } from './crypto/ShamirKeysManager'
import { IccHcpartyApi } from '../icc-api'
import { StorageEntryKeysFactory } from './storage/StorageEntryKeysFactory'
import { ConfidentialEntities } from './crypto/ConfidentialEntities'
import { encryptedEntityClassOf, entityWithDelegationTypeNames } from './utils/EntityWithDelegationTypeName'
import { ExchangeDataManager } from './crypto/ExchangeDataManager'
import { AccessControlKeysHeadersProvider } from './crypto/AccessControlKeysHeadersProvider'

interface DelegatorAndKeys {
  delegatorId: string
  key: CryptoKey
  rawKey: string
}

export class IccCryptoXApi {
  keychainLocalStoreIdPrefix = 'org.taktik.icure.ehealth.keychain.'
  keychainValidityDateLocalStoreIdPrefix = 'org.taktik.icure.ehealth.keychain-date.'
  hcpPreferenceKeyEhealthCert = 'eHealthCRTCrypt'
  hcpPreferenceKeyEhealthCertDate = 'eHealthCRTDate'
  rsaLocalStoreIdPrefix = 'org.taktik.icure.rsa.'
  private readonly exchangeKeysManager: ExchangeKeysManager
  private readonly cryptoPrimitives: CryptoPrimitives
  private readonly keyManager: UserEncryptionKeysManager
  private readonly dataOwnerApi: IccDataOwnerXApi
  private readonly xapiUtils: ExtendedApisUtils
  private readonly confidentialEntities: ConfidentialEntities
  private readonly icureStorage: IcureStorageFacade
  private readonly shamirManager: ShamirKeysManager
  private readonly _storage: StorageFacade<string>
  private readonly _keyStorage: KeyStorageFacade
  private readonly exchangeDataManager: ExchangeDataManager
  private readonly _accessControlKeysHeaders: AccessControlKeysHeadersProvider

  private readonly hcpartyBaseApi: IccHcpartyApi

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

  /**
   * @internal this is for internal use only and may be changed without notice.
   */
  get xapi(): ExtendedApisUtils {
    return this.xapiUtils
  }

  /**
   * @internal this is for internal use only and may be changed without notice.
   */
  get exchangeData(): ExchangeDataManager {
    return this.exchangeDataManager
  }

  /**
   * @internal this is for internal use only and may be changed without notice.
   */
  get confidential(): ConfidentialEntities {
    return this.confidentialEntities
  }

  /**
   * @internal this is for internal use only and may be changed without notice.
   */
  get accessControlKeysHeaders(): AccessControlKeysHeadersProvider {
    return this._accessControlKeysHeaders
  }

  get userKeysManager(): UserEncryptionKeysManager {
    return this.keyManager
  }

  get shamirKeysManager(): ShamirKeysManager {
    return this.shamirManager
  }

  /**
   * @internal
   */
  constructor(
    exchangeKeysManager: ExchangeKeysManager,
    cryptoPrimitives: CryptoPrimitives,
    keyManager: UserEncryptionKeysManager,
    dataOwnerApi: IccDataOwnerXApi,
    entitiesEncrypiton: ExtendedApisUtils,
    shamirManager: ShamirKeysManager,
    storage: StorageFacade<string>,
    keyStorage: KeyStorageFacade,
    icureStorageFacade: IcureStorageFacade,
    hcPartyBaseApi: IccHcpartyApi,
    confidentialEntities: ConfidentialEntities,
    exchangeDataManager: ExchangeDataManager,
    accessControlKeysHeaders: AccessControlKeysHeadersProvider
  ) {
    this.exchangeKeysManager = exchangeKeysManager
    this.cryptoPrimitives = cryptoPrimitives
    this.keyManager = keyManager
    this.dataOwnerApi = dataOwnerApi
    this.xapiUtils = entitiesEncrypiton
    this.shamirManager = shamirManager
    this._storage = storage
    this._keyStorage = keyStorage
    this.icureStorage = icureStorageFacade
    this.hcpartyBaseApi = hcPartyBaseApi
    this.confidentialEntities = confidentialEntities
    this.exchangeDataManager = exchangeDataManager
    this._accessControlKeysHeaders = accessControlKeysHeaders
  }

  /**
   * Deletes values cached by the crypto api, to allow to detect changes in stored key pairs, exchange keys and/or current data owner details.
   * This method may be useful in cases where a user is logged in from multiple devices or in cases where other users have just shared some data with
   * the current user for the first time.
   */
  async forceReload() {
    this.exchangeKeysManager.clearCache(true)
    await this.exchangeDataManager.clearOrRepopulateCache()
    this.dataOwnerApi.clearCurrentDataOwnerIdsCache()
    await this.keyManager.reloadKeys()
  }

  /**
   * @deprecated depending on your use case you should delete the calls to this method or call {@link forceReload}: remove the call if the main goal
   * was to reload the data owner, as data owners are not cached anymore. If you want to reload data after a user has logged in from another
   * device or after another user has shared data with the current user, call {@link forceReload} instead.
   */
  emptyHcpCache(hcpartyId: string) {
    this.exchangeKeysManager.clearCache(false)
  }

  /**
   * @deprecated you should not need this method anymore to deal with the encryption of iCure entities because everything related to entities
   * encryption should be done either through the entity-specific extended api.
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
   *   - you can replicate the current behaviour using {@link UserEncryptionKeysManager.getCurrentUserHierarchyAvailablePublicKeysHex} (the key manager is available
   *     at {@link userKeysManager}). This includes keys for the current user and his parents.
   *   - use {@link UserEncryptionKeysManager.getCurrentUserAvailablePublicKeysHex} to get public keys only for the current data owner, ignoring any keys of the
   *     parent hierarchy. In this case you can also apply a filter to only get verified keys (safe for encryption).
   * - If you need all public keys for the data owner, including those for which there is no corresponding private key available on the device use
   *   {@link IccDataOwnerXApi.getHexPublicKeysOf} with the current data owner. If you don't have it available you may get it from
   *   {@link IccDataOwnerXApi.getCurrentDataOwner}, but this will require to do a request to the iCure server (other options use only cached data).
   */
  async getPublicKeys(): Promise<string[]> {
    return this.userKeysManager.getCurrentUserHierarchyAvailablePublicKeysHex()
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
  async encryptShamirRSAKey(hcp: HealthcareParty, notaries: Array<HealthcareParty>, threshold?: number): Promise<HealthcareParty> {
    const legacyKeyFp = hcp.publicKey?.slice(-32)
    if (!legacyKeyFp) throw new Error(`No legacy/default key for hcp ${hcp.id}`)
    return (
      await this.shamirKeysManager.updateSelfSplits(
        { [legacyKeyFp]: { notariesIds: notaries.map((x) => x.id!), minShares: threshold ?? notaries.length } },
        []
      )
    ).dataOwner
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

        decryptedPrivatedKey = this.primitives.shamir.combine(decryptedShares)
      }

      const importedPrivateKey = await this.primitives.RSA.importKey('pkcs8', hex2ua(decryptedPrivatedKey), ['decrypt'])
      const importedPublicKey = await this.primitives.RSA.importKey('spki', hex2ua(hcp.publicKey!), ['encrypt'])

      const exportedKeyPair = await this.primitives.RSA.exportKeys({ publicKey: importedPublicKey, privateKey: importedPrivateKey }, 'jwk', 'jwk')
      await this._keyStorage.storeKeyPair(`${this.rsaLocalStoreIdPrefix}${hcp.id!}`, exportedKeyPair)
    } catch (e) {
      console.log('Cannot decrypt shamir RSA key')
    }
  }

  /**
   * @deprecated you should not need this method anymore because everything related to entities encryption should be done either through the
   * entity-specific extended api.
   */
  async decryptHcPartyKey(
    loggedHcPartyId: string,
    delegatorId: string,
    delegateHcPartyId: string,
    publicKey: string,
    encryptedHcPartyKeys: { [key: string]: string },
    publicKeys: string[]
  ): Promise<DelegatorAndKeys> {
    if (!publicKeys.length) {
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
   * @deprecated you should not need this method anymore because everything related to entities encryption should be done either through the
   * entity-specific extended api.
   */
  async cacheKeyPair(keyPairInJwk: KeyPair<JsonWebKey>): Promise<KeyPair<CryptoKey>> {
    const cryptoKeyPair = await this.primitives.RSA.importKeyPair('jwk', keyPairInJwk.privateKey, 'jwk', keyPairInJwk.publicKey)
    const pubHex = ua2hex(await this.primitives.RSA.exportKey(cryptoKeyPair.publicKey, 'spki'))
    const fingerprint = pubHex.slice(-32)
    if (!this.keyManager.getDecryptionKeys()[fingerprint]) {
      const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
      const selfKeys = this.dataOwnerApi.getHexPublicKeysOf((await this.dataOwnerApi.getCurrentDataOwner()).dataOwner)
      if (!selfKeys.has(pubHex))
        throw new Error(
          `Impossible to add key pair with fingerprint ${fingerprint} to data owner ${selfId}: the data owner has no matching public key`
        )
      await this.icureStorage.saveKey(selfId, fingerprint, keyPairInJwk, true)
      // Force reload to check if more private keys can be recovered or more exchange keys become available.
      await this.forceReload()
    }
    return cryptoKeyPair
  }

  /**
   * @deprecated Usually you should not need this method, since the preferred sfk is automatically chosen by the extended entity apis when creating a
   * new instance of the entity. If you still need this method you can replace it with the methods in the extended api, such as:
   * - {@link IccPatientXApi.getSecretIdsOf} to get all (confidential and non-confidential) secret ids of a patient
   * - {@link IccPatientXApi.getConfidentialSecretIdsOf} to get all confidential secret ids of a patient
   * - {@link IccPatientXApi.getNonConfidentialSecretIdsOf} to get all non-confidential secret ids of a patient
   */
  async extractPreferredSfk(parent: EncryptedParentEntity, hcpartyId: string, confidential: boolean) {
    const type = await encryptedEntityClassOf(parent, undefined)
    if (!type) throw new Error(`Could not determine type of entity ${JSON.stringify(parent)}`)
    return confidential
      ? this.confidential.getConfidentialSecretId({ entity: parent, type }, hcpartyId)
      : this.confidential.getAnySecretIdSharedWithParents({ entity: parent, type })
  }

  /**
   * @deprecated you should not need this method anymore because everything related to entities encryption should be done either through the
   * entity-specific extended api.
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
   * @deprecated you should not need this method anymore because everything related to entities encryption should be done either through the
   * entity-specific extended api.
   */
  async getEncryptedAesExchangeKeys(
    owner: HealthcareParty | Patient | Device,
    delegateId: string
  ): Promise<{ [pubKeyIdentifier: string]: { [pubKeyFingerprint: string]: string } }> {
    const publicKeys = Array.from(this.dataOwnerApi.getHexPublicKeysOf(owner as DataOwner))
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

  /**
   * @deprecated you should not use this method because initialisation of encrypted entities keys is done automatically by the entity-specific
   * extended api when you use newInstance. Also note that it is not possible to initialise an entity as a data owner which is not the current data
   * owner: you should instead create the entity as the current data owner then create a delegation to the other data owner.
   */
  async initEncryptionKeys(
    createdObject: any,
    ownerId: string
  ): Promise<{
    encryptionKeys: any
    secretId: string
  }> {
    throw new Error('This method is not supported anymore, consult the jsdoc for alternatives')
  }

  /**
   * @deprecated Delegation sfks have been renamed to 'secretIds' in the parent entity (but they are still secret foreign keys in children entities)
   * You should replace this method with the corresponding methods in the extended api, such as:
   * - {@link IccPatientXApi.getSecretIdsOf} to get all (confidential and non-confidential) secret ids of a patient
   * - {@link IccMessageXApi.getSecretIdsOf} to get all (confidential and non-confidential) secret ids of a patient
   * Note that the secret ids are not initialised anymore for entities that can't be referenced to by secret foreign keys: only patient (which is
   * referenced for example by Contacts and HealthElements) and Message (which is referenced by Documents) will have secret ids.
   */
  async extractDelegationsSFKs(document: EncryptedEntity | null, hcpartyId?: string): Promise<{ extractedKeys: Array<string>; hcpartyId?: string }> {
    if (!document || !hcpartyId) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    return {
      extractedKeys: await this.xapi.secretIdsOf({ entity: document, type: encryptedEntityClassOf(document, undefined) }, hcpartyId),
      hcpartyId: (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0],
    }
  }

  /**
   * @deprecated Crypted fks have been renamed to 'owningEntityIds', but in general in the extended apis they 'owningEntity' is replaced with the
   * actual owning entity type. You should replace this method with the corresponding methods in the extended api, such as:
   * - {@link IccContactXApi.decryptPatientIdOf} to get the id of the patient that a contact refers to
   * - {@link IccHelementXApi.decryptPatientIdOf} to get the id of the patient that a health element refers to
   * - {@link IccDocumentXApi.decryptMessageIdOf} to get the id of the message that a document refers to
   * - ...
   */
  async extractCryptedFKs(document: EncryptedEntity | null, hcpartyId: string): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    if (!document || !hcpartyId) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    return {
      extractedKeys: await this.xapi.owningEntityIdsOf({ entity: document, type: encryptedEntityClassOf(document, undefined) }, hcpartyId),
      hcpartyId: (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0],
    }
  }

  /**
   * @deprecated If you were using this method to encrypt/decrypt directly the `encryptedEntities` you should instead rely on the encrypt/decrypt
   * methods of the extended apis (note that entities are automatically decrypted when retrieved through the extended api and re-encrypted when sent
   * to the server. If instead you were using this method to get keys for encryption/decryption of attachments you should replace it with the new
   * attachment methods in the extended apis, such as:
   * - {@link IccDocumentXApi.encryptAndSetDocumentAttachment} to encrypt an attachment using the document encryption key.
   * - {@link IccReceiptXApi.getAndDecryptReceiptAttachment} to retrieve an attachment and decrypt it using the receipt encryption key.
   */
  async extractEncryptionsSKs(document: EncryptedEntity, hcpartyId: string): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    if (!document.encryptionKeys) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    return {
      extractedKeys: await this.xapi.encryptionKeysOf({ entity: document, type: encryptedEntityClassOf(document, undefined) }, hcpartyId),
      hcpartyId: (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0],
    }
  }

  /**
   * @deprecated You should not use this method anymore, and instead replace it with the appropriate methods from {@link xapi} depending on where
   * the delegations come from:
   * - If you were using {@link EncryptedEntity.delegations} consult the documentation for {@link extractDelegationsSFKs}.
   * - If you were using {@link EncryptedEntity.cryptedForeignKeys} consult the documentation for {@link extractCryptedFKs}.
   * - If you were using {@link EncryptedEntity.encryptionKeys} consult the documentation for {@link extractEncryptionsSKs}.
   */
  async extractKeysFromDelegationsForHcpHierarchy(
    dataOwnerId: string,
    objectId: string,
    delegations: { [key: string]: Array<Delegation> }
  ): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    throw new Error('This method is not supported anymore')
  }

  /**
   * @deprecated you should not need this method anymore: the new API will automatically load on startup all keys available through the key storage
   * facade and/or recoverable through transfer keys or shamir split. If you were using this method to load a key recovered through other means you
   * will need to perform the recovery in your implementation of {@link CryptoStrategies.recoverAndVerifySelfHierarchyKeys}.
   */
  async loadKeyPairsAsTextInBrowserLocalStorage(healthcarePartyId: string, privateKey: Uint8Array) {
    await this.cacheKeyPair(keyPairFromPrivateKeyJwk(pkcs8ToJwk(privateKey)))
  }

  /**
   * @deprecated refer to {@link loadKeyPairsAsTextInBrowserLocalStorage}
   */
  async loadKeyPairsAsJwkInBrowserLocalStorage(healthcarePartyId: string, privateKey: JsonWebKey) {
    await this.cacheKeyPair(keyPairFromPrivateKeyJwk(privateKey))
  }

  /**
   * @deprecated refer to {@link loadKeyPairsAsTextInBrowserLocalStorage}
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
   * @deprecated refer to {@link loadKeyPairsAsTextInBrowserLocalStorage}
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
   * @deprecated use {@link IccIcureMaintenanceXApi.applyKeyPairUpdate} instead.
   */
  async giveAccessBackTo(delegateUser: User, ownerId: string, ownerNewPublicKey: string): Promise<DataOwnerWithType> {
    await this.exchangeKeysManager.base.giveAccessBackTo(ownerId, ownerNewPublicKey, this.userKeysManager.getDecryptionKeys())
    await this.exchangeDataManager.giveAccessBackTo(ownerId, ownerNewPublicKey)
    return this.dataOwnerApi.getDataOwner(ownerId)
  }
  /**
   * @deprecated You don't need to manually generate exchange keys as they will be automatically created by the api when needed. You can customise
   * this behaviour in your implementation of {@link CryptoStrategies}
   */
  async generateKeyForDelegate(ownerId: string, delegateId: string): Promise<DataOwner> {
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) {
      throw new Error('You can only create delegation where the delegator is the current data owner')
    }
    return (
      (await this.exchangeKeysManager.getOrCreateEncryptionExchangeKeysTo(delegateId)).updatedDelegator?.dataOwner ??
      (await this.dataOwnerApi.getDataOwner(ownerId)).dataOwner
    )
  }

  /**
   * @deprecated replace with {@link IccDataOwnerXApi.getDataOwner}. Note that data owners are not cached anymore.
   */
  getDataOwner(ownerId: string, loadIfMissingFromCache: boolean = true) {
    return this.dataOwnerApi.getDataOwner(ownerId)
  }

  /**
   * @deprecated the crypto api will automatically verify on startup the validity of private keys, but in some cases you may want to verify the
   * validity of keys recovered in your implementation of {@link CryptoStrategies}: in this case the method has been replaced with
   * {@link RSA.checkKeyPairValidity}
   */
  async checkPrivateKeyValidity(dataOwner: HealthcareParty | Patient | Device): Promise<boolean> {
    const publicKeys = Array.from(new Set([dataOwner.publicKey].concat(Object.keys(dataOwner.aesExchangeKeys ?? {})).filter((x) => !!x))) as string[]

    return await publicKeys.reduce(async (pres, publicKey) => {
      const res = await pres
      try {
        const k = await this.primitives.RSA.importKey('jwk', spkiToJwk(hex2ua(publicKey)), ['encrypt'])
        const cipher = await this.primitives.RSA.encrypt(k, utf8_2ua('shibboleth'))
        const ikp = await this.getCachedRsaKeyPairForFingerprint(dataOwner.id!, publicKey.slice(-32))
        const plainText = ua2utf8(await this.primitives.RSA.decrypt(ikp.privateKey, new Uint8Array(cipher)))
        return plainText === 'shibboleth' || res
      } catch (e) {
        return res
      }
    }, Promise.resolve(false))
  }

  /**
   * @deprecated Refer to the jsdoc of {@link extractEncryptionsSKs}.
   */
  async getEncryptionDecryptionKeys(dataOwnerId: string, document: EncryptedEntity): Promise<Array<string> | undefined> {
    return this.xapi.encryptionKeysOf({ entity: document, type: encryptedEntityClassOf(document, undefined) }, dataOwnerId)
  }

  /**
   * @deprecated For the encryption/decryption of iCure entities and their attachments you should rely solely on the extended apis methods. Refer to
   * {@link extractEncryptionsSKs} for more details.
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
      const importedEdKey = await this.primitives.AES.importKey('raw', hex2ua(edKey.replace(/-/g, '')))
      try {
        return await this.primitives.AES[method](importedEdKey, content)
      } catch (e) {
        return content
      }
    }

    const encryptionKeys = await this.xapi.encryptionKeysOf(
      { entity: documentObject!, type: encryptedEntityClassOf(documentObject!, 'Document') },
      user?.healthcarePartyId!
    )
    const importedEdKey = await this.primitives.AES.importKey('raw', hex2ua(encryptionKeys[0].replace(/-/g, '')))
    try {
      return await this.primitives.AES[method](importedEdKey, content)
    } catch (e) {
      return content
    }
  }

  /**
   * @deprecated refer to {@link loadKeyPairsAsTextInBrowserLocalStorage}
   */
  storeKeyPair(id: string, keyPair: { publicKey: any; privateKey: any }) {
    this._storage.setItem(this.rsaLocalStoreIdPrefix + id, JSON.stringify(keyPair))
  }
}
