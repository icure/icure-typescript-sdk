import { KeyPair } from './RSA'
import { hex2ua, notConcurrent, ua2hex } from '../utils'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { CryptoPrimitives } from './CryptoPrimitives'
import { IccDeviceApi, IccHcpartyApi, IccPatientApi } from '../../icc-api'
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
   * Creates a new exchange key from the current data owner to a delegate, or updates an existing one allowing additional public keys to access it.
   * @param delegateId the delegate data owner id.
   * @param delegatorMainKeyPair main key pair for the delegator. The private key will be used for the decryption of the existing key in case of
   * update, and the public key will be used as entry key of the aesExchangeKey map
   * @param additionalPublicKeys all public keys of key pairs other than {@link delegatorMainKeyPair} that need to have access to the exchange key.
   * Can be a mix of crypto keys and full hex-encoded spki format (no fingerprints).
   * @return the exchange key for the delegator-delegate-delegatorKey triple (new or existing) and the updated delegator.
   */
  async createOrUpdateEncryptedExchangeKeyTo(
    delegateId: string,
    delegatorMainKeyPair: KeyPair<CryptoKey>,
    additionalPublicKeys: { [keyFingerprint: string]: CryptoKey }
  ): Promise<{
    updatedDelegator: CryptoActorStubWithType
    key: CryptoKey
  }> {
    const delegatorId = await this.dataOwnerApi.getCurrentDataOwnerId()
    return await notConcurrent(this.generateKeyConcurrencyMap, delegatorId, async () => {
      const delegator = CryptoActorStubWithType.fromDataOwner(await this.dataOwnerApi.getCurrentDataOwner())
      const delegate = delegatorId === delegateId ? delegator : await this.dataOwnerApi.getCryptoActorStub(delegateId)
      const mainDelegatorKeyPairPubHex = ua2hex(await this.primitives.RSA.exportKey(delegatorMainKeyPair.publicKey, 'spki'))
      let exchangeKey: { raw: string; key: CryptoKey } | undefined = undefined
      const existingExchangeKey =
        delegator.stub.aesExchangeKeys?.[mainDelegatorKeyPairPubHex]?.[delegateId]?.[mainDelegatorKeyPairPubHex.slice(-32)] ??
        (mainDelegatorKeyPairPubHex === delegator.stub.publicKey ? delegator.stub.hcPartyKeys?.[delegateId]?.[0] : undefined)
      if (existingExchangeKey) {
        exchangeKey = await this.tryDecryptExchangeKeyWith(existingExchangeKey, delegatorMainKeyPair, undefined)
        if (!exchangeKey)
          throw new Error(
            `Failed to decrypt existing exchange key for update of ${mainDelegatorKeyPairPubHex.slice(-32)}@${delegatorId}->${delegateId}`
          )
        const existingAesExchangeKey = delegator.stub.aesExchangeKeys?.[mainDelegatorKeyPairPubHex]?.[delegateId]
        if (existingAesExchangeKey) {
          const existingPublicKeysSet = new Set(existingExchangeKey)
          if (Object.keys(additionalPublicKeys).every((fp) => existingPublicKeysSet.has(fp)))
            return {
              updatedDelegator: delegator,
              key: exchangeKey.key,
            }
        }
      }
      const allPublicKeys = {
        ...additionalPublicKeys,
        [mainDelegatorKeyPairPubHex.slice(-32)]: delegatorMainKeyPair.publicKey,
      }
      const encryptedKeyInfo = await this.encryptExchangeKey(exchangeKey, allPublicKeys)
      let updatedDelegatorPublicKey: string
      if (delegator.stub.publicKey == '') {
        if (Object.entries(delegator.stub.hcPartyKeys ?? {}).length > 0)
          throw new Error(`Data owner ${delegator.stub.id} has "" as public key but has non-empty hcPartyKeys`)
        updatedDelegatorPublicKey = mainDelegatorKeyPairPubHex
      } else {
        updatedDelegatorPublicKey = delegator.stub.publicKey ?? mainDelegatorKeyPairPubHex
      }
      const updatedStub: CryptoActorStub = {
        ...delegator.stub,
        aesExchangeKeys: await this.updateExchangeKeys(delegator, delegate, mainDelegatorKeyPairPubHex, encryptedKeyInfo.encryptedExchangeKey),
        publicKey: updatedDelegatorPublicKey,
      }
      if (delegator.stub.publicKey === mainDelegatorKeyPairPubHex) {
        updatedStub.hcPartyKeys = this.updateLegacyExchangeKeys(delegator, delegate, encryptedKeyInfo.encryptedExchangeKey)
      }
      const updatedDelegator = await this.dataOwnerApi.modifyCryptoActorStub({
        type: delegator.type,
        stub: updatedStub,
      })
      return {
        key: encryptedKeyInfo.exchangeKey,
        updatedDelegator,
      }
    })
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
    const newPublicKey = await this.primitives.RSA.importKey('spki', hex2ua(newDataOwnerPublicKey), ['encrypt'])
    await this.extendForGiveAccessBackTo(selfId, otherDataOwner, newDataOwnerPublicKey.slice(-32), newPublicKey, keyPairsByFingerprint)
    await this.extendForGiveAccessBackTo(otherDataOwner, selfId, newDataOwnerPublicKey.slice(-32), newPublicKey, keyPairsByFingerprint)
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
      otherOwnerTypes.find((x) => x === DataOwnerTypeEnum.Hcp)
        ? this.hcpartyBaseApi.getAesExchangeKeysForDelegate(dataOwnerId).catch(() => {})
        : Promise.resolve({}),
      otherOwnerTypes.find((x) => x === DataOwnerTypeEnum.Patient)
        ? this.patientBaseApi.getPatientAesExchangeKeysForDelegate(dataOwnerId).catch(() => {})
        : Promise.resolve({}),
      otherOwnerTypes.find((x) => x === DataOwnerTypeEnum.Device)
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
      const fp = entryKey.slice(-32)
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

  private async updateExchangeKeys(
    delegator: CryptoActorStubWithType,
    delegate: CryptoActorStubWithType,
    mainDelegatorKeyPairPubHex: string,
    encryptedKeyMap: { [fp: string]: string }
  ): Promise<{ [ownerPublicKey: string]: { [delegateId: string]: { [fingerprint: string]: string } } }> {
    const combinedAesExchangeKeys = await this.combineLegacyHcpKeysWithAesExchangeKeys(delegator.stub, delegate.stub)
    return this.fixAesExchangeKeyEntriesToFingerprints({
      ...combinedAesExchangeKeys,
      [mainDelegatorKeyPairPubHex]: {
        ...(combinedAesExchangeKeys[mainDelegatorKeyPairPubHex] ?? {}),
        [delegate.stub.id!]: {
          ...(combinedAesExchangeKeys[mainDelegatorKeyPairPubHex]?.[delegate.stub.id!] ?? {}),
          ...encryptedKeyMap,
        },
      },
    })
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
          acc[hcpId] = { [ownerLegacyPublicKey.slice(-32)]: keys[0], [counterPartsById[hcpId]?.publicKey?.slice(-32) ?? '']: keys[1] }
          return acc
        }, {} as { [delegateId: string]: { [fingerprint: string]: string } }),
        ...(owner.aesExchangeKeys ?? {}),
      }
    } else return owner.aesExchangeKeys ?? {}
  }

  private fixAesExchangeKeyEntriesToFingerprints(aesExchangeKeys: {
    [delegatorPubKey: string]: { [delegateId: string]: { [pubKeyFp: string]: string } }
  }): { [delegatorPubKey: string]: { [delegateId: string]: { [pubKeyFp: string]: string } } } {
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
