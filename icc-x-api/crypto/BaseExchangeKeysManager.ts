/**
 * @internal This class is meant only for internal use and may be changed without notice.
 * Functions to create and get exchange keys, including encryption when necessary. The methods of this api require to pass the appropriate keys
 * for encryption/decryption manually.
 */
import { KeyPair, RSAUtils } from './RSA'
import { AESUtils } from './AES'
import { hex2ua, notConcurrent, ua2hex } from '../utils'
import { DataOwner, DataOwnerWithType, IccDataOwnerXApi } from '../icc-data-owner-x-api'

export class BaseExchangeKeysManager {
  private RSA: RSAUtils
  private AES: AESUtils
  private dataOwnerApi: IccDataOwnerXApi
  private generateKeyConcurrencyMap: { [key: string]: PromiseLike<CryptoKey> } = {}

  constructor(RSA: RSAUtils, AES: AESUtils, dataOwnerApi: IccDataOwnerXApi) {
    this.RSA = RSA
    this.AES = AES
    this.dataOwnerApi = dataOwnerApi
  }

  /**
   * Creates a new exchange key for a delegator-delegate pair, or updates an existing one allowing additional public keys to access it.
   * @param delegatorId id of the delegator data owner.
   * @param delegateId id of the delegate data owner.
   * @param mainDelegatorKeyPair main key pair for the delegator. The private key will be used for the decryption of the existing key in case of
   * update, and the public key will be used as entry key of the aesExchangeKey map
   * @param additionalPublicKeys all public keys of key pairs other than {@link mainDelegatorKeyPair} that need to have access to the exchange key.
   * @return the exchange key for the delegator-delegate-delegatorKey triple.
   */
  async createOrUpdateEncryptedExchangeKeyFor(
    delegatorId: string,
    delegateId: string,
    mainDelegatorKeyPair: KeyPair<CryptoKey>,
    additionalPublicKeys: string[]
  ): Promise<CryptoKey> {
    return await notConcurrent(this.generateKeyConcurrencyMap, delegatorId, async () => {
      const delegator = await this.dataOwnerApi.getDataOwner(delegatorId)
      const delegate = await this.dataOwnerApi.getDataOwner(delegateId)
      const mainDelegatorKeyPairPubHex = ua2hex(await this.RSA.exportKey(mainDelegatorKeyPair.publicKey, 'spki'))
      const otherPublicKeys = additionalPublicKeys.filter((x) => x !== mainDelegatorKeyPairPubHex)
      let exchangeKey: { raw: string; key: CryptoKey } | undefined = undefined
      const existingExchangeKey =
        delegator.dataOwner.aesExchangeKeys?.[mainDelegatorKeyPairPubHex]?.[delegateId]?.[mainDelegatorKeyPairPubHex.slice(-32)] ??
        (mainDelegatorKeyPairPubHex === delegator.dataOwner.publicKey ? delegator.dataOwner.hcPartyKeys?.[delegateId][0] : undefined)
      if (existingExchangeKey) {
        exchangeKey = await this.tryDecryptExchangeKeyWith(existingExchangeKey, mainDelegatorKeyPair, undefined)
        if (!exchangeKey) {
          throw `Failed to decrypt existing exchange key for update of ${mainDelegatorKeyPairPubHex.slice(-32)}@${delegatorId}->${delegateId}`
        }
        const existingAesExchangeKey = delegator.dataOwner.aesExchangeKeys?.[mainDelegatorKeyPairPubHex]?.[delegateId]
        if (existingAesExchangeKey) {
          const existingPublicKeysSet = new Set(existingExchangeKey)
          if (additionalPublicKeys.every((x) => existingPublicKeysSet.has(x.slice(-32)))) return exchangeKey.key
        }
      }
      const encryptedKeyInfo = await this.encryptExchangeKey(
        exchangeKey,
        mainDelegatorKeyPairPubHex.slice(-32),
        mainDelegatorKeyPair,
        otherPublicKeys
      )
      await this.dataOwnerApi.updateDataOwner({
        type: delegator.type,
        dataOwner: {
          ...delegator.dataOwner,
          aesExchangeKeys: await this.updateExchangeKeys(delegator, delegate, mainDelegatorKeyPairPubHex, encryptedKeyInfo.encryptedExchangeKey),
          hcPartyKeys: this.updateLegacyExchangeKeys(delegator, delegate, encryptedKeyInfo.encryptedExchangeKey),
        },
      })
      return encryptedKeyInfo.exchangeKey
    })
  }

