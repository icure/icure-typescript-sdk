import { IccDeviceApi, IccHcpartyApi, IccPatientApi } from '../icc-api'
import { AESUtils } from './crypto/AES'
import { RSAUtils } from './crypto/RSA'
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
import {fold, jwk2spki, notConcurrent, pkcs8ToJwk, spkiToJwk, terminalNodes, graphFromEdges} from './utils'
import { IccMaintenanceTaskXApi } from './icc-maintenance-task-x-api'

/**
 * Names of all possible encrypted entity types.
 */
const encryptedEntityTypeNames: Set<EncryptedEntityTypeName> = new Set([
  "AccessLog",
  "Article",
  "CalendarItem",
  "Classification",
  "Contact",
  "Document",
  "Form",
  "HealthElement",
  "Invoice",
  "MaintenanceTask",
  "Message",
  "Patient",
  "Receipt",
  "TimeTable"
])
type EncryptedEntityTypeName = "AccessLog"
  | "Article"
  | "CalendarItem"
  | "Classification"
  | "Contact"
  | "Document"
  | "Form"
  | "HealthElement"
  | "Invoice"
  | "MaintenanceTask"
  | "Message"
  | "Patient"
  | "Receipt"
  | "TimeTable"

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

type DataOwner =
  HealthcareParty | Patient | Device

/**
 * Acts as an id for a public key, it is composed of the last 32 characters of the hexadecimal representation of a public key.
 */
type PublicKeyFingerprint = string

/**
 * Holds delegation keys that a single user has access to. Map in the form `delegatorId -> MultikeyDelegations`, where
 * `delegatorId` is the id of the user which provided the delegation.
 */
type DelegatedKeys = { [delegatorId: string]: MultikeyDelegations }

/**
 * Holds delegation keys for a specific delegate-delegator pair. Map in the form `delegatorPubKeyFingerprint -> DelegationKey`,
 * where the `delegatorPubKeyFingerprint` is used just as an id to distinguish different `DelegationKey`s
 */
type MultikeyDelegations = { [delegatorPublicKeyFingerprint: PublicKeyFingerprint]: DelegationKey }

/**
 * Contains a single AES key encrypted using multiple public keys, in order to share the AES key between a delegator and a delegate
 * user. All the public keys used for the encryption of a delegation key belong to either the delegator or the delegate.
 * Map in the form `recipientPublicKeyFingerprint -> encryptedAesKey`, where `encryptedAesKey` is the AES key of the delegation
 * encrypted using the public key which corresponds to the `recipientPublicKeyFingerprint`.
 */
type DelegationKey = { [recipientPublicKeyFingerprint: PublicKeyFingerprint]: string }

/**
 * Public-private keys pair.
 */
type KeyPair = { publicKey: CryptoKey; privateKey: CryptoKey }

/**
 * Public-private keys pair using the JWK format.
 */
type JwkKeyPair = { publicKey: JsonWebKey; privateKey: JsonWebKey }

/**
 * Secure delegation entry keys map for a specific delegate-delegator pair.
 * Map in the form `entityClass` -> `rawEncryptionKey` -> `encrypted/secure delegation key`.
 */
type SecureDelegationPairEntryKeys = {
  [entityClass in EncryptedEntityTypeName]: {
    [rawEncryptionKey: string]: string
  }
}

export class IccCryptoXApi {
  get crypto(): Crypto {
    return this._crypto
  }

  get shamir(): ShamirClass {
    return this._shamir
  }

  get RSA(): RSAUtils {
    return this._RSA
  }

  get AES(): AESUtils {
    return this._AES
  }

  hcPartyKeysCache: {
    [key: string]: DelegatorAndKeys
  } = {}

  //[delegateId][delegatorId] = delegateEncryptedHcPartyKey
  hcPartyKeysRequestsCache: { [delegateId: string]: Promise<DelegatedKeys> } = {}

  /**
   * Cache for potential keys in delegations map entries (excluding the delegateId key).
   * map in the form `delegateId` -> `delegatorId` -> `entityClass` -> `rawEncryptionKey` -> `encrypted/secure delegation key`.
   */
  secureDelegationEntryKeysCache: {
    [delegateId: string]: {
      [delegatorId: string]: Promise<SecureDelegationPairEntryKeys>
    }
  } = {}

  cacheLastDeletionTimestamp: number | undefined = undefined

  dataOwnerCache: { [key: string]: Promise<CachedDataOwner> } = {}

  emptyHcpCache(hcpartyId: string) {
    delete this.hcPartyKeysRequestsCache[hcpartyId]
    delete this.dataOwnerCache[hcpartyId]
    delete this.secureDelegationEntryKeysCache[hcpartyId]
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
  ): Promise<DelegatedKeys> {
    return (
      this.hcPartyKeysRequestsCache[delegateHcPartyId] ||
      (this.hcPartyKeysRequestsCache[delegateHcPartyId] =
        Promise.resolve().then(() => this.forceGetEncryptedAesExchangeKeysForDelegate(delegateHcPartyId)))
    )
  }

