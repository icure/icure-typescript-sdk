import { KeyPair } from './RSA'
import { hex2ua, notConcurrent, ua2hex } from '../utils'
import { DataOwner, IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { CryptoPrimitives } from './CryptoPrimitives'
import { IccDeviceApi, IccHcpartyApi, IccPatientApi } from '../../icc-api'
import { fingerprintV1, getShaVersionForKey } from './utils'
import { CryptoActorStub, CryptoActorStubWithType } from '../../icc-api/model/CryptoActorStub'
import { DataOwnerTypeEnum } from '../../icc-api/model/DataOwnerTypeEnum'

/**
 * @internal This class is meant only for internal use and may be changed without notice.
 * Functions to create and get exchange keys.
 * The methods of this api require to pass the appropriate keys for encryption/decryption manually.
 */
export class BaseExchangeKeysManager {
  private readonly generateKeyConcurrencyMap: { [key: string]: PromiseLike<any> } = {}
  private readonly primitives: CryptoPrimitives
  private readonly dataOwnerApi: IccDataOwnerXApi
  private readonly hcpartyBaseApi: IccHcpartyApi
  private readonly patientBaseApi: IccPatientApi
  private readonly deviceBaseApi: IccDeviceApi

  constructor(
    primitives: CryptoPrimitives,
    dataOwnerApi: IccDataOwnerXApi,
    hcpartyBaseApi: IccHcpartyApi,
    patientBaseApi: IccPatientApi,
    deviceBaseApi: IccDeviceApi
  ) {
    this.primitives = primitives
    this.dataOwnerApi = dataOwnerApi
    this.hcpartyBaseApi = hcpartyBaseApi
    this.patientBaseApi = patientBaseApi
    this.deviceBaseApi = deviceBaseApi
  }

  /**
   * Updates the aes exchange keys between the current data owner and another data owner to allow the other data owner to access the exchange key
   * using his new public key. Note that this will make existing exchange keys from the other data owner to the current data owner invalid for
   * encryption.
   * @param otherDataOwner the other data owner.
   * @param newDataOwnerPublicKey a new public key of the other data owner.
   * @param keyPairsByFingerprint all available key pairs to use for the decryption of existing aes exchange keys.
   */
  async giveAccessBackTo(
    otherDataOwner: string,
    newDataOwnerPublicKey: string,
    keyPairsByFingerprint: { [publicKeyFingerprint: string]: KeyPair<CryptoKey> }
  ) {
    const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
    const other = await this.dataOwnerApi.getCryptoActorStub(otherDataOwner)
    const newKeyHashVersion = getShaVersionForKey(other.stub, newDataOwnerPublicKey)
    if (!newKeyHashVersion) throw new Error(`Public key not found for data owner ${otherDataOwner}`)
    const newPublicKey = await this.primitives.RSA.importKey('spki', hex2ua(newDataOwnerPublicKey), ['encrypt'], newKeyHashVersion)
    await this.extendForGiveAccessBackTo(selfId, otherDataOwner, fingerprintV1(newDataOwnerPublicKey), newPublicKey, keyPairsByFingerprint)
    await this.extendForGiveAccessBackTo(otherDataOwner, selfId, fingerprintV1(newDataOwnerPublicKey), newPublicKey, keyPairsByFingerprint)
  }

  /**
   * Get the encrypted exchange keys for a delegator-delegate pair.
   * @param delegatorId id of the delegator data owner.
   * @param delegateId id of the delegate data owner.
   * @return an array of exchange keys from the delegator to delegate where each key is encrypted with one or more public keys.
   */
  async getEncryptedExchangeKeysFor(delegatorId: string, delegateId: string): Promise<{ [publicKeyFingerprint: string]: string }[]> {
    const delegator = await this.dataOwnerApi.getCryptoActorStub(delegatorId)
    const res: { [publicKeyFingerprint: string]: string }[] = Object.values(delegator.stub.aesExchangeKeys ?? {}).flatMap((delegateToKey) => {
      const encryptedKeyForDelegate = delegateToKey[delegateId]
      if (encryptedKeyForDelegate) {
        return [encryptedKeyForDelegate]
      } else {
        return []
      }
    })
    const legacyDelegation = delegator.stub.hcPartyKeys?.[delegateId]?.[1]
    if (legacyDelegation) res.push({ '': legacyDelegation })
    return res
  }

  /**
   * Get all exchange keys where the provided data owner is involved either as the delegator or as the delegate.
   * @param dataOwnerId id of a data owner.
   * @param otherOwnerTypes only exchange keys between the current data owner and data owners of this type will be included in the result.
   * @return all exchange keys involving the provided data owner. Note that there may be an overlap between some keys to and from the data owner.
   */
  async getAllExchangeKeysWith(
    dataOwnerId: string,
    otherOwnerTypes: DataOwnerTypeEnum[]
  ): Promise<{
    keysToOwner: { [delegatorId: string]: { [delegatorFp: string]: { [entryFp: string]: string } } }
    keysFromOwner: { [delegatorFp: string]: { [delegateId: string]: { [entryFp: string]: string } } }
  }> {
    if (otherOwnerTypes.length === 0) throw new Error('otherOwnerTypes must not be empty!')
    const keysToOwner = await Promise.all([
      otherOwnerTypes.find((x) => x === 'hcp') ? this.hcpartyBaseApi.getAesExchangeKeysForDelegate(dataOwnerId).catch(() => {}) : Promise.resolve({}),
      otherOwnerTypes.find((x) => x === 'patient')
        ? this.patientBaseApi.getPatientAesExchangeKeysForDelegate(dataOwnerId).catch(() => {})
        : Promise.resolve({}),
      otherOwnerTypes.find((x) => x === 'device')
        ? this.deviceBaseApi.getDeviceAesExchangeKeysForDelegate(dataOwnerId).catch(() => {})
        : Promise.resolve({}),
    ]).then(([a, b, c]) => ({ ...a, ...b, ...c } as { [delegatorId: string]: { [delegatorFp: string]: { [entryFp: string]: string } } }))
    const dataOwner = await this.dataOwnerApi.getCryptoActorStub(dataOwnerId)
    const allOwnerKeys = await this.combineLegacyHcpKeysWithAesExchangeKeys(dataOwner.stub, undefined)
    const filteredDelegates = new Set(
      await Array.from(new Set(Object.values(allOwnerKeys).flatMap((x) => Object.keys(x)))).reduce(async (acc, ownerId) => {
        const awaitedAcc = await acc
        if (ownerId === dataOwnerId) {
          return [...awaitedAcc, ownerId]
        } else {
          const dataOwnerType: DataOwnerTypeEnum = (await this.dataOwnerApi.getCryptoActorStub(ownerId)).type
          if (otherOwnerTypes.some((x) => x === dataOwnerType)) {
            return [...awaitedAcc, ownerId]
          } else return awaitedAcc
        }
      }, Promise.resolve([] as string[]))
    )
    const keysFromOwner = Object.fromEntries(
      Object.entries(allOwnerKeys)
        .map(([delegatorPubKey, delegateToKeys]) => [
          delegatorPubKey,
          Object.fromEntries(
            Object.entries(delegateToKeys).filter(([delegateId]) => filteredDelegates.has(delegateId)) as [string, { [k: string]: string }][]
          ),
        ])
        .filter(([, x]) => Object.keys(x).length > 0) as [string, { [k: string]: { [k: string]: string } }][]
    )
    return { keysToOwner, keysFromOwner }
  }

  /**
   * Attempts to decrypt many exchange keys using any of the provided key pairs.
   * @param encryptedExchangeKeys an array of exchange keys where each key is encrypted with one or more public keys.
   * @param keyPairsByFingerprint rsa key pairs to use for decryption.
   * @return an array all successfully decrypted exchange keys and an array containing all exchange keys which could not be decrypted.
   */
  async tryDecryptExchangeKeys(
    encryptedExchangeKeys: { [publicKeyFingerprint: string]: string }[],
    keyPairsByFingerprint: { [publicKeyFingerprint: string]: KeyPair<CryptoKey> }
  ): Promise<{
    successfulDecryptions: CryptoKey[]
    failedDecryptions: { [publicKeyFingerprint: string]: string }[]
  }> {
    const raws = new Set<string>()
    const res: {
      successfulDecryptions: CryptoKey[]
      failedDecryptions: { [publicKeyFingerprint: string]: string }[]
    } = { successfulDecryptions: [], failedDecryptions: [] }
    for (const encryptedExchangeKey of encryptedExchangeKeys) {
      const decrypted = await this.tryDecryptExchangeKey(encryptedExchangeKey, keyPairsByFingerprint)
      if (decrypted !== undefined && !raws.has(decrypted.raw)) {
        raws.add(decrypted.raw)
        res.successfulDecryptions.push(decrypted.key)
      } else {
        res.failedDecryptions.push(encryptedExchangeKey)
      }
    }
    return res
  }

  private async extendForGiveAccessBackTo(
    delegatorId: string,
    delegateId: string,
    newPublicKeyFp: string,
    newPublicKey: CryptoKey,
    decryptionKeyPairsByFingerprint: { [publicKeyFingerprint: string]: KeyPair<CryptoKey> }
  ) {
    await notConcurrent(this.generateKeyConcurrencyMap, delegatorId, async () => {
      const delegator = await this.dataOwnerApi.getCryptoActorStub(delegatorId)
      const delegate = await this.dataOwnerApi.getCryptoActorStub(delegateId)
      let didUpdateSomeKey = false
      const combinedKeys = await this.combineLegacyHcpKeysWithAesExchangeKeys(delegator.stub, delegate.stub)
      const updatedExchangeKeys: { [delegatorKey: string]: { [delegateId: string]: { [keyFp: string]: string } } } = {}
      const newEncryptionKeys = { [newPublicKeyFp]: newPublicKey }
      for (const [currDelegatorKey, currDelegatesToKeys] of Object.entries(combinedKeys)) {
        const updatedDelegatesToKeys: { [delegateId: string]: { [keyFp: string]: string } } = {}
        for (const [currDelegateId, currEncryptedKey] of Object.entries(currDelegatesToKeys)) {
          if (delegateId !== currDelegateId || newPublicKeyFp in currEncryptedKey) {
            updatedDelegatesToKeys[currDelegateId] = currEncryptedKey
          } else {
            const decrypted = await this.tryDecryptExchangeKey(currEncryptedKey, decryptionKeyPairsByFingerprint)
            if (decrypted) {
              didUpdateSomeKey = true
              updatedDelegatesToKeys[currDelegateId] = {
                ...currEncryptedKey,
                ...(await this.encryptExchangeKey(decrypted, newEncryptionKeys)).encryptedExchangeKey,
              }
            } else {
              updatedDelegatesToKeys[currDelegateId] = currEncryptedKey
            }
          }
        }
        updatedExchangeKeys[currDelegatorKey] = updatedDelegatesToKeys
      }
      if (didUpdateSomeKey) {
        await this.dataOwnerApi.modifyCryptoActorStub({
          type: delegator.type,
          stub: {
            ...delegator.stub,
            aesExchangeKeys: updatedExchangeKeys,
          },
        })
      }
    })
  }

  /**
   * Attempts to decrypt an exchange key using any of the provided key pairs.
   * @param encryptedExchangeKey an encrypted exchange key, in the form publicKeyXyzFingerprint -> hex(exchangeKeyEncryptedByPrivateKeyXyz).
   * @param keyPairsByFingerprint rsa key pairs to use for decryption.
   * @return the decrypted exchange key, in raw and key format (to allow deduplication), or undefined if the key could not be decrypted using the
   * provided keys.
   */
  private async tryDecryptExchangeKey(
    encryptedExchangeKey: { [publicKeyFingerprint: string]: string },
    keyPairsByFingerprint: { [publicKeyFingerprint: string]: KeyPair<CryptoKey> }
  ): Promise<{ raw: string; key: CryptoKey } | undefined> {
    for (const [entryKey, encrypted] of Object.entries(encryptedExchangeKey)) {
      // Due to bugs in past version the entry may actually contain the full public key instead of just the fingerprint.
      const fp = fingerprintV1(entryKey)
      const keyPair = keyPairsByFingerprint[fp]
      if (keyPair !== undefined) {
        const res = await this.tryDecryptExchangeKeyWith(encrypted, keyPair, fp)
        if (res !== undefined) return res
      }
    }
    const defaultEncryptedKey = encryptedExchangeKey['']
    if (defaultEncryptedKey !== undefined) {
      for (const keyPair of Object.values(keyPairsByFingerprint)) {
        // disable error logging, we are not sure keyPair is the correct key
        const res = await this.tryDecryptExchangeKeyWith(defaultEncryptedKey, keyPair, undefined)
        if (res !== undefined) return res
      }
    }
    return undefined
  }

  /**
   * Creates an encrypted exchange key for the provided public keys.
   * @param exchangeKey the exchange key in raw and imported format. If undefined a new key will be automatically created.
   * @param publicKeys additional public keys that will have access to the exchange key in spki format, hex-encoded.
   * @return the exchangeKey and an object with the exchange key encrypted with each of the provided public keys, hex-encoded, by fingerprint.
   */
  private async encryptExchangeKey(
    exchangeKey: { raw: string; key: CryptoKey } | undefined,
    publicKeys: { [keyFingerprint: string]: CryptoKey }
  ): Promise<{
    exchangeKey: CryptoKey
    encryptedExchangeKey: { [pubKeyFp: string]: string }
  }> {
    const exchangeKeyCrypto = exchangeKey?.key ?? (await this.primitives.AES.generateCryptoKey(false))
    const exchangeKeyBytes = exchangeKey !== undefined ? hex2ua(exchangeKey.raw) : await this.primitives.AES.exportKey(exchangeKeyCrypto, 'raw')
    const encryptedExchangeKey = await Object.entries(publicKeys).reduce(
      async (acc, [currKeyFp, currKey]) => ({
        ...(await acc),
        [currKeyFp]: ua2hex(await this.primitives.RSA.encrypt(currKey, new Uint8Array(exchangeKeyBytes))),
      }),
      Promise.resolve({} as { [pubKeyFp: string]: string })
    )
    return { exchangeKey: exchangeKeyCrypto, encryptedExchangeKey }
  }

  /**
   * Attempts to decrypt an exchange key using the provided key pairs.
   * If you are confident that the provided {@link keyPair} was used to encrypt {@link encryptedByOneKey} you should also provide {@link keyPairFp},
   * so that if the decryption fail an error will be logged to console before returning undefined.
   * @param encryptedByOneKey an exchange key which may be encrypted with {@link keyPair}.
   * @param keyPair an rsa key pair.
   * @param keyPairFp the fingerprint of the provided key pair or undefined to disable logging of error if the decryption failed.
   * @return the decrypted exchange key, in raw and key format (to allow deduplication), or undefined if the key could not be decrypted using the
   * provided key.
   */
  private async tryDecryptExchangeKeyWith(
    encryptedByOneKey: string,
    keyPair: KeyPair<CryptoKey>,
    keyPairFp: string | undefined // if undefined will not log errors, when we are not sure the key to be used is the provided key.
  ): Promise<{ raw: string; key: CryptoKey } | undefined> {
    try {
      const decrypted = await this.primitives.RSA.decrypt(keyPair.privateKey, hex2ua(encryptedByOneKey))
      return { raw: ua2hex(decrypted), key: await this.primitives.AES.importKey('raw', decrypted) }
    } catch (e) {
      if (keyPairFp) {
        console.error(`Failed to decrypt or import exchange key ${encryptedByOneKey} using key with fingerprint ${keyPairFp}.`, e)
      }
    }
  }

  private updateLegacyExchangeKeys(
    delegator: CryptoActorStubWithType,
    delegate: CryptoActorStubWithType,
    encryptedKeyMap: { [fp: string]: string }
  ): { [delegateId: string]: string[] } | undefined {
    const legacyEncryptedKeyDelegator = delegator.stub.publicKey ? encryptedKeyMap[delegator.stub.publicKey] : undefined
    const legacyEncryptedKeyDelegate = delegate.stub.publicKey ? encryptedKeyMap[delegate.stub.publicKey] : undefined
    if (legacyEncryptedKeyDelegator && legacyEncryptedKeyDelegate) {
      return {
        ...(delegator.stub.hcPartyKeys ?? {}),
        [delegate.stub.id!]: [legacyEncryptedKeyDelegator, legacyEncryptedKeyDelegate],
      }
    } else return delegator.stub.hcPartyKeys
  }

  // Copy all legacy hcp exchange keys into the new aes exchange keys
  private async combineLegacyHcpKeysWithAesExchangeKeys(
    owner: CryptoActorStub,
    delegate: CryptoActorStub | undefined
  ): Promise<{ [ownerPublicKey: string]: { [delegateId: string]: { [fingerprint: string]: string } } }> {
    const ownerLegacyPublicKey = owner.publicKey
    if (ownerLegacyPublicKey && !(owner.aesExchangeKeys ?? {})[ownerLegacyPublicKey]) {
      /*
       * This condition would technically prevent new updates to the hcPartyKeys to be migrated to the aes exchange keys, but since I can only update
       * data for self data owner and parent entities this is not an issue, because I will always be using the new api from now on and I won't have
       * a situation where the legacy keys are updated but the aes exchange keys are not.
       */
      const unknownDataOwnerCounterPartIds = Object.keys(owner.hcPartyKeys ?? {}).filter((x) => x !== owner.id && x !== delegate?.id)
      const counterPartsById = [
        owner,
        ...(delegate ? [delegate] : []),
        ...(await Promise.all(unknownDataOwnerCounterPartIds.map(async (cpid) => (await this.dataOwnerApi.getCryptoActorStub(cpid)).stub))),
      ].reduce((acc, dataOwner) => {
        acc[dataOwner.id!] = dataOwner
        return acc
      }, {} as { [id: string]: CryptoActorStub })
      return {
        [ownerLegacyPublicKey]: Object.entries(owner.hcPartyKeys ?? {}).reduce((acc, [hcpId, keys]) => {
          const counterpartKey = counterPartsById[hcpId]?.publicKey
          acc[hcpId] = {
            [fingerprintV1(ownerLegacyPublicKey)]: keys[0],
            [(counterpartKey && fingerprintV1(counterpartKey)) ?? '']: keys[1],
          }
          return acc
        }, {} as { [delegateId: string]: { [fingerprint: string]: string } }),
        ...(owner.aesExchangeKeys ?? {}),
      }
    } else return owner.aesExchangeKeys ?? {}
  }
}