  /**
   * Get the encrypted exchange keys for a delegator-delegate pair.
   * @param delegatorId id of the delegator data owner.
   * @param delegateId id of the delegate data owner.
   * @return an array of exchange keys from the delegator to delegate where each key is encrypted with one or more public keys.
   */
  async getEncryptedExchangeKeysFor(delegatorId: string, delegateId: string): Promise<{ [publicKeyFingerprint: string]: string }[]> {
    const delegator = await this.dataOwnerApi.getDataOwner(delegatorId)
    const res: { [publicKeyFingerprint: string]: string }[] = Object.values(delegator.dataOwner.aesExchangeKeys ?? {}).flatMap((delegateToKey) => {
      const encryptedKeyForDelegate = delegateToKey[delegateId]
      if (encryptedKeyForDelegate) {
        return [encryptedKeyForDelegate]
      } else {
        return []
      }
    })
    const legacyDelegation = delegator.dataOwner.hcPartyKeys?.[delegateId]?.[1]
    if (legacyDelegation) res.push({ '': legacyDelegation })
    return res
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

  /**
   * Creates an encrypted exchange key for the provided public keys.
   * @param exchangeKey the exchange key in raw and imported format. If undefined a new key will be automatically created.
   * @param mainKeyPairFp fingerprint of the {@link mainKeyPair}
   * @param mainKeyPair a "main" key pair to use for the encryption of the exchange key.
   * @param otherPublicKeys additional public keys that will have access to the exchange key in spki format, hex-encoded.
   * @return the exchangeKey and an object with the exchange key encrypted with each of the provided public keys, hex-encoded, by fingerprint.
   */
  private async encryptExchangeKey(
    exchangeKey: { raw: string; key: CryptoKey } | undefined,
    mainKeyPairFp: string,
    mainKeyPair: KeyPair<CryptoKey>,
    otherPublicKeys: string[]
  ): Promise<{
    exchangeKey: CryptoKey
    encryptedExchangeKey: { [pubKeyFp: string]: string }
  }> {
    const exchangeKeyCrypto = exchangeKey?.key ?? (await this.AES.generateCryptoKey(false))
    const exchangeKeyBytes = exchangeKey !== undefined ? hex2ua(exchangeKey.raw) : await this.AES.exportKey(exchangeKeyCrypto, 'raw')
    const encryptedExchangeKey = await otherPublicKeys.reduce(
      async (acc, currKey) => ({
        ...(await acc),
        [currKey.slice(-32)]: ua2hex(
          await this.RSA.encrypt(await this.RSA.importKey('spki', hex2ua(currKey), ['encrypt']), new Uint8Array(exchangeKeyBytes))
        ),
      }),
      Promise.resolve({} as { [pubKeyFp: string]: string })
    )
    encryptedExchangeKey[mainKeyPairFp] = ua2hex(await this.RSA.encrypt(mainKeyPair.publicKey, new Uint8Array(exchangeKeyBytes)))
    return { exchangeKey: exchangeKeyCrypto, encryptedExchangeKey }
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
    for (const [fp, encrypted] of Object.entries(encryptedExchangeKey)) {
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
      const decrypted = await this.RSA.decrypt(keyPair.privateKey, hex2ua(encryptedByOneKey))
      return { raw: ua2hex(decrypted), key: await this.AES.importKey('raw', decrypted) }
    } catch (e) {
      if (keyPairFp) {
        console.error(`Failed to decrypt or import exchange key ${encryptedByOneKey} using key with fingerprint ${keyPairFp}.`, e)
      }
    }
  }

  private updateLegacyExchangeKeys(
    delegator: DataOwnerWithType,
    delegate: DataOwnerWithType,
    encryptedKeyMap: { [fp: string]: string }
  ): { [delegateId: string]: string[] } | undefined {
    const legacyEncryptedKeyDelegator = delegator.dataOwner.publicKey ? encryptedKeyMap[delegator.dataOwner.publicKey] : undefined
    const legacyEncryptedKeyDelegate = delegate.dataOwner.publicKey ? encryptedKeyMap[delegate.dataOwner.publicKey] : undefined
    if (legacyEncryptedKeyDelegator && legacyEncryptedKeyDelegate) {
      return {
        ...(delegator.dataOwner.hcPartyKeys ?? {}),
        [delegate.dataOwner.id!]: [legacyEncryptedKeyDelegator, legacyEncryptedKeyDelegate],
      }
    } else return delegator.dataOwner.hcPartyKeys
  }

  private async updateExchangeKeys(
    delegator: DataOwnerWithType,
    delegate: DataOwnerWithType,
    mainDelegatorKeyPairPubHex: string,
    encryptedKeyMap: { [fp: string]: string }
  ): Promise<{ [ownerPublicKey: string]: { [delegateId: string]: { [fingerprint: string]: string } } }> {
    const combinedAesExchangeKeys = await this.combineLegacyHcpKeysWithAesExchangeKeys(delegator, delegate)
    return {
      ...combinedAesExchangeKeys,
      [mainDelegatorKeyPairPubHex]: {
        ...(combinedAesExchangeKeys[mainDelegatorKeyPairPubHex] ?? {}),
        [delegate.dataOwner.id!]: {
          ...(combinedAesExchangeKeys[mainDelegatorKeyPairPubHex]?.[delegate.dataOwner.id!] ?? {}),
          ...encryptedKeyMap,
        },
      },
    }
  }

  // Copy all legacy hcp exchange keys into the new aes exchange keys
  private async combineLegacyHcpKeysWithAesExchangeKeys(
    owner: DataOwner,
    delegate: DataOwner
  ): Promise<{ [ownerPublicKey: string]: { [delegateId: string]: { [fingerprint: string]: string } } }> {
    const ownerLegacyPublicKey = owner.publicKey
    if (ownerLegacyPublicKey && !(owner.aesExchangeKeys ?? {})[ownerLegacyPublicKey]) {
      /*
       * This condition would technically prevent new updates to the hcPartyKeys to be migrated to the aes exchange keys, but since I can only update
       * data for self data owner and parent entities this is not an issue, because I will always be using the new api from now on and I won't have
       * a situation where the legacy keys are updated but the aes exchange keys are not.
       */
      const unknownDataOwnerCounterPartIds = Object.keys(owner.hcPartyKeys ?? {}).filter((x) => x !== owner.id && x !== delegate.id)
      const counterPartsById = [
        owner,
        delegate,
        ...(await Promise.all(unknownDataOwnerCounterPartIds.map(async (cpid) => (await this.dataOwnerApi.getDataOwner(cpid)).dataOwner))),
      ].reduce((acc, dataOwner) => {
        acc[dataOwner.id!] = dataOwner
        return acc
      }, {} as { [id: string]: DataOwner })
      return {
        [ownerLegacyPublicKey]: Object.entries(owner.hcPartyKeys ?? {}).reduce((acc, [hcpId, keys]) => {
          acc[hcpId] = { [ownerLegacyPublicKey.slice(-32)]: keys[0], [counterPartsById[hcpId]?.publicKey?.slice(-32) ?? '']: keys[1] }
          return acc
        }, {} as { [delegateId: string]: { [fingerprint: string]: string } }),
        ...(owner.aesExchangeKeys ?? {}),
      }
    } else return owner.aesExchangeKeys ?? {}
  }
}