  private forceGetEncryptedAesExchangeKeysForDelegate(
    delegateHcPartyId: string
  ): Promise<DelegatedKeys> {
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
  private rsaKeyPairs: { [pubKeyFingerprint: PublicKeyFingerprint]: KeyPair } = {}

  private readonly _AES: AESUtils
  private readonly _RSA: RSAUtils
  private readonly _shamir: ShamirClass

  constructor(
    host: string,
    headers: { [key: string]: string },
    hcpartyBaseApi: IccHcpartyApi, //Init with a hcparty x api for better performances
    patientBaseApi: IccPatientApi,
    deviceBaseApi: IccDeviceApi,
    crypto: Crypto = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : ({} as Crypto)
  ) {
    this.hcpartyBaseApi = hcpartyBaseApi
    this.patientBaseApi = patientBaseApi
    this.deviceBaseApi = deviceBaseApi
    this._crypto = crypto
    this.generateKeyConcurrencyMap = {}

    this._AES = new AESUtils(crypto)
    this._RSA = new RSAUtils(crypto)
    this._shamir = new ShamirClass(crypto)
  }

  async loadAllKeysFromLocalStorage(dataOwnerId: string): Promise<void> {
    const pubKeys = this.getDataOwnerHexPublicKeys((await this.getDataOwner(dataOwnerId)).dataOwner)
    pubKeys.values()
    for (const pk of pubKeys) {
      const fingerprint = pk.slice(-32)

      if (!this.rsaKeyPairs[fingerprint]) {
        await this.cacheKeyPair(this.loadKeyPairNotImported(dataOwnerId, fingerprint))
      }
    }
  }

  async getCachedRsaKeyPairForFingerprint(
    dataOwnerId: string,
    pubKeyOrFingerprint: string | PublicKeyFingerprint
  ): Promise<KeyPair> {
    const fingerprint = pubKeyOrFingerprint.slice(-32)
    return this.rsaKeyPairs[fingerprint] ?? (await this.cacheKeyPair(this.loadKeyPairNotImported(dataOwnerId, fingerprint)))
  }

  async getPublicKeys() {
    return await Object.values(this.rsaKeyPairs).reduce(
      async (p, rsa) => {
        return (await p).concat([jwk2spki(await this.RSA.exportKey(rsa.publicKey, 'jwk'))])
      },
      Promise.resolve([] as string[])
    )
  }

  randomUuid() {
    return ((1e7).toString() + -1e3 + -4e3 + -8e3 + -1e11).replace(
      /[018]/g,
      (c) => (Number(c) ^ ((this._crypto.getRandomValues(new Uint8Array(1))! as Uint8Array)[0] & (15 >> (Number(c) / 4)))).toString(16) //Keep that inlined or you will loose the random
    )
  }

  sha256(data: ArrayBuffer | Uint8Array) {
    return this._crypto.subtle.digest('SHA-256', data)
  }

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

  /* Reconstructs the hcp's private key from the notaries' shamir shares and stores it in localstorage.
  The retrieval procedure of the shares is not designed or implemented yet.  Therefore, it currently only
  works if the private key of the notaries are stored in local storage (e.g. notaries = [hcp parent]).
   * @param hcp : the hcp whose key we want to reconstruct
   * @param notaries : holders of the shamir shares
  **/
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
                // TODO: now, we get the encrypted shares in db and decrypt them. This assumes that the
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
      this.storeKeyPair(hcp.id!, exportedKeyPair)
    } catch (e) {
      console.log('Cannot decrypt shamir RSA key')
    }
  }

  /**
   * Gets the decryptedHcPartyKey for the given encryptedHcPartyKey`
   *
   * If the decrypted key exists in the cache, retrieves it from there.
   * Otherwise, decrypts it using the RSA key of the delegator or delegate (depending on the value of `encryptedForDelegator`)
   *
   * @param loggedHcPartyId The logged DataOwner id or the id of his parent
   * @param delegatorId The id of Delegator eg, the DataOwner where this AES exchange key is stored
   * @param delegateHcPartyId The id of the delegate : the data owner for whom this aes exchange key has been created
   * @param publicKey The public key of the delegator : A unique aes exchange key is created for each public key of the delegator. This is the public key corresponding to the encryptedHcPartyKeys
   * @param encryptedHcPartyKeys The encryptedHcPartyKeys to be decrypted
   * @param publicKeys The public keys for which we might have a private key
   *
   * @returns
   * - **delegatorId** the input param  `delegatorId`
   * - **key** the decrypted `encryptedHcPartyKey`
   */

  async decryptHcPartyKey(
    loggedHcPartyId: string,
    delegatorId: string,
    delegateHcPartyId: string,
    publicKey: string,
    encryptedHcPartyKeys: DelegationKey,
    publicKeys: string[]
  ): Promise<DelegatorAndKeys> {
    if (!publicKeys.length) {
      const reason = `Cannot decrypt RSA encrypted AES HcPartyKey from ${delegatorId} to ${delegateHcPartyId}: no public key`
      console.warn(reason)
      throw new Error(reason)
    }

    const cacheKey = `${delegateHcPartyId}|${publicKey.slice(-32)}|${delegatorId}`
    const res = this.hcPartyKeysCache[cacheKey]

    if (res) {
      return res
    }

    const result = await publicKeys.reduce<Promise<void | DelegatorAndKeys>>(
      async (res, pk) => {
        const delegatorAndKeys = await res
        if (delegatorAndKeys) {
          return delegatorAndKeys
        }

        const fingerprint = pk.slice(-32)
        const keyPair = this.rsaKeyPairs[fingerprint] ?? (await this.cacheKeyPair(this.loadKeyPairNotImported(loggedHcPartyId, fingerprint)))
        if (!keyPair) {
          return
        }

        let encryptedHcPartyKey = encryptedHcPartyKeys[fingerprint]
        if (!encryptedHcPartyKey) {
          const delegate = await this.getDataOwner(delegateHcPartyId, false) //it is faster to just try to decrypt if not in cache
          if (!delegate?.dataOwner || delegate.dataOwner.publicKey?.endsWith(fingerprint)) {
            encryptedHcPartyKey = encryptedHcPartyKeys['']
          } else {
            return
          }
        }

        try {
          const decryptedAesExchangeKey = await this._RSA.decrypt(keyPair.privateKey, hex2ua(encryptedHcPartyKey))
          const importedAesExchangeKey = await this._AES.importKey('raw', decryptedAesExchangeKey)
          return (this.hcPartyKeysCache[cacheKey] = {
            delegatorId: delegatorId,
            key: importedAesExchangeKey,
            rawKey: ua2hex(new Uint8Array(decryptedAesExchangeKey)),
          })
        } catch (e) {
          const reason = `Cannot decrypt RSA encrypted AES HcPartyKey from ${delegatorId} to ${delegateHcPartyId} for pubKey ${fingerprint}: impossible to decrypt`
          console.log(reason)
        }
      },
      Promise.resolve()
    )

    const availablePublicKeys = publicKeys.filter((pk) => this.rsaKeyPairs[pk.slice(-32)])

    if (!result) {
      //Try to find another key from the transfer keys
      const hcp = (await this.getDataOwner(loggedHcPartyId))!
      // Take all transfer keys that we can decrypt and that are not associated with a public key we already know
      const candidates = Object.entries(hcp.dataOwner.transferKeys ?? {})
        .filter(([fp, _]) => availablePublicKeys.some((pk) => pk.slice(-32) === fp.slice(-32))) // only keep keys that we will be able to decrypt
        .flatMap(([pk, keys]) => Object.entries(keys).map(([k, v]) => ([pk, k, v] as [string, string, string])))
        .filter(([_, k]) => !publicKeys.some((apk) => apk.slice(-32) === k.slice(-32)))
      if (candidates.length) {
        const newPublicKeys = await candidates.reduce<Promise<string[]>>(
          async (p, [decryptionKeyFingerprint, privateKeyFingerprint, encryptedPrivateKey]) => {
            const newKeys = await p
            const aesExchangeKeys = Object.entries(hcp.dataOwner.aesExchangeKeys!).find(
              ([fp, _]) => fp.slice(-32) === privateKeyFingerprint.slice(-32)
            )?.[1][loggedHcPartyId]
            if (aesExchangeKeys) {
              const encryptedAesExchangeKey = Object.entries(aesExchangeKeys).find(
                ([fp, _]) => fp.slice(-32) === decryptionKeyFingerprint.slice(-32)
              )?.[1]
              if (encryptedAesExchangeKey) {
                const keyPair = this.rsaKeyPairs[decryptionKeyFingerprint.slice(-32)]
                if (!keyPair) {
                  return newKeys
                }
                const decryptedAesExchangeKey = await this._RSA.decrypt(keyPair.privateKey, hex2ua(encryptedAesExchangeKey))
                const importedAesExchangeKey = await this._AES.importKey('raw', decryptedAesExchangeKey)

                const decryptedPrivateKey = await this._AES.decrypt(importedAesExchangeKey, hex2ua(encryptedPrivateKey))

                const newPublicKey = Object.keys(hcp.dataOwner.aesExchangeKeys!).find((fp) => fp.slice(-32) === privateKeyFingerprint.slice(-32))!
                await this.cacheKeyPair({
                  publicKey: spkiToJwk(hex2ua(newPublicKey)),
                  privateKey: pkcs8ToJwk(decryptedPrivateKey),
                })

                return newKeys.concat([newPublicKey])
              }
            }
            return newKeys
          },
          Promise.resolve([])
        )

        if (newPublicKeys.length) {
          return await this.decryptHcPartyKey(loggedHcPartyId, delegatorId, delegateHcPartyId, publicKey, encryptedHcPartyKeys, newPublicKeys)
        }
      }

      const reason = `Cannot decrypt RSA encrypted AES HcPartyKey from ${delegatorId} to ${delegateHcPartyId}: impossible to decrypt. No private key was found or could be used to decrypt the aes exchange keys`
      console.log(reason)
      throw new Error(reason)
    }

    return result
  }

  /**
   * Cache the RSA private/public key pair for the HcP with the given id `hcPartyKeyOwner`
   */
  async cacheKeyPair(keyPairInJwk: JwkKeyPair): Promise<KeyPair> {
    const importedKeyPair = await this._RSA.importKeyPair('jwk', keyPairInJwk.privateKey, 'jwk', keyPairInJwk.publicKey)
    const pk = jwk2spki(keyPairInJwk.publicKey)
    return (this.rsaKeyPairs[pk.slice(-32)] = importedKeyPair)
  }

  /**
   * Gets the secret ID (SFKs) that should be used in the prescribed context (confidential or not) from decrypted SPKs of the given `parent`, decrypted by the HcP with the given `hcpartyId` AND by its HcP parents
   * @param parent the object of which delegations (SPKs) to decrypt
   * @param hcpartyId the id of the delegate HcP
   * TODO CHECK THIS IS CORRECT
   * @param confidential whether the key is going to be used for a confidential piece of data or not. If true only the provided hcparty will be able
   * to access it, otherwise anyone from the parent organization will have access to it.
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
          ? keys.extractedKeys.find( // Take the first key we can find which is not shared with the parent.
              (k) => !secretForeignKeys.some(({ extractedKeys, hcpartyId: parentHcpId }) => hcpartyId !== parentHcpId && extractedKeys.includes(k))
            )
          : keys.extractedKeys[0])) ||
      undefined
    )
  }

  /**
   * Gets an array of decrypted HcPartyKeys, shared between the delegate with ID `delegateHcPartyId` and the delegators in `delegatorsHcPartyIdsSet`
   *
   * 1. Get the keys for the delegateHealthCareParty (cache/backend).
   * 2. For each key in the delegators, decrypt it with the delegate's private key
   * 3. Filter out undefined keys and return them
   *
   * @param delegatorsHcPartyIdsSet array of delegator HcP IDs that could have delegated something to the HcP with ID `delegateHcPartyId`
   * @param delegateHcPartyId the HcP for which the HcPs with IDs in `delegatorsHcPartyIdsSet` could have delegated something
   * @param minCacheDurationInSeconds The minimum cache duration
   * @returns - **delegatorId** : the id of the delegator HcP that shares the **key** with the `delegateHcPartyId`
   *  - **key** the decrypted HcPartyKey, shared between **delegatorId** and `delegateHcPartyId`
   */
  async decryptAndImportAesHcPartyKeysForDelegators(
    delegatorsHcPartyIdsSet: Array<string>,
    delegateHcPartyId: string,
    minCacheDurationInSeconds: number = 60
  ): Promise<Array<DelegatorAndKeys>> {
    const delegatorIdsWithDelegatorPkFpDelegatePkFpDelegation: DelegatedKeys =
      await this.getEncryptedAesExchangeKeysForDelegate(delegateHcPartyId)
    // For each delegatorId, obtain the AES key (decrypted HcParty Key) shared with the delegate, decrypted by the delegate
    const aesExchangeKeys = (
      await Promise.all(
        delegatorsHcPartyIdsSet.map(async (delegatorId: string) => {
          const encryptedHcPartyKeysForPubKeyFingerprint = delegatorIdsWithDelegatorPkFpDelegatePkFpDelegation[delegatorId]
          if (!encryptedHcPartyKeysForPubKeyFingerprint) {
            return [] as DelegatorAndKeys[]
          }
          const decryptedKeys = await Promise.all(
            Object.entries(encryptedHcPartyKeysForPubKeyFingerprint).map(async ([delegatorPubKeyFingerprint, encryptedAesExchangeKeys]) => {
              try {
                return await this.decryptHcPartyKey(
                  delegateHcPartyId,
                  delegatorId,
                  delegateHcPartyId,
                  delegatorPubKeyFingerprint,
                  encryptedAesExchangeKeys,
                  Object.keys(this.rsaKeyPairs)
                )
              } catch (e) {
                console.log(`failed to decrypt hcPartyKey from ${delegatorId} to ${delegateHcPartyId}`)
                return
              }
            })
          )
          return decryptedKeys.filter((x) => !!x) as DelegatorAndKeys[]
        })
      )
    ).reduce((acc, x) => [...acc, ...x], [])

    if (aesExchangeKeys.length > 0) {
      return aesExchangeKeys
    }

    const nowTimestamp = +new Date()
    if (!this.cacheLastDeletionTimestamp || (nowTimestamp - this.cacheLastDeletionTimestamp) / 1000 >= minCacheDurationInSeconds) {
      delete this.hcPartyKeysRequestsCache[delegateHcPartyId]
      delete this.secureDelegationEntryKeysCache[delegateHcPartyId]
      this.cacheLastDeletionTimestamp = nowTimestamp
      return this.decryptAndImportAesHcPartyKeysForDelegators(delegatorsHcPartyIdsSet, delegateHcPartyId, minCacheDurationInSeconds)
    }

    return []
  }

  /**
   * Gets an array of decrypted HcPartyKeys from the given `delegations`, that are shared with / can be decrypted by the HcP with the given `healthcarePartyId` (or by its parents when `fallbackOnParent` is true)
   *
   * 1. Checks whether the delegations' object has a delegation for the
   * given healthCarePartyId.
   * 2. Enumerates all the delegators (delegation.owner) present in
   * the delegations.
   * 3. Decrypts delegators' keys and returns them.
   *
   * @param dataOwnerId the id of the delegate HCP
   * @param delegations delegations (can be SPKs, CFKs, EKs) for all delegates
   * @param fallbackOnParent  default true; use parent's healthCarePartyId in case there's no delegation for the `healthcarePartyId`
   * @returns
   *  - **delegatorId** the id of the delegator HcP that shares the **key** with the `healthcarePartyId`
   *  - **key** the decrypted HcPartyKey, shared between **delegatorId** and `healthcarePartyId`
   */
  async getDecryptedAesExchangeKeysOfDelegateAndParentsFromGenericDelegations(
    dataOwnerId: string,
    delegations: { [key: string]: Array<Delegation> },
    fallbackOnParent = true
  ): Promise<Array<DelegatorAndKeys>> {
    const delegationsArray = await this.getDelegationsOf(delegations, dataOwnerId)

    if (!delegationsArray.length && fallbackOnParent) {
      const { dataOwner: hcp } = await this.getDataOwner(dataOwnerId)
      const parentId = (hcp as Device | HealthcareParty).parentId
      return parentId
        ? await this.getDecryptedAesExchangeKeysOfDelegateAndParentsFromGenericDelegations(parentId, delegations)
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
   * @param createdObject the object which needs initialized delegations
   * @param parentObject parent of createdObject, if applicable. Used for initialization of `cryptedForeignKeys`
   * @param ownerId id of the object owner
   * @param secretForeignKeyOfParent secretForeignKeys of the parent object, if applicable.
   * @param entityTypeName name of the class/entity type of {@link createdObject}, must be one of {@link encryptedEntityTypeNames}. This parameter is
   * optional, but it should always be provided in order for minified code to work properly.
   */
  async initObjectDelegations(
    createdObject: EncryptedEntity,
    parentObject: any,
    ownerId: string,
    secretForeignKeyOfParent: string | null,
    entityTypeName?: EncryptedEntityTypeName
  ): Promise<{
    owner: HealthcareParty | Device | Patient
    delegations: any
    cryptedForeignKeys: any
    secretForeignKeys: any[]
    secretId: string
  }> {
    const entityClass = this.encryptedEntityClassOf(createdObject, entityTypeName)
    const publicKeys = await this.getPublicKeys()

    this.throwDetailedExceptionForInvalidParameter('createdObject.id', createdObject.id, 'initObjectDelegations', arguments)

    if (parentObject) this.throwDetailedExceptionForInvalidParameter('parentObject.id', parentObject.id, 'initObjectDelegations', arguments)

    const secretId = this.randomUuid()
    const { dataOwner: owner } = await this.getDataOwner(ownerId)
    const { owner: modifiedOwner, aesExchangeKeys } = await this.getOrCreateHcPartyKeys(owner, ownerId)
    const importedAESHcPartyKey = await this.decryptAnyAesExchangeKeyForOwner(aesExchangeKeys, ownerId, ownerId, ownerId, publicKeys)

    const encryptedDelegation = await this._AES.encrypt(
      importedAESHcPartyKey.key,
      string2ua(createdObject.id + ':' + secretId).buffer as ArrayBuffer,
      importedAESHcPartyKey.rawKey
    )
    const encryptedSecretForeignKey =
      parentObject &&
      await this._AES.encrypt(
        importedAESHcPartyKey.key,
        string2ua(createdObject.id + ':' + parentObject.id).buffer as ArrayBuffer,
        importedAESHcPartyKey.rawKey
      )
    const secureDelegationEntryKey = await this.getSecureDelegationEntryKeyFor(importedAESHcPartyKey, ownerId, entityClass)

    return {
      owner: modifiedOwner,
      delegations: {
        [secureDelegationEntryKey]: [
          {
            owner: ownerId,
            delegatedTo: ownerId,
            key: ua2hex(encryptedDelegation!),
          },
        ]
      },
      cryptedForeignKeys:
        (encryptedSecretForeignKey && {
          [secureDelegationEntryKey]: [
            {
              owner: ownerId,
              delegatedTo: ownerId,
              key: ua2hex(encryptedSecretForeignKey!),
            },
          ]
        }) || {},
      secretForeignKeys: (secretForeignKeyOfParent && [secretForeignKeyOfParent]) || [],
      secretId: secretId,
    }
  }

  private async decryptAnyAesExchangeKeyForOwner(
    aesExchangeKeys: { [p: string]: { [p: string]: string } },
    loggedHcPartyId: string,
    delegatorId: string,
    delegateHcPartyId: string,
    publicKeys: string[]
  ): Promise<DelegatorAndKeys> {
    // TODO could reuse more with decryptAllAesExchangeKeyForOwner if we had lazy evaluation
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
    }, Promise.resolve() as Promise<DelegatorAndKeys | undefined>)

    if (!importedAESHcPartyKey) {
      throw new Error(`No hcParty key can be decrypted from ${delegatorId} to ${delegateHcPartyId} using currently available private keys`)
    }
    return importedAESHcPartyKey
  }

  private async decryptAllAesExchangeKeyForOwner(
    aesExchangeKeys: { [p: string]: { [p: string]: string } },
    loggedHcPartyId: string,
    delegatorId: string,
    delegateHcPartyId: string,
    publicKeys: string[]
  ): Promise<DelegatorAndKeys[]> {
    const importedAESHcPartyKey = await Object.entries(aesExchangeKeys).reduce(
      async (acc, [publicKeyIdentifier, hcPartyKeys]) => {
        const accValue = await acc
        try {
          return [
            ...accValue,
            await this.decryptHcPartyKey(loggedHcPartyId, delegatorId, delegateHcPartyId, publicKeyIdentifier, hcPartyKeys, publicKeys)
          ]
        } catch (e) {
          return accValue
        }
      },
      Promise.resolve([] as DelegatorAndKeys[])
    )

    if (!importedAESHcPartyKey.length) {
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
   * @param modifiedObject the object of which SPKs and CFKs will be cloned, the clones will be modified and then used as returned values ; it's a 'child' of `parentObject`; will NOT be mutated
   * @param parentObject will NOT be mutated
   * @param ownerId the HcP id of the delegator
   * @param delegateId the HcP id of the delegate
   * @param secretIdOfModifiedObject the secret id used in the child object to generate its SPK
   * @param entityTypeName name of the class/entity type of {@link modifiedObject}, must be one of {@link encryptedEntityTypeNames}. This parameter is
   * optional, but it should always be provided in order for minified code to work properly.
   * @returns
   * - **delegations**  existing delegations (SPKs) of the `modifiedObject`, appended with results from step 5
   * - **cryptedForeignKeys** existing CFKs of the `modifiedObject`, appended with results from steps 6
   * - **secretId** which is the given input parameter `secretIdOfModifiedObject`
   */
  async extendedDelegationsAndCryptedForeignKeys<T extends EncryptedEntity, P extends EncryptedParentEntity>(
    //TODO: suggested name: getExtendedChildObjectSPKandCFKwithDelegationFromDelegatorToDelegate
    modifiedObject: T,
    parentObject: P | null,
    ownerId: string,
    delegateId: string,
    secretIdOfModifiedObject: string | null,
    entityTypeName?: EncryptedEntityTypeName
  ): Promise<{
    modifiedObject: T
    delegations: { [key: string]: Array<Delegation> }
    cryptedForeignKeys: { [key: string]: Array<Delegation> }
    secretId: string | null //TODO: why input parameter secretIdOfModifiedObject is returned?
  }> {
    const entityClass = this.encryptedEntityClassOf(modifiedObject, entityTypeName)

    this.throwDetailedExceptionForInvalidParameter('modifiedObject.id', modifiedObject.id, 'extendedDelegationsAndCryptedForeignKeys', arguments) //modifiedObject should never be null

    if (parentObject)
      this.throwDetailedExceptionForInvalidParameter('parentObject.id', parentObject?.id, 'extendedDelegationsAndCryptedForeignKeys', arguments)

    this.throwDetailedExceptionForInvalidParameter(
      'secretIdOfModifiedObject',
      secretIdOfModifiedObject,
      'extendedDelegationsAndCryptedForeignKeys',
      arguments
    )

    const { dataOwner: owner } = await this.getDataOwner(ownerId)
    const newDelegation = string2ua(modifiedObject.id + ':' + secretIdOfModifiedObject!).buffer as ArrayBuffer
    const newCryptedForeignKey = parentObject ? string2ua(modifiedObject.id + ':' + parentObject.id).buffer as ArrayBuffer : undefined
    let modifiedOwner: DataOwner = owner
    const updatedOwnerAndDelegations = await this.addEntryAndDeduplicateDelegationLike(
      modifiedOwner,
      delegateId,
      entityClass,
      modifiedObject.delegations || {},
      newDelegation
    )
    modifiedOwner = updatedOwnerAndDelegations.owner
    modifiedObject = modifiedObject?.id === owner.id ? (modifiedOwner as T) : modifiedObject
    const updatedOwnerAndCFK = newCryptedForeignKey ? await this.addEntryAndDeduplicateDelegationLike(
      modifiedOwner,
      delegateId,
      entityClass,
      modifiedObject.cryptedForeignKeys || {},
      newCryptedForeignKey
    ) : undefined
    if (updatedOwnerAndCFK) {
      modifiedOwner = updatedOwnerAndCFK.owner
      modifiedObject = modifiedObject?.id === owner.id ? (modifiedOwner as T) : modifiedObject
    }

    return {
      modifiedObject,
      delegations: updatedOwnerAndDelegations.delegations,
      cryptedForeignKeys: updatedOwnerAndCFK?.delegations ?? {},
      secretId: secretIdOfModifiedObject,
    }
  }

  async getEncryptedAesExchangeKeys(
    owner: DataOwner,
    delegateId: string
  ): Promise<{ [pubKeyIdentifier: string]: { [pubKeyFingerprint: string]: string } }> {
    const publicKeys = await this.getPublicKeys()
    const mapOfAesExchangeKeys = Object.entries(owner.aesExchangeKeys ?? {})
      .filter((e) => e[1][delegateId] && Object.keys(e[1][delegateId]).some((k1) => publicKeys.some((pk) => pk.endsWith(k1))))
      .reduce((map, e) => {
        const candidates = Object.entries(e[1][delegateId]) //[fingerprint of delegate pub key, key], [fingerprint of owner pub key, key]
        const [publicKeyFingerprint, encryptedAesExchangeKey] = candidates[candidates.findIndex(([k, _]) => publicKeys.some((pk) => pk.endsWith(k)))]
        return { ...map, [e[0]]: { [publicKeyFingerprint]: encryptedAesExchangeKey } }
      }, {} as { [pubKeyIdentifier: string]: { [pubKeyFingerprint: string]: string } })
    if (!owner.publicKey || mapOfAesExchangeKeys[owner.publicKey] || !owner.hcPartyKeys?.[delegateId]) {
      return mapOfAesExchangeKeys
    }
    const delegate = (await this.getDataOwner(delegateId)).dataOwner
    if (delegate.publicKey && publicKeys.includes(delegate.publicKey)) {
      return {
        ...mapOfAesExchangeKeys,
        [owner.publicKey]: { [(await this.getDataOwner(delegateId)).dataOwner.publicKey?.slice(-32)!]: owner.hcPartyKeys[delegateId][1] },
      }
    } else if (publicKeys.includes(owner.publicKey)) {
      return { ...mapOfAesExchangeKeys, [owner.publicKey]: { [owner.publicKey.slice(-32)]: owner.hcPartyKeys[delegateId][0] } }
    }
    return mapOfAesExchangeKeys
  }

  async getOrCreateHcPartyKeys(
    owner: DataOwner,
    delegateId: string
  ): Promise<{
    owner: DataOwner
    aesExchangeKeys: { [pubKeyIdentifier: string]: { [pubKeyFingerprint: string]: string } }
  }> {
    const aesExchangeKeys = await this.getEncryptedAesExchangeKeys(owner, delegateId) // These are only keys we can decrypt
    if (Object.keys(aesExchangeKeys).length) {
      return await this.ensureDelegateCanAccessKeys(owner, delegateId, aesExchangeKeys)
    }
    const modifiedOwner = await this.generateKeyForDelegate(owner.id!, delegateId)
    return { owner: modifiedOwner, aesExchangeKeys: await this.getEncryptedAesExchangeKeys(modifiedOwner, delegateId) }
  }

  /**
   * Retrieve the owners HealthCareParty key, decrypt it, and
   * use it to encrypt & initialize the "encryptionKeys" object
   * and return it.
   * @param createdObject
   * @param ownerId
   * @param entityTypeName name of the class/entity type of {@link createdObject}, must be one of {@link encryptedEntityTypeNames}. This parameter is
   * optional, but it should always be provided in order for minified code to work properly.
   */
  initEncryptionKeys(
    createdObject: EncryptedEntity,
    ownerId: string,
    entityTypeName?: EncryptedEntityTypeName
  ): Promise<{
    encryptionKeys: any
    secretId: string
  }> {
    const entityClass = this.encryptedEntityClassOf(createdObject, entityTypeName)

    this.throwDetailedExceptionForInvalidParameter('createdObject.id', createdObject.id, 'initEncryptionKeys', arguments)

    const secretId = this.randomUuid()
    return this.getDataOwner(ownerId).then(async ({ dataOwner: owner }) => {
      const publicKeys = await this.getPublicKeys()
      // TODO should we check if owner is created object like in initObjectDelegations? If yes we need to take and propagate the modified owner.
      const { aesExchangeKeys } = await this.getOrCreateHcPartyKeys(owner, ownerId)
      const importedAESHcPartyKey = await this.decryptAnyAesExchangeKeyForOwner(aesExchangeKeys, ownerId, ownerId, ownerId, publicKeys)
      const encryptedEncryptionKeys = await this._AES.encrypt(
        importedAESHcPartyKey.key,
        string2ua(createdObject.id + ':' + secretId),
        importedAESHcPartyKey.rawKey
      )
      const secureDelegationEntryKey = await this.getSecureDelegationEntryKeyFor(importedAESHcPartyKey, ownerId, entityClass)

      return {
        encryptionKeys: {
          [secureDelegationEntryKey]: [
            {
              owner: ownerId,
              delegatedTo: ownerId,
              key: ua2hex(encryptedEncryptionKeys),
            }
          ]
        },
        secretId: secretId,
      }
    })
  }

  /**
   * Gets an updated instance of the EKs of `modifiedObject`.
   * The updated EKs contain a new EK to provide delegation from delegator HcP with id `ownerId` to delegate HcP with id `delegateId`.
   * @param modifiedObject the object of which EKs will be cloned, the clone will be used to append the new EK, and then used as return value; will NOT be mutated
   * @param ownerId delegator HcP id
   * @param delegateId delegate HcP id
   * @param secretEncryptionKeyOfObject secret id for the EK (Content Encryption Key)
   * @param entityTypeName name of the class/entity type of {@link modifiedObject}, must be one of {@link encryptedEntityTypeNames}. This parameter is
   * optional, but it should always be provided in order for minified code to work properly.
   * @returns
   *   - **encryptionKeys** existing EKs of the `modifiedObject`, appended with a new EK item (owner: `ownerId`, delegatedTo: `delegateId`, encrypted key with secretId:
   *     `secretEncryptionKeyOfObject` )
   *   - **secretId** which is the given input parameter `secretEncryptionKeyOfObject`
   */
  async appendEncryptionKeys(
    //TODO: suggested name: getExtendedEKwithDelegationFromDelegatorToDelegate
    modifiedObject: EncryptedEntity,
    ownerId: string,
    delegateId: string,
    secretEncryptionKeyOfObject: string,
    entityTypeName?: EncryptedEntityTypeName
  ): Promise<{
    encryptionKeys: { [key: string]: Array<Delegation> }
    secretId: string | null //secretEncryptionKeyOfObject is returned to avoid the need for a new decryption when chaining calls
  }> {
    const entityClass = this.encryptedEntityClassOf(modifiedObject, entityTypeName)

    this.throwDetailedExceptionForInvalidParameter('modifiedObject.id', modifiedObject.id, 'appendEncryptionKeys', arguments) //modifiedObject should never be null

    this.throwDetailedExceptionForInvalidParameter('secretEncryptionKeyOfObject', secretEncryptionKeyOfObject, 'appendEncryptionKeys', arguments)

    const { dataOwner: owner } = await this.getDataOwner(ownerId)
    const { owner: modifiedOwner, delegations: updatedEncryptionKeys } = await this.addEntryAndDeduplicateDelegationLike(
      owner,
      delegateId,
      entityClass,
      modifiedObject.encryptionKeys || {},
      string2ua(modifiedObject.id + ':' + secretEncryptionKeyOfObject)
    )

    return {
      encryptionKeys: updatedEncryptionKeys,
      secretId: secretEncryptionKeyOfObject,
    }
  }

  /**
   * Gets an updated `child` object that will have its SPKs, CFKs, KSs updated to include delegations from delegator HcP with id `ownerId` to delegate HcP with id `delegateId`
   * The SFKs of `child` are not updated, so this method assumes this is not the initial delegation on the `child` object
   * The method also performs some deduplication of all types of delegations.
   * Note: this method mutates the {@link child} object.
   * @param parent the parent object of `child`; will NOT be mutated
   * @param child the object that will be mutated and returned
   * @param ownerId delegator HcP id
   * @param delegateId delegate HcP id
   * @param secretDelegationKey  the secret id used in the child object to generate the SPK
   * @param secretEncryptionKey  the secret id used in the child object to generate the EK (Content Encryption Key)
   * @param childEntityTypeName name of the class/entity type of {@link modifiedObject}, must be one of {@link encryptedEntityTypeNames}. This parameter is
   * optional, but it should always be provided in order for minified code to work properly.
   * @returns - an updated `child` object that will contain updated SPKs, CFKs, EKs
   */
  async addDelegationsAndEncryptionKeys<T extends EncryptedEntity>(
    //TODO: suggested name: updateChildGenericDelegationsFromDelegatorToDelegate
    parent: EncryptedParentEntity | null,
    child: T,
    ownerId: string,
    delegateId: string,
    secretDelegationKey: string | null,
    secretEncryptionKey: string | null,
    childEntityTypeName?: EncryptedEntityTypeName
  ): Promise<T> {
    const entityClass = this.encryptedEntityClassOf(child, childEntityTypeName)
    if (parent) this.throwDetailedExceptionForInvalidParameter('parent.id', parent.id, 'addDelegationsAndEncryptionKeys', arguments)

    this.throwDetailedExceptionForInvalidParameter('child.id', child.id, 'addDelegationsAndEncryptionKeys', arguments)

    const extendedChildObjectSPKsAndCFKs = secretDelegationKey
      ? await this.extendedDelegationsAndCryptedForeignKeys(child, parent, ownerId, delegateId, secretDelegationKey, entityClass)
      : { modifiedObject: child, delegations: child.delegations, cryptedForeignKeys: child.cryptedForeignKeys, secretId: null }
    const extendedChildObjectEKs = secretEncryptionKey
      ? await this.appendEncryptionKeys(extendedChildObjectSPKsAndCFKs.modifiedObject, ownerId, delegateId, secretEncryptionKey, entityClass)
      : { encryptionKeys: child.encryptionKeys }

    return _.assign(extendedChildObjectSPKsAndCFKs.modifiedObject, {
      delegations: extendedChildObjectSPKsAndCFKs.delegations,
      cryptedForeignKeys: extendedChildObjectSPKsAndCFKs.cryptedForeignKeys,
      encryptionKeys: extendedChildObjectEKs.encryptionKeys
    })
  }

  /**
   * Gets the secret IDs (SFKs) inside decrypted SPKs of the given `document`, decrypted by the HcP with the given `hcpartyId` AND by its HcP parents
   * @param document the object of which delegations (SPKs) to decrypt
   * @param hcpartyId the id of the delegate HcP
   * @returns
   * - **extractedKeys** array containing secret IDs (SFKs) from decrypted SPKs, from both given HcP and its parents ; can contain duplicates
   * - **hcpartyId** the given `hcpartyId` OR, if a parent exist, the HcP id of the top parent in the hierarchy  (even if that parent has no delegations)
   */
  //TODO: even if there are no delegations for parent HCP (but the parent exists), the returned hcpartyId will be the one of the parent; is this ok?
  extractDelegationsSFKs(
    //TODO: suggested name: getSecretIDsSPKofHcpAndParentsFromDocument
    document: EncryptedEntity | null,
    hcpartyId?: string
  ): Promise<{ extractedKeys: Array<string>; hcpartyId?: string }> {
    if (!document || !hcpartyId) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId }) //TODO: thow exception instead?
    }
    const delegationsForAllDelegates = document.delegations
    if (!delegationsForAllDelegates || !Object.keys(delegationsForAllDelegates).length) {
      console.log(`There is no delegation in document (${document.id})`)
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    return this.extractKeysFromDelegationsForHcpHierarchy(hcpartyId, document.id!, delegationsForAllDelegates)
  }

  /**
   * Gets the secret IDs (SFKs) inside decrypted SPKs of the given `document`, decrypted by the HcP with the given `hcpartyId` AND by its HcP parents
   * @param document the object of which delegations (SPKs) to decrypt
   * @param hcpartyId the id of the delegate HcP
   * @returns
   * - **extractedKeys** array containing secret IDs (SFKs) from decrypted SPKs, from both given HcP and its parents ; can contain duplicates
   * - **hcpartyId** the given `hcpartyId` OR, if a parent exist, the HcP id of the top parent in the hierarchy (even if that parent has no delegations)
   */
  extractSFKsHierarchyFromDelegations(
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

  extractCryptedFKs(
    //TODO: suggested name: getSecretIDsCFKofHcpAndParentsFromDocument
    document: EncryptedEntity | null,
    hcpartyId: string
  ): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    if (!document || !document.cryptedForeignKeys) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    const cfksForAllDelegates = document.cryptedForeignKeys
    if (!cfksForAllDelegates || !Object.keys(cfksForAllDelegates).length) {
      console.log(`There is no cryptedForeignKeys in document (${document.id})`)
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    return this.extractKeysFromDelegationsForHcpHierarchy(hcpartyId, document.id!, cfksForAllDelegates)
  }

  extractEncryptionsSKs(
    //TODO: suggested name: getSecretIDsEKofHcpAndParentsFromDocument
    document: EncryptedEntity,
    hcpartyId: string
  ): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    if (!document.encryptionKeys) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    const eckeysForAllDelegates = document.encryptionKeys
    if (!eckeysForAllDelegates || !Object.keys(eckeysForAllDelegates).length) {
      //console.log(`There is no encryption key in document (${document.id})`)
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    return this.extractKeysFromDelegationsForHcpHierarchy(hcpartyId, document.id!, eckeysForAllDelegates)
  }

  extractDelegationsSFKsAndEncryptionSKs(ety: EncryptedEntity, ownerId: string) {
    const delegationsSfksOwnerPromise = this.extractDelegationsSFKs(ety, ownerId).then((xks) => xks.extractedKeys) //Will climb up hierarchy
    const encryptionKeysOwnerPromise = this.extractEncryptionsSKs(ety, ownerId).then((xks) => xks.extractedKeys) //Will climb up hierarchy

    return Promise.all([delegationsSfksOwnerPromise, encryptionKeysOwnerPromise])
  }

  /**
   * Get decrypted generic secret IDs (secretIdSPKs, parentIds, secretIdEKs) from generic delegations (SPKs, CFKs, EKs)
   * 1. Get HealthCareParty from its id.
   * 2. Decrypt the keys of the given HCP.
   * 3. Decrypt the parent's key if it has parent.
   * 4. Return the decrypted key corresponding to the Health Care Party.
   * @param hcpartyId the id of the delegate HcP (including its parents) for which to decrypt `extractedKeys`
   * @param objectId the id of the object/document of which delegations to decrypt ; used just to log to console a message (Cryptographic mistake) in case the object id inside SPK, CFK, EK is different from this one
   * @param delegations generic delegations (can be SPKs, CFKs, EKs) for all delegates from where to extract `extractedKeys`
   * @returns - **extractedKeys** array containing secret IDs from decrypted generic delegations, from both HCP with given `hcpartyId` and its parents; can contain duplicates
   * - **hcpartyId** the given `hcpartyId` OR, if a parent exist, the HCP id of the top parent in the hierarchy  (even if that parent has no delegations)
   */
  //TODO: even if there are no delegations for parent HCP (but the parent exists), the returned hcpartyId will be the one of the parent
  async extractKeysHierarchyFromDelegationLikes(
    //TODO suggested name: getSecretIdsOfHcpAndParentsFromGenericDelegations
    hcpartyId: string,
    objectId: string,
    delegations: { [key: string]: Array<Delegation> }
  ): Promise<Array<{ hcpartyId: string; extractedKeys: Array<string> }>> {
    const { dataOwner: hcp } = await this.getDataOwner(hcpartyId)
    const extractedKeys = []
    const delegationsForHcParty = await this.getDelegationsOf(delegations, hcpartyId)
    if (delegationsForHcParty.length) {
      const decryptedAndImportedAesHcPartyKeys = await this.getDecryptedAesExchangeKeysOfDelegateAndParentsFromGenericDelegations(
        hcpartyId,
        delegations,
        false
      )
      const collatedAesKeysFromDelegatorToHcpartyId = decryptedAndImportedAesHcPartyKeys.reduce(
        (map, k) => ({ ...map, [k.delegatorId]: (map[k.delegatorId] ?? []).concat([k]) }),
        {} as { [key: string]: { key: CryptoKey; rawKey: string }[] }
      )
      extractedKeys.push(...(await this.decryptKeyInDelegationLikes(delegationsForHcParty, collatedAesKeysFromDelegatorToHcpartyId, objectId)))
    }

    const parentId = (hcp as HealthcareParty).parentId
    return parentId
      ? [
          ...(await this.extractKeysHierarchyFromDelegationLikes(parentId, objectId, delegations)),
          { extractedKeys: extractedKeys, hcpartyId: hcpartyId },
        ]
      : [{ extractedKeys: extractedKeys, hcpartyId: hcpartyId }]
  }

  /**
   * Get decrypted generic secret IDs (secretIdSPKs, parentIds, secretIdEKs) from generic delegations (SPKs, CFKs, EKs)
   * 1. Get Data Owner (HCP, Patient or Device) from its id.
   * 2. Decrypt the keys of the given data owner.
   * 3. Decrypt the parent's key if it has parent.
   * 4. Return the decrypted key corresponding to the Health Care Party.
   * @param dataOwnerId the id of the delegate data owner (including its parents) for which to decrypt `extractedKeys`
   * @param objectId the id of the object/document of which delegations to decrypt ; used just to log to console a message (Cryptographic mistake) in case the object id inside SPK, CFK, EK is different from this one
   * @param delegations generic delegations (can be SPKs, CFKs, EKs) for all delegates from where to extract `extractedKeys`
   * @returns
   * - **extractedKeys** array containing secret IDs from decrypted generic delegations, from both data owner with given `dataOwnerId` and its parents; can contain duplicates
   * - **dataOwnerId** the given `dataOwnerId` OR, if a parent exist, the data owner id of the top parent in the hierarchy  (even if that parent has no delegations)
   */
  //TODO: even if there are no delegations for parent HCP (but the parent exists), the returned dataOwnerId will be the one of the parent
  async extractKeysFromDelegationsForHcpHierarchy(
    //TODO suggested name: getSecretIdsOfHcpAndParentsFromGenericDelegations
    dataOwnerId: string,
    objectId: string,
    delegations: { [key: string]: Array<Delegation> }
  ): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    const delegationsForDataOwner = await this.getDelegationsOf(delegations, dataOwnerId)
    const { dataOwner: hcp } = await this.getDataOwner(dataOwnerId).catch((e) => {
      console.error(`Dataowner with id ${dataOwnerId} cannot be resolved`)
      throw e
    })
    const extractedKeys = delegationsForDataOwner.length
      ? await this.getDecryptedAesExchangeKeysOfDelegateAndParentsFromGenericDelegations(dataOwnerId, delegations, false).then(
        (decryptedAndImportedAesHcPartyKeys) => {
          const collatedAesKeysFromDelegatorToHcpartyId: {
            [key: string]: { key: CryptoKey; rawKey: string }[]
          } = {}
          decryptedAndImportedAesHcPartyKeys.forEach((k) => {
            ;(collatedAesKeysFromDelegatorToHcpartyId[k.delegatorId] ?? (collatedAesKeysFromDelegatorToHcpartyId[k.delegatorId] = [])).push(k)
          })
          return this.decryptKeyInDelegationLikes(delegationsForDataOwner, collatedAesKeysFromDelegatorToHcpartyId, objectId!)
        }
      )
      : []
    const parentExtractedKeys = (hcp as HealthcareParty).parentId
      ? await this.extractKeysFromDelegationsForHcpHierarchy((hcp as HealthcareParty).parentId!, objectId, delegations)
      : { extractedKeys: [], hcpartyId: undefined }
    return { extractedKeys: extractedKeys.concat(parentExtractedKeys.extractedKeys), hcpartyId: parentExtractedKeys.hcpartyId ?? dataOwnerId }
  }

  /**
   * Gets an array of generic secret IDs decrypted from a list of generic delegations (SPKs, CFKs, EKs) `delegationsArray`
   * If a particular generic delegation throws an exception when decrypted, the return value for its secret ID will be 'false' and a message is logged to console
   * For each one of the delegations in the `delegationsArray`, it tries to decrypt with the decryptedHcPartyKey of the owner of that delegation;
   *
   * @param delegationsArray generic delegations array
   * @param aesKeysForDataOwnerId **key** HcP ids of delegators/owners in the `delegationsArray`, each with its own decryptedHcPartyKey
   * @param masterId is the object id to which the generic delegation belongs to
   * - used only to check whether the object.id matches the one stored in the decrypted generic delegation item
   * - even if there's no match, the secret ID is kept as a valid result (and a message logged to console)
   * @returns array of generic secret IDs (secretIdSPK, parentId, secretIdEK)
   */
  async decryptKeyInDelegationLikes(
    //TODO: suggested name: getSecretIdsFromGenericDelegations
    delegationsArray: Array<Delegation>,
    aesKeysForDataOwnerId: { [key: string]: { key: CryptoKey; rawKey: string }[] },
    masterId: string
  ): Promise<Array<string>> {
    const decryptPromises: Array<Promise<string | undefined>> = delegationsArray.map(async (genericDelegationItem) => {
      const aesKeys = aesKeysForDataOwnerId[genericDelegationItem.owner!]
      if (aesKeys?.length) {
        return await aesKeys.reduce<Promise<undefined | string>>(async (acc, aesKey) => {
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
            console.log(`AES key is: ${aesKey.rawKey}. Encrypted data is ${genericDelegationItem.key}.`)

            return undefined
          }
        }, Promise.resolve(undefined))
      } else {
        console.log(`Could not find aes key for object with ID: ${masterId}`)
      }
    })
    return Promise.all(decryptPromises).then((genericSecretId) => genericSecretId.filter((id) => !!id) as string[])
  }

  getPublicKeyFromPrivateKey(privateKey: JsonWebKey, dataOwner: Patient | Device | HealthcareParty) {
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

  async loadKeyPairsAsTextInBrowserLocalStorage(healthcarePartyId: string, privateKey: Uint8Array) {
    const { dataOwner } = await this.getDataOwner(healthcarePartyId)

    const privateKeyInJwk = pkcs8ToJwk(privateKey)
    const publicKey = this.getPublicKeyFromPrivateKey(privateKeyInJwk, dataOwner)

    const keyPair: { publicKey: CryptoKey; privateKey: CryptoKey } = await this._RSA.importKeyPair(
      'jwk',
      privateKeyInJwk,
      'jwk',
      spkiToJwk(hex2ua(publicKey))
    )
    this.rsaKeyPairs[publicKey.slice(-32)] = keyPair
    const exportedKeyPair = await this._RSA.exportKeys(keyPair, 'jwk', 'jwk')

    return this.storeKeyPair(`${healthcarePartyId}.${publicKey.slice(-32)}`, exportedKeyPair)
  }

  async loadKeyPairsAsJwkInBrowserLocalStorage(healthcarePartyId: string, privateKey: JsonWebKey) {
    const { dataOwner } = await this.getDataOwner(healthcarePartyId)

    if ((!privateKey.n || !privateKey.e) && dataOwner.publicKey) {
      //Fallback on default publicKey
      console.warn('An incomplete key has been completed using the default public key of the data owner')
      const publicKeyInJwk = spkiToJwk(hex2ua(dataOwner.publicKey))
      privateKey.n = publicKeyInJwk.n
      privateKey.e = publicKeyInJwk.e
    }

    const publicKey = this.getPublicKeyFromPrivateKey(privateKey, dataOwner)

    const keyPair = await this._RSA.importKeyPair('jwk', privateKey, 'jwk', spkiToJwk(hex2ua(publicKey)))
    this.rsaKeyPairs[healthcarePartyId] = keyPair
    const exportedKeyPair = await this._RSA.exportKeys(keyPair, 'jwk', 'jwk')

    return this.storeKeyPair(`${healthcarePartyId}.${publicKey.slice(-32)}`, exportedKeyPair)
  }

  // noinspection JSUnusedGlobalSymbols
  loadKeyPairsInBrowserLocalStorage(healthcarePartyId: string, file: Blob): Promise<void> {
    const fr = new FileReader()
    return new Promise((resolve, reject) => {
      fr.onerror = reject
      fr.onabort = reject
      fr.onload = (e: any) => {
        //TODO remove any
        const privateKey = e.target.result as string
        this.loadKeyPairsAsTextInBrowserLocalStorage(healthcarePartyId, hex2ua(privateKey))
          .then(() => resolve())
          .catch(reject)
      }
      fr.readAsText(file)
    })
  }

  // noinspection JSUnusedGlobalSymbols
  saveKeychainInBrowserLocalStorage(id: string, keychain: number) {
    localStorage.setItem(
      this.keychainLocalStoreIdPrefix + id,
      b2a(new Uint8Array(keychain).reduce((data, byte) => data + String.fromCharCode(byte), ''))
    )
  }

  saveKeychainInBrowserLocalStorageAsBase64(id: string, keyChainB64: string) {
    localStorage.setItem(this.keychainLocalStoreIdPrefix + id, keyChainB64)
  }

  // noinspection JSUnusedGlobalSymbols
  saveKeychainValidityDateInBrowserLocalStorage(id: string, date: string) {
    if (!id) return

    if (!date) {
      localStorage.removeItem(this.keychainValidityDateLocalStoreIdPrefix + id)
    } else {
      localStorage.setItem(this.keychainValidityDateLocalStoreIdPrefix + id, date)
    }
  }

  /**
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

      const crt = this.getKeychainInBrowserLocalStorageAsBase64(hcp.id!!)
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

  getKeychainInBrowserLocalStorageAsBase64(id: string) {
    return localStorage.getItem(this.keychainLocalStoreIdPrefix + id)
  }

  getKeychainValidityDateInBrowserLocalStorage(id: string) {
    return localStorage.getItem(this.keychainValidityDateLocalStoreIdPrefix + id)
  }

  // noinspection JSUnusedGlobalSymbols
  loadKeychainFromBrowserLocalStorage(id: string) {
    const lsItem = localStorage.getItem('org.taktik.icure.ehealth.keychain.' + id)
    return lsItem !== null ? b64_2uas(lsItem) : null
  }

  /**
   *
   * @param id
   * @param keyPair should be JWK
   */
  storeKeyPair(id: string, keyPair: { publicKey: any; privateKey: any }) {
    if (typeof Storage === 'undefined') {
      console.log('Your browser does not support HTML5 Browser Local Storage !')
      throw 'Your browser does not support HTML5 Browser Local Storage !'
    }
    //TODO encryption
    localStorage.setItem(this.rsaLocalStoreIdPrefix + id, JSON.stringify(keyPair))
  }

  /**
   * loads the RSA key pair (hcparty) in JWK from local storage, not imported
   *
   * @param id  doc id - hcpartyId
   * @param publicKeyFingerPrint the 32 last characters of public key this private key is associated with
   * @returns {Object} it is in JWK - not imported
   */
  loadKeyPairNotImported(id: string, publicKeyFingerPrint?: PublicKeyFingerprint): JwkKeyPair {
    if (typeof Storage === 'undefined') {
      console.log('Your browser does not support HTML5 Browser Local Storage !')
      throw 'Your browser does not support HTML5 Browser Local Storage !'
    }
    //TODO decryption
    const item =
      (publicKeyFingerPrint && localStorage.getItem(this.rsaLocalStoreIdPrefix + id + '.' + publicKeyFingerPrint.slice(-32))) ??
      localStorage.getItem(this.rsaLocalStoreIdPrefix + id)
    if (!item) {
      console.warn(`No key can be found in local storage for id ${id} and publicKeyFingerPrint ${publicKeyFingerPrint}`)
    }
    return JSON.parse(item!)
  }

  /**
   * Loads and imports the RSA key pair (hcparty) from local storage
   *
   * @param id  doc id - hcPartyId
   * @returns {Promise} -> {CryptoKey} - imported RSA
   */
  loadKeyPairImported(id: string) {
    return new Promise((resolve: (value: { publicKey: CryptoKey; privateKey: CryptoKey }) => any, reject) => {
      try {
        const jwkKey = localStorage.getItem(this.rsaLocalStoreIdPrefix + id) as string
        if (jwkKey) {
          const jwkKeyPair = JSON.parse(jwkKey)
          if (jwkKeyPair.publicKey && jwkKeyPair.privateKey) {
            this._RSA.importKeyPair('jwk', jwkKeyPair.privateKey, 'jwk', jwkKeyPair.publicKey).then(resolve, (err) => {
              console.log('Error in RSA.importKeyPair: ' + err)
              reject(err)
            })
          } else {
            const message = 'Error in RSA.importKeyPair: Invalid key'
            console.log(message)
            reject(Error(message))
          }
        } else {
          const message = 'Error in RSA.importKeyPair: Missing key'
          console.log(message)
          reject(Error(message))
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  async addNewKeyPairForOwnerId(
    maintenanceTasksApi: IccMaintenanceTaskXApi,
    user: User,
    ownerId: string,
    generateTransferKey: boolean = true
  ): Promise<{ dataOwner: HealthcareParty | Patient | Device; publicKey: string; privateKey: string }> {
    return this.addNewKeyPairForOwner(maintenanceTasksApi, user, await this.getDataOwner(ownerId), generateTransferKey)
  }

  async addNewKeyPairForOwner(
    maintenanceTasksApi: IccMaintenanceTaskXApi,
    user: User,
    cdo: CachedDataOwner,
    generateTransferKey: boolean = true
  ): Promise<{ dataOwner: HealthcareParty | Patient | Device; publicKey: string; privateKey: string }> {
    const { publicKey, privateKey } = await this.RSA.generateKeyPair()
    const publicKeyHex = ua2hex(await this.RSA.exportKey(publicKey!, 'spki'))

    const gen = (await this._AES.generateCryptoKey(true)) as string

    await this.cacheKeyPair({ publicKey: await this.RSA.exportKey(publicKey!, 'jwk'), privateKey: await this.RSA.exportKey(privateKey!, 'jwk') })

    const { type: ownerType, dataOwner: ownerToUpdate } = await this.createOrUpdateAesExchangeKeysFor(cdo, gen, {
      pubKey: publicKey,
      privKey: privateKey,
    }).then((dataOwnerWithUpdatedAesKeys) =>
      generateTransferKey
        ? this.createOrUpdateTransferKeysFor(dataOwnerWithUpdatedAesKeys, gen, { pubKey: publicKey, privKey: privateKey })
        : dataOwnerWithUpdatedAesKeys
    )

    const modifiedDataOwnerAndType =
      ownerType === 'hcp'
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

    const sentMaintenanceTasks = await this.sendMaintenanceTasks(maintenanceTasksApi, user, modifiedDataOwnerAndType.dataOwner, publicKey)

    return {
      dataOwner: sentMaintenanceTasks.length
        ? await this.retrieveDataOwnerInfoAfterPotentialUpdate(modifiedDataOwnerAndType.dataOwner)
        : modifiedDataOwnerAndType.dataOwner,
      publicKey: publicKeyHex,
      privateKey: ua2hex((await this.RSA.exportKey(privateKey!, 'pkcs8')) as ArrayBuffer),
    }
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

    const dataOwnerExistingPubKeys = Array.from(this.getDataOwnerHexPublicKeys(dataOwner.dataOwner))

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

    const encrAes: { [pubKeyFingerprint: string]: string } = {}
    for (const pubKey of dataOwnerAllPubKeys) {
      encrAes[ua2hex(await this.RSA.exportKey(pubKey, 'spki')).slice(-32)] = ua2hex(await this._RSA.encrypt(pubKey, hex2ua(aesKey)))
    }

    return { [dataOwner.id!]: encrAes }
  }

  private retrieveDataOwnerInfoAfterPotentialUpdate(dataOwnerToUpdate: HealthcareParty | Patient | Device): Promise<CachedDataOwner> {
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
      .filter(
        (existingPubKey) =>
          !Object.values(this.rsaKeyPairs).find(
            async ({ publicKey, privateKey }) => ua2hex(await this.RSA.exportKey(publicKey, 'spki')) == existingPubKey
          )
      )

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

      const tasksForDelegator = Object.entries(await this.getEncryptedAesExchangeKeys(dataOwner, dataOwner.id!)).flatMap(
        ([doPubKey, delegateKeys]) => {
          return Object.keys(delegateKeys)
            .filter((delegateId) => delegateId != dataOwner.id)
            .map((delegateId) => {
              return { delegateId: delegateId, maintenanceTask: this.createMaintenanceTask(dataOwner, doPubKey) }
            })
        }
      )

      return Promise.all(
        tasksForDelegates
          .concat(tasksForDelegator)
          .map(async ({ delegateId, maintenanceTask }) => {
            const taskToCreate = await maintenanceTaskApi?.newInstance(user, maintenanceTask, [delegateId])
            return taskToCreate ? maintenanceTaskApi?.createMaintenanceTaskWithUser(user, taskToCreate) : undefined
          })
          .filter((createdTask) => createdTask != undefined)
      )
    } else {
      return []
    }
  }

  private createMaintenanceTask(concernedDataOwner: HealthcareParty | Patient | Device, concernedPubKey: string) {
    return new MaintenanceTask({
      id: this.randomUuid(),
      taskType: 'updateAesExchangeKey',
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

  private getDataOwnerHexPublicKeys(dataOwner: DataOwner): Set<string> {
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

  generateKeyForDelegate(ownerId: string, delegateId: string): PromiseLike<HealthcareParty | Patient> {
    //Preload hcp and patient because we need them and they are going to be invalidated from the caches
    return notConcurrent(this.generateKeyConcurrencyMap, ownerId, async () => {
      const [{ type: ownerType, dataOwner: owner }, { dataOwner: delegate }] = await Promise.all([
        this.getDataOwner(ownerId),
        this.getDataOwner(delegateId),
      ])

      const ownerLegacyPublicKey = owner.publicKey

      const availablePublicKeysFingerprints = Object.keys(this.rsaKeyPairs)
      const availableOwnerPublicKeys = [
        ownerLegacyPublicKey,
        ...Object.keys(owner.aesExchangeKeys || {}).filter((x) => x !== ownerLegacyPublicKey),
      ].filter((k) => !!k && availablePublicKeysFingerprints.some((fp) => k.endsWith(fp))) as string[]
      const selectedPublicKey = availableOwnerPublicKeys[0]

      if (!selectedPublicKey) {
        throw new Error(`Invalid owner, no public key, keypairs have not be set for ${ownerId}`)
      }

      if (
        ((owner.hcPartyKeys || {})[delegateId] && owner.publicKey && availablePublicKeysFingerprints.includes(owner.publicKey.slice(-32))) ||
        Object.values(owner.aesExchangeKeys || {}).some(
          (x) => x[delegateId] && Object.keys(x[delegateId]).some((k) => availablePublicKeysFingerprints.includes(k))
        )
      ) {
        return owner
      }

      let ownerCombinedAesExchangeKeys = owner.aesExchangeKeys ?? {}

      if (ownerLegacyPublicKey && !(owner.aesExchangeKeys ?? {})[ownerLegacyPublicKey]) {
        //Transfer keys from old structure (hcparty keys) to new one (aesExchangeKeys)
        const unknownDataOwnerCounterPartIds = Object.keys(owner.hcPartyKeys ?? {}).filter((x) => x !== ownerId && x !== delegateId)
        const counterParts = [
          owner,
          delegate,
          ...(await Promise.all(unknownDataOwnerCounterPartIds.map((cpid) => this.getDataOwner(cpid).then((dot) => dot.dataOwner)))),
        ]
        ownerCombinedAesExchangeKeys = {
          [ownerLegacyPublicKey]: Object.entries(owner.hcPartyKeys ?? {}).reduce(
            (map, [hcpId, keys]) => ({
              ...map,
              [hcpId]: { [ownerLegacyPublicKey]: keys[0], [counterParts.find((x) => x.id === hcpId)?.publicKey ?? '']: keys[1] }
            }),
            {}
          ),
          ...ownerCombinedAesExchangeKeys,
        }
      }

      const delegatePublicKeys = [delegate.publicKey, ...Object.keys(delegate.aesExchangeKeys ?? {}).filter((x) => x !== delegate.publicKey)].filter(
        (x) => !!x
      ) as string[]
      if (!delegatePublicKeys.length) {
        throw new Error(`Invalid delegate, no public key, keypairs have not be set for ${delegateId}`)
      }
      const genProm = this._AES.generateCryptoKey(true).then(async (AESKey) => {
        const allPubKeys = [...availableOwnerPublicKeys, ...delegatePublicKeys]
        const encryptedAesKeys = await allPubKeys.reduce(
          async (map, pubK) => ({
            ...(await map),
            [pubK.slice(-32)]: ua2hex(
              await this._RSA.encrypt(await this._RSA.importKey('jwk', spkiToJwk(hex2ua(pubK)), ['encrypt']), hex2ua(AESKey as string))
            ),
          }),
          Promise.resolve({} as { [pubKey: string]: string })
        )

        if (delegate.publicKey && ownerLegacyPublicKey) {
          owner.hcPartyKeys![delegateId] = [encryptedAesKeys[ownerLegacyPublicKey.slice(-32)], encryptedAesKeys[delegate.publicKey.slice(-32)]]
        }
        owner.aesExchangeKeys = {
          ...(ownerCombinedAesExchangeKeys ?? {}),
          [selectedPublicKey]: { ...(owner.aesExchangeKeys?.[selectedPublicKey] ?? {}), [delegateId]: encryptedAesKeys },
        }

        return new Promise<['hcp', HealthcareParty] | ['patient', Patient] | ['device', Device]>((resolve, reject) => {
          ownerType === 'hcp'
            ? (this.dataOwnerCache[owner.id!] = this.hcpartyBaseApi
                .modifyHealthcareParty(owner as HealthcareParty)
                .then((x) => ({ type: 'hcp', dataOwner: x } as CachedDataOwner)))
                .then((x) => resolve(['hcp', x.dataOwner]))
                .catch((e) => reject(e))
            : ownerType === 'patient'
            ? (this.dataOwnerCache[owner.id!] = this.patientBaseApi.modifyPatient(owner as Patient).then((x) => ({ type: 'patient', dataOwner: x })))
                .then((x) => resolve(['patient', x.dataOwner]))
                .catch((e) => reject(e))
            : (this.dataOwnerCache[owner.id!] = this.deviceBaseApi.updateDevice(owner as Device).then((x) => ({ type: 'device', dataOwner: x })))
                .then((x) => resolve(['device', x.dataOwner]))
                .catch((e) => reject(e))
        })
      })

      this.hcPartyKeysRequestsCache[delegateId] = genProm.then(() => {
        return this.forceGetEncryptedAesExchangeKeysForDelegate(delegateId)
      })
      if (this.secureDelegationEntryKeysCache[delegateId]) {
        this.rebuildSecureDelegationsCacheFor([ownerId], delegateId)
      }
      return genProm.then((res) => {
        return res[1]
      })
    })
  }

  getDataOwner(ownerId: string, loadIfMissingFromCache: boolean = true): Promise<CachedDataOwner> {
    return (
      this.dataOwnerCache[ownerId] ??
      (loadIfMissingFromCache
        ? (this.dataOwnerCache[ownerId] = this.patientBaseApi
            .getPatient(ownerId)
            .then((x) => ({ type: 'patient', dataOwner: x } as CachedDataOwner))
            .catch(() => this.deviceBaseApi.getDevice(ownerId).then((x) => ({ type: 'device', dataOwner: x } as CachedDataOwner)))
            .catch(() => this.hcpartyBaseApi.getHealthcareParty(ownerId).then((x) => ({ type: 'hcp', dataOwner: x } as CachedDataOwner)))
            .catch((e) => {
              delete this.dataOwnerCache[ownerId]
              throw e
            }))
        : undefined)
    )
  }

  // noinspection JSUnusedGlobalSymbols
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

  async getEncryptionDecryptionKeys(dataOwnerId: string, document: EncryptedEntity): Promise<Array<string> | undefined> {
    try {
      return !document.id
        ? undefined
        : _.uniq(
            (
              await this.extractKeysFromDelegationsForHcpHierarchy(
                dataOwnerId,
                document.id,
                (document.encryptionKeys && Object.keys(document.encryptionKeys).length && document.encryptionKeys) || document.delegations!
              )
            ).extractedKeys
          )
    } catch (e) {
      return undefined
    }
  }

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

    const sfks = await this.extractKeysFromDelegationsForHcpHierarchy(user?.healthcarePartyId!, documentObject?.id!, documentObject?.encryptionKeys!)
    const importedEdKey = await this._AES.importKey('raw', hex2ua(sfks.extractedKeys[0].replace(/-/g, '')))
    try {
      return await this._AES[method](importedEdKey, content)
    } catch (e) {
      return content
    }
  }

  /**
   * Gets the class of an encrypted entity. Throws error if the class can't be retrieved.
   * @param entity the entity object
   * @param declaredClassName the declared type of the entity, to use as a fallback in case the original class name can't be retrieved (for example
   * due to the use of minified code).
   * @return the class of the encrypted entity
   */
  private encryptedEntityClassOf(entity: EncryptedEntity, declaredClassName: EncryptedEntityTypeName | undefined): EncryptedEntityTypeName {
    const entityClass = this.tryGetEncryptedEntityClassOf(entity, declaredClassName)
    if (entityClass) {
      return entityClass
    } else throw new Error(
      `No valid encrypted entity class name (constructor: "${entity.constructor.name}", declared: "${declaredClassName}").` +
        `Please specify a valid class name. Valid class names are ${encryptedEntityTypeNames}.`
    )
  }

  /**
   * Gets the class of an encrypted entity. Returns undefined if the class can't be retrieved.
   * @param entity the entity object
   * @param declaredClassName the declared type of the entity, to use as a fallback in case the original class name can't be retrieved (for example
   * due to the use of minified code).
   * @return the class of the encrypted entity
   */
  private tryGetEncryptedEntityClassOf(
    entity: EncryptedEntity,
    declaredClassName: EncryptedEntityTypeName | undefined
  ): EncryptedEntityTypeName | undefined {
    const _type = (entity as any)._type
    if (_type && (typeof _type === 'string' || _type instanceof String)) {
      const splitType = _type.split(".")
      const candidate = splitType[splitType.length - 1]
      if (encryptedEntityTypeNames.has(candidate as any)) {
        if (declaredClassName && declaredClassName !== candidate) throw new Error(
          `Declared type name "${declaredClassName}" does not match type detected from field \`_type:"${_type}"\` ("${candidate}")`
        )
        return candidate as EncryptedEntityTypeName
      }
    }
    if (!declaredClassName) console.warn(
      "Usage of a delegation-related method without specifying the entity class name, and input object does not have a `_type` value. " +
      "Will use constructor name as fallback, but this may not work with minified code."
    )
    const constructorName = entity.constructor?.name
    if (encryptedEntityTypeNames.has(constructorName as any)) {
      if (declaredClassName && declaredClassName !== constructorName) throw new Error(
        `Declared type name "${declaredClassName}" does not match valid constructor name "${constructorName}"`
      )
      return constructorName as EncryptedEntityTypeName
    } else if (declaredClassName && encryptedEntityTypeNames.has(declaredClassName)) {
      return declaredClassName
    } else return undefined
  }

  /**
   * Gets the secure delegation entry keys cache, building it if not cached.
   * @param delegateId id of the delegate.
   */
  private async getOrBuildSecureDelegationsCacheFor(delegateId: string): Promise<{ [delegatorId: string]: Promise<SecureDelegationPairEntryKeys> }> {
    if (!this.secureDelegationEntryKeysCache[delegateId]) {
      const delegators = Object.keys(await this.getEncryptedAesExchangeKeysForDelegate(delegateId))
      if (!this.secureDelegationEntryKeysCache[delegateId]) {
        this.rebuildSecureDelegationsCacheFor(delegators, delegateId)
      }
    }
    return this.secureDelegationEntryKeysCache[delegateId]
  }

  /**
   * Rebuilds the secure delegation entry keys cache for a delegate and one or more delegators, while leaving the cache for other delegators
   * unaltered. The cache for the delegate must already exist, if it doesn't this method will throw an error.
   * @param delegatorsIds ids of the delegators to include in the cache.
   * @param delegateId id of the delegate
   */
  private rebuildSecureDelegationsCacheFor(delegatorsIds: string[], delegateId: string) {
    if (!this.secureDelegationEntryKeysCache[delegateId]) throw Error(
      "Can't rebuild cache for a specific delegator since no cache for delegate exists yet."
    )
    const keysPromise = this.decryptAndImportAesHcPartyKeysForDelegators(delegatorsIds, delegateId)
    delegatorsIds.forEach((delegatorId) => {
      this.secureDelegationEntryKeysCache[delegateId][delegatorId] = Promise.resolve().then(async () => {
        const delegatorKeys = (await keysPromise).filter((x) => x.delegatorId === delegatorId)
        return await Array.from(encryptedEntityTypeNames).reduce(
          async (entityAcc, entityClass) => {
            return {
              ...(await entityAcc),
              [entityClass]: await delegatorKeys.reduce(
                async (keyAcc, key) => {
                  return {
                    ...(await keyAcc),
                    [key.rawKey]: await this.getSecureDelegationEntryKeyFor(key, delegateId, entityClass)
                  }
                },
                Promise.resolve({} as {[rawKey: string]: string})
              )
            }
          },
          Promise.resolve({} as SecureDelegationPairEntryKeys)
        )
      })
    })
  }

  /**
   * Get a secure delegation entry key for a specific exchange key, delegate and entity class. Updates cached values if the required value is absent.
   * @param delegatorKey the exchange key used for the encryption of the secure delegation.
   * @param delegateId id of the delegate which uses the key.
   * @param entityClass class of the entity.
   * @return the secure key for the delegation entry.
   */
  private async getSecureDelegationEntryKeyFor(
    delegatorKey: DelegatorAndKeys,
    delegateId: string,
    entityClass: EncryptedEntityTypeName
  ): Promise<string> {
    const secureDelegations = await this.getOrBuildSecureDelegationsCacheFor(delegateId)
    const res = (await secureDelegations[delegatorKey.delegatorId])?.[entityClass]?.[delegatorKey.rawKey]
    if (res) {
      // In almost all cases we should be here
      return res
    } else {
      // If the cache was build when the private key corresponding to `delegatorKey` was not available and we get access to it later we may get here
      if (!this.secureDelegationEntryKeysCache[delegateId]) {
        // The cache may have been deleted since when we awaited last, in this case rebuild it
        await this.getOrBuildSecureDelegationsCacheFor(delegateId)
      } else {
        this.rebuildSecureDelegationsCacheFor([delegatorKey.delegatorId], delegateId)
      }
      this.secureDelegationEntryKeysCache[delegateId][delegatorKey.delegatorId].then((delegationPairCache) => {
        if (!Object.values(delegationPairCache).every((entityKeys) => !!entityKeys[delegatorKey.rawKey])) {
          console.warn("Cache rebuild was necessary due to missing key, but after rebuild key is still missing. " + delegatorKey + " " + delegateId)
        }
      })
      return this.createSecureDelegationEntryKey(delegatorKey, entityClass)
    }
  }

  /**
   * Creates key to be used in delegation entries in order to avoid leaking relationships between entities of different types.
   * The value of this entry key depends on the provided exchange key (therefore implicitly on the delegator-delegate) and on the entity class.
   * @param exchangeKey key to use for the creation of the secure delegation entry key.
   * @param entityClass class of entity this key will be for
   * @return the created key.
   */
  private async createSecureDelegationEntryKey(exchangeKey: DelegatorAndKeys, entityClass: EncryptedEntityTypeName): Promise<string> {
    // Implicitly includes the owner id and delegate id as it is encrypted using owner-delegate key
    const secureDelegationKey = await this._AES.encrypt(
        exchangeKey.key,
        string2ua(entityClass),
        exchangeKey.rawKey
    )
    return ua2hex(secureDelegationKey)
  }

  /**
   * Get all possible secure delegation entry keys for a specific delegate and optionally for a specific owner/delegator and entity class.
   * @param delegateId the id of the delegate for which you want to get the secure delegation keys.
   * @param optionalParameters may contain:
   * - **ownerId**: id of the owner/delegator of the exchange key used to encrypt the secure delegation key.
   * - **entityClass**: if present limits the result to only secure delegation keys for the specific entity class.
   * @return the secure delegation entry keys and corresponding delegator/owner for the provided delegate (and entity class and/owner if provided).
   */
  private async getSecureDelegationEntryKeysFor(
    delegateId: string,
    optionalParameters: { ownerId?: string, entityClass?: EncryptedEntityTypeName} = {}
  ): Promise<{ secureDelegationKey: string, delegator: string }[]> {
    const secureDelegations = await this.getOrBuildSecureDelegationsCacheFor(delegateId)
    const byDelegator: [string, SecureDelegationPairEntryKeys][] =
      optionalParameters.ownerId
        ? [[optionalParameters.ownerId, await secureDelegations[optionalParameters.ownerId]]]
        : await Promise.all(Object.entries(secureDelegations).map(
          ([owner, promise]) => promise.then((res) => [owner, res] as [string, SecureDelegationPairEntryKeys])
        ))
    const res: { secureDelegationKey: string, delegator: string }[] = []
    byDelegator.filter((x) => !!x).forEach(([delegator, secureDelegationPairEntryKeys]) => {
      if (optionalParameters.entityClass) {
        Object.values(secureDelegationPairEntryKeys[optionalParameters.entityClass]).forEach((secureDelegationKey) =>
          res.push({ secureDelegationKey, delegator })
        )
      } else {
        Object.values(secureDelegationPairEntryKeys).forEach((entityClassSecureDelegations) => {
          Object.values(entityClassSecureDelegations).forEach((secureDelegationKey) => res.push({ secureDelegationKey, delegator }))
        })
      }
    })
    return res
  }

  /**
   * Extract the delegations for a specific delegate from a map of all delegations of an entity. Automatically enriches Delegation objects with the
   * owner and delegate.
   * @param delegationsLike delegations (can be SPKs, CFKs, EKs) for all delegates.
   * @param delegateId the id of the delegate for which you want to get the delegations.
   * @param entityClass class of the entity these delegations belong to, not necessary but could help slightly improve performances.
   * @return all delegations for the provided delegate
   */
  private async getDelegationsOf(
    delegationsLike: { [key: string]: Array<Delegation> },
    delegateId: string,
    entityClass?: EncryptedEntityTypeName
  ): Promise<Delegation[]> {
    const secureDelegationKeys = await this.getSecureDelegationEntryKeysFor(delegateId)
    return secureDelegationKeys.reduce<Delegation[]>(
      (acc, { secureDelegationKey, delegator }) => {
        const matchingDelegations = delegationsLike[secureDelegationKey]
        if (matchingDelegations) {
          return acc.concat(
            matchingDelegations.map((d) => {
              return { ...d, owner: delegator, delegatedTo: delegateId } as Delegation
            })
          )
        } else return acc
      },
      [...delegationsLike[delegateId]] ?? []
    )
  }

  /**
   * Get the public keys corresponding to the weakest private key of the provided data owner. Normally this should only be one.
   * The weakest keys are all keys which may be recovered from other private keys the data owner has, but can't be used to recover any other key.
   * For example initially a user may only have a key `K1` which is by definition the weakest key. At some point the user may lose `K1` and will
   * create a new key `K2`. At this moment he will also add a new `transferKey` which will allow him to recover `K2` from `K1` in case he finds back
   * `K1` and loses `K2`. In this situation the weakest key is `K2`. If later the user loses both `K1` and `K2` he will create a new key `K3`, and add
   * transfer keys to allow the recovery of `K3` from `K1` or `K2`, therefore `K3` is the new weakest key.
   * @param dataOwner a data owner.
   * @return the public keys of the weakest keys of the provided data owner, or an empty set if the data owner has no transfer keys.
   */
  private weakestKeysOf(dataOwner: DataOwner): Set<string> {
    if (dataOwner.transferKeys) {
      const edges = Object.entries(dataOwner.transferKeys).flatMap(([keyFrom, keysTo]) => {
        return Object.keys(keysTo).map((keyTo) => [keyFrom, keyTo] as [string, string])
      })
      return terminalNodes(graphFromEdges(edges))
    } else return new Set([])
  }

  private async ensureDelegateCanAccessKeys(
    owner: DataOwner,
    delegateId: string,
    encryptedAesKeyMap: { [pubKeyIdentifier: string]: { [pubKeyFingerprint: string]: string } }
  ): Promise<{
    owner: DataOwner
    aesExchangeKeys: { [pubKeyIdentifier: string]: { [pubKeyFingerprint: string]: string } }
  }> {
    /*
    // TODO does it need non-concurrency?
    const delegate = await this.getDataOwner(delegateId)
    const weakestDelegateKeys = Array.from(this.weakestKeysOf(delegate))
    const validKeyIdentifiers = new Set(Object.keys(encryptedAesKeyMap))
    const inaccessibleKeys = Object.entries(owner.aesExchangeKeys ?? {})
      .filter(([identifier]) => validKeyIdentifiers.has(identifier))
      .filter(([, delegateToKeys]) => {
        const availableFingerprints = new Set(Object.keys(delegateToKeys[delegateId]).map((x) => x.slice(-32)))
        return weakestDelegateKeys.some((weakKey) => !availableFingerprints.has(weakKey.slice(-32)))
      })
    if (inaccessibleKeys.length === 0) {
      return { owner, aesExchangeKeys: encryptedAesKeyMap }
    }
    // TODO need double check on this: do I need to maintenance task? Or is that for something else?
    const weakCryptoKeys = await weakestDelegateKeys.reduce<Promise<{ [keyHex: string]: CryptoKey }>>(
      async (acc, keyHex) => {
        return {
          ...(await acc),
          [keyHex]: await this._RSA.importKey('jwk', spkiToJwk(hex2ua(keyHex)), ['encrypt'])
        }
      },
      Promise.resolve({})
    )
    const inaccessibleKeysIdentifiers = new Set(inaccessibleKeys.map((x) => x[0]))
    const decryptedInaccessibleKeys = await Object.entries(encryptedAesKeyMap)
      .filter((x) => inaccessibleKeysIdentifiers.has(x[0]))
      .reduce<Promise<{ [keyIdentifier: string]: string}>>(
        async (acc, [identifier, encryptedKeys]) => {
          const awaitedAcc = await acc
          // TODO do i swap delegator and delegate? Like in extendedDelegationsAndCryptedForeignKeys when it calls decrypt any.
          const decrypted = await this.decryptHcPartyKey(owner.id!, owner.id!, delegateId, identifier, encryptedKeys, await this.getPublicKeys())
          return {
            ...awaitedAcc,
            [identifier]: decrypted.rawKey
          }
        },
        Promise.resolve({})
      )
    const newAesKeyEntries = await inaccessibleKeys.reduce<Promise<{ [pubKeyIdentifier: string]: { [pubKeyFingerprint: string]: string }}>>(
      async (acc, [pubKeyIdentifier,]) => {
        const weakKeyEntries = await weakestDelegateKeys.reduce<Promise<{ [pubKeyFingerprint: string]: string }>>(
          async (wAcc, wKey) => {
            return {
              ...(await wAcc),
              // TODO is this ok or should i not encrypt the raw key?
              [wKey.slice(-32)]: ua2hex(await this._RSA.encrypt(weakCryptoKeys[wKey], hex2ua(decryptedInaccessibleKeys[pubKeyIdentifier])))
            }
          },
          Promise.resolve({})
        )
        return {
          ...(await acc),
          [pubKeyIdentifier]: weakKeyEntries
        }
      },
      Promise.resolve({})
    )
    const updatedOwner = await this.getDataOwner(owner.id!)
    const updatedAesKeyEntries = Object.entries(updatedOwner.dataOwner.aesExchangeKeys!).reduce(
      (accById, [identifier, delegateToKeys]) => {
        const updatedDelegateKeys = { ...delegateToKeys[delegateId] }
        if (newAesKeyEntries[identifier]) {
          Object.entries(newAesKeyEntries[identifier]).forEach(([k, v]) => { updatedDelegateKeys[k] = v })
        }
        return {
          ...accById,
          [identifier]: {
            ...delegateToKeys,
            [delegateId]: updatedDelegateKeys
          }
        }
      },
      {}
    )
    // TODO update owner
    return "TODO actually use give access back if possible"
     */
    return { owner, aesExchangeKeys: encryptedAesKeyMap }
  }

  /**
   * Adds new entries to a delegation-like value and removes duplications. This method also:
   * - creates a new key from owner to delegate if no key is provided
   * - moves existing delegations for the owner-delegate pair which use unsecure delegation keys to the most appropriate secure delegation key.
   * @param owner the owner of the delegations.
   * @param delegateId id of the delegate for the new delegation entry.
   * @param entityClass class of the entity these delegations belong to.
   * @param delegations a delegation-like object, to be updated by this method.
   * @param newEntryValue the value of {@link Delegation.key} for the new delegation to add. Will be encrypted with an appropriate key and then the
   * hex representation of its result will be added to the delegation
   * @return the updated owner and delegations
   */
  async addEntryAndDeduplicateDelegationLike(
    owner: DataOwner,
    delegateId: string,
    entityClass: EncryptedEntityTypeName,
    delegations: { [key: string]: Array<Delegation> },
    newEntryValue: ArrayBuffer,
  ): Promise<{
    owner: DataOwner,
    delegations: { [key: string]: Array<Delegation> }
  }> {
    const publicKeys = await this.getPublicKeys()
    const { owner: modifiedOwner, aesExchangeKeys } = await this.getOrCreateHcPartyKeys(owner, delegateId)
    const ownerId = owner.id!
    const allKeys = await this.decryptAllAesExchangeKeyForOwner(aesExchangeKeys, ownerId, ownerId, delegateId, publicKeys)
    const favouredKey = allKeys[0]
    const possibleDelegationEntryKeys = [
      delegateId,
      ...(await this.getSecureDelegationEntryKeysFor(delegateId, { ownerId, entityClass })).map((x) => x.secureDelegationKey)
    ]
    const favouredDelegationKey = await this.getSecureDelegationEntryKeyFor(favouredKey, delegateId, entityClass)
    type DelegationInfo = { delegation: Delegation, originalDelegationEntryKey: string, decryptedDelegationValue: string, decryptionKey: DelegatorAndKeys }
    const existingDecryptedDelegations = await possibleDelegationEntryKeys.reduce<Promise<DelegationInfo[]>>(
      async (accByKey, delegationKey) => {
        const resultsByKey = await accByKey
        const currentResults = await delegations[delegationKey].reduce<Promise<DelegationInfo[]>>(
          async (accByDelegations, delegation) => {
            const resultsByDelegations = await accByDelegations
            const currDecryptedDelegationInfo = await allKeys.reduce<Promise<undefined | DelegationInfo>>(
              async (prevPromise, key) => {
                const prev = await prevPromise
                if (prev) return prev
                try {
                  const decryptedDelegationValue = ua2hex(await this._AES.decrypt(key.key, hex2ua(delegation.key!), key.rawKey))
                  return {
                    delegation: { ...delegation, owner: ownerId, delegatedTo: delegateId } as Delegation,
                    originalDelegationEntryKey: delegationKey,
                    decryptedDelegationValue,
                    decryptionKey: key
                  }
                } catch (e) {
                  return undefined
                }
              },
              Promise.resolve(undefined)
            )
            if (currDecryptedDelegationInfo) {
              return [...resultsByDelegations, currDecryptedDelegationInfo]
            } else {
              return resultsByDelegations
            }
          },
          Promise.resolve([])
        )
        if (currentResults.length) {
          return [...resultsByKey, ...currentResults]
        } else {
          return resultsByKey
        }
      },
      Promise.resolve([])
    )
    const uniqueDecryptedDelegationValues = _.uniq([
      ua2hex(newEntryValue),
      ...existingDecryptedDelegations.map((di) => di.decryptedDelegationValue)
    ])
    const delegationsToKeep = uniqueDecryptedDelegationValues.reduce<[string, Delegation][]>(
      (acc, decryptedValue) => {
        const matchingDelegation = existingDecryptedDelegations.find((di) =>
          // If there was already a delegation with the same decrypted value encrypted using the favoured key let's reuse it.
          di.decryptedDelegationValue === decryptedValue && di.decryptionKey === favouredKey
        )?.delegation
        if (matchingDelegation) {
          return [...acc, [decryptedValue, matchingDelegation]]
        } else return acc
      },
      []
    )
    const reusedDecryptedDelegationValuesSet = new Set(delegationsToKeep.map((x) => x[0]))
    const newDelegations = await uniqueDecryptedDelegationValues
      .filter((v) => !reusedDecryptedDelegationValuesSet.has(v))
      .reduce<Promise<Delegation[]>>(
        async (acc, decryptedValue) => {
          const awaitedAcc = await acc
          const newDelegation: Delegation = {
            owner: ownerId,
            delegatedTo: delegateId,
            key: ua2hex(await this._AES.encrypt(favouredKey.key, hex2ua(decryptedValue), favouredKey.rawKey)),
          }
          return [...awaitedAcc, newDelegation]
        },
        Promise.resolve([])
      )
    const possibleDelegationEntryKeysSet = new Set(possibleDelegationEntryKeys)
    const decryptedDelegationsSet = new Set(existingDecryptedDelegations.map((di) => di.delegation))
    const updatedDelegations: { [key: string]: Array<Delegation> } = {}
    const anonymizeDelegation = (d: Delegation) => _.omit(d, ["delegatedTo", "owner"]) as Delegation
    for (const [delegationEntryKey, delegationEntryValues] of Object.entries(delegations)) {
      if (!possibleDelegationEntryKeysSet.has(delegationEntryKey)) {
        // Leave delegations of entries for other delegator-delegate pairs as is.
        updatedDelegations[delegationEntryKey] = delegationEntryValues
      } else if (delegationEntryKey !== favouredDelegationKey) {
        // Remove delegations that I'm moving to the favoured secure delegation key.
        // TODO secure delegations: add an option to avoid removing from the delegateId
        updatedDelegations[delegationEntryKey] = delegationEntryValues
          .filter((d) => !decryptedDelegationsSet.has(d))
          .map(anonymizeDelegation)
      } else {
        const delegationsToKeepSet = new Set(delegationsToKeep.map((x) => x[1]))
        const oldDelegations = delegationEntryValues.filter((d) => delegationsToKeepSet.has(d) || !decryptedDelegationsSet.has(d))
        updatedDelegations[delegationEntryKey] = oldDelegations.concat(newDelegations).map(anonymizeDelegation)
      }
    }
    if (!updatedDelegations[favouredDelegationKey]) {
      updatedDelegations[favouredDelegationKey] = delegationsToKeep.map((x) => x[1]).concat(newDelegations).map(anonymizeDelegation)
    }
    return {
      owner: modifiedOwner,
      delegations: updatedDelegations
    }
  }
}
