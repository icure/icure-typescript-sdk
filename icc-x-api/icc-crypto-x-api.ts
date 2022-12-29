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
import { KeyManager } from './crypto/KeyManager'
import { DataOwner, DataOwnerWithType, IccDataOwnerXApi } from './icc-data-owner-x-api'
import { EntitiesEncryption } from './crypto/EntitiesEncryption'
import { IcureStorageFacade } from './storage/IcureStorageFacade'
import { ShamirKeysManager } from './crypto/ShamirKeysManager'
import { IccHcpartyApi } from '../icc-api'
import { StorageEntryKeysFactory } from './storage/StorageEntryKeysFactory'
import { ConfidentialEntities } from './crypto/ConfidentialEntities'

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
  private readonly keyManager: KeyManager
  private readonly dataOwnerApi: IccDataOwnerXApi
  private readonly entitiesEncrypiton: EntitiesEncryption
  private readonly confidentialEntities: ConfidentialEntities
  private readonly icureStorage: IcureStorageFacade
  private readonly shamirManager: ShamirKeysManager
  private readonly _storage: StorageFacade<string>
  private readonly _keyStorage: KeyStorageFacade

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

  get entities(): EntitiesEncryption {
    return this.entitiesEncrypiton
  }

  get confidential(): ConfidentialEntities {
    return this.confidentialEntities
  }

  get userKeysManager(): KeyManager {
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
    keyManager: KeyManager,
    dataOwnerApi: IccDataOwnerXApi,
    entitiesEncrypiton: EntitiesEncryption,
    shamirManager: ShamirKeysManager,
    storage: StorageFacade<string>,
    keyStorage: KeyStorageFacade,
    icureStorageFacade: IcureStorageFacade,
    hcPartyBaseApi: IccHcpartyApi,
    confidentialEntities: ConfidentialEntities
  ) {
    this.exchangeKeysManager = exchangeKeysManager
    this.cryptoPrimitives = cryptoPrimitives
    this.keyManager = keyManager
    this.dataOwnerApi = dataOwnerApi
    this.entitiesEncrypiton = entitiesEncrypiton
    this.shamirManager = shamirManager
    this._storage = storage
    this._keyStorage = keyStorage
    this.icureStorage = icureStorageFacade
    this.hcpartyBaseApi = hcPartyBaseApi
    this.confidentialEntities = confidentialEntities
  }

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
      const selfKeys = this.dataOwnerApi.getHexPublicKeysOf((await this.dataOwnerApi.getCurrentDataOwner()).dataOwner)
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
   * @deprecated Usually you should not need this method, since the preferred sfk is automatically chosen by the extended entity apis when creating a
   * new instance of the entity. If you still need this method you can replace it with the methods available at {@link confidential}:
   * - {@link ConfidentialEntities.getConfidentialSecretId} if you were calling this method with `confidential = true`
   * - {@link ConfidentialEntities.getAnySecretIdSharedWithParents} if you were calling this method with `confidential = false`
   */
  async extractPreferredSfk(parent: EncryptedParentEntity, hcpartyId: string, confidential: boolean) {
    return confidential ? this.confidential.getConfidentialSecretId(parent, hcpartyId) : this.confidential.getAnySecretIdSharedWithParents(parent)
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
   * @deprecated you should not need this method anymore because everything related to entities encryption should be done either through the
   * entity-specific extended api or through the {@link EntitiesEncryption} object available at {@link entities}. Please contact us if you have a
   * scenario where you really need to get the exchange keys for the user.
   * Note that currently this method does not cache results anymore (but the updated methods do).
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
    const { updatedEntity, rawEncryptionKey } = await this.entities.entityWithInitialisedEncryptedMetadata(
      {
        ...createdObject,
        delegations: undefined,
        encryptionKeys: undefined,
        cryptedForeignKeys: undefined,
        secretForeignKeys: undefined,
      } as EncryptedEntity,
      undefined,
      undefined,
      true
    )
    return {
      encryptionKeys: updatedEntity.encryptionKeys,
      secretId: rawEncryptionKey!,
    }
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
   * @deprecated use {@link IccIcureMaintenanceXApi.applyKeyPairUpdate} instead.
   */
  async giveAccessBackTo(delegateUser: User, ownerId: string, ownerNewPublicKey: string): Promise<DataOwnerWithType> {
    await this.exchangeKeys.base.giveAccessBackTo(ownerId, ownerNewPublicKey, this.userKeysManager.getDecryptionKeys())
    return this.dataOwnerApi.getDataOwner(ownerId)
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
   * - {@link EntitiesEncryption.encryptDataOf} to encrypt entity-specific data using a key which is retrieved automatically from the entity.
   * - {@link AES.encryptWithRawKey} to encrypt data with a specific key
   * - {@link EntitiesEncryption.decryptDataOf} to decrypt entity-specific data using a key which is retrieved automatically from the entity. This
   *   method also allows to specify a validator to verify the data matches the predicted pattern (e.g. is a plain text file utf-8), which allows to
   *   better identify decryptions with bad keys and allows to try other keys instead of returning invalid data.
   * - {@link AES.decryptWithRawKey} to decrypt data with a specific key
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

    const encryptionKeys = await this.entities.encryptionKeysOf(documentObject!, user?.healthcarePartyId!)
    const importedEdKey = await this.primitives.AES.importKey('raw', hex2ua(encryptionKeys[0].replace(/-/g, '')))
    try {
      return await this.primitives.AES[method](importedEdKey, content)
    } catch (e) {
      return content
    }
  }

  /**
   * Store keypair in storage
   *
   * @param id
   * @param keyPair should be JWK
   *
   * @deprecated use storage.setItem instead
   */
  storeKeyPair(id: string, keyPair: { publicKey: any; privateKey: any }) {
    this._storage.setItem(this.rsaLocalStoreIdPrefix + id, JSON.stringify(keyPair))
  }

  fixAesExchangeKeyEntriesToFingerprints(aesExchangeKeys: { [delegatorPubKey: string]: { [delegateId: string]: { [pubKeyFp: string]: string } } }): {
    [delegatorPubKey: string]: { [delegateId: string]: { [pubKeyFp: string]: string } }
  } {
    return Object.fromEntries(
      Object.entries(aesExchangeKeys).map(([delegatorPubKey, allDelegates]) => [
        delegatorPubKey,
        Object.fromEntries(
          Object.entries(allDelegates).map(([delegateId, keyEntries]) => [
            delegateId,
            Object.fromEntries(Object.entries(keyEntries).map(([publicKey, encryptedValue]) => [publicKey.slice(-32), encryptedValue])),
          ])
        ),
      ])
    )
  }
}
