import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { KeyPair } from './RSA'
import { CryptoPrimitives } from './CryptoPrimitives'
import { BaseExchangeKeysManager } from './BaseExchangeKeysManager'
import { hex2ua, ua2hex } from '../utils'
import { fingerprintToPublicKeysMapOf } from './utils'
import { DataOwnerWithType } from '../../icc-api/model/DataOwnerWithType'

/**
 * @internal this class is intended only for internal use and may be changed without notice.
 *
 */
export class KeyRecovery {
  private readonly primitives: CryptoPrimitives
  private readonly baseExchangeKeysManager: BaseExchangeKeysManager
  private readonly dataOwnerApi: IccDataOwnerXApi

  constructor(primitives: CryptoPrimitives, baseExchangeKeysManager: BaseExchangeKeysManager, dataOwnerApi: IccDataOwnerXApi) {
    this.primitives = primitives
    this.baseExchangeKeysManager = baseExchangeKeysManager
    this.dataOwnerApi = dataOwnerApi
  }

  /**
   * Attempt to recover private keys of a data owner using all available key recovery methods and all available private keys. The method will
   * automatically try to use newly recovered key pairs to recover additional key pairs.
   * @param dataOwner a data owner.
   * @param knownKeys keys available for the data owner.
   * @return new key pairs (exclude already known pairs) which could be recovered using the known keys.
   */
  async recoverKeys(
    dataOwner: DataOwnerWithType,
    knownKeys: { [pubKeyFp: string]: KeyPair<CryptoKey> }
  ): Promise<{ [pubKeyFp: string]: KeyPair<CryptoKey> }> {
    const selfPublicKeys = Array.from(this.dataOwnerApi.getHexPublicKeysOf(dataOwner.dataOwner))
    const knownKeysFpSet = new Set(Object.keys(knownKeys))
    const missingKeysFpSet = new Set(selfPublicKeys.map((x) => x.slice(-32)).filter((x) => !knownKeysFpSet.has(x)))

    const recoveryFunctions = [this.recoverFromTransferKeys.bind(this), this.recoverFromShamirSplitKeys.bind(this)]
    let allPrivateKeys: { [pubKeyFingerprint: string]: KeyPair<CryptoKey> } = { ...knownKeys }
    let foundNewPrivateKeys = true

    while (missingKeysFpSet.size > 0 && foundNewPrivateKeys) {
      // TODO for each recovered verify correct association with public key
      foundNewPrivateKeys = false
      for (const recover of recoveryFunctions) {
        const recovered = await recover(dataOwner, allPrivateKeys, missingKeysFpSet)
        const validatedRecovered: { [fp: string]: KeyPair<CryptoKey> } = {}
        for (const [fp, keyPair] of Object.entries(recovered)) {
          const valid = await this.primitives.RSA.checkKeyPairValidity(keyPair)
          if (valid) {
            validatedRecovered[fp] = keyPair
          }
        }
        if (Object.keys(validatedRecovered).length > 0) {
          foundNewPrivateKeys = true
          Object.keys(validatedRecovered).forEach((fp) => missingKeysFpSet.delete(fp))
          allPrivateKeys = { ...allPrivateKeys, ...validatedRecovered }
        }
      }
    }

    return Object.fromEntries(Object.entries(allPrivateKeys).filter(([keyFp]) => !knownKeysFpSet.has(keyFp)))
  }

  /*TODO?
   * Ask access back suggestion: if by getting access back to an exchange key with another data owner I may recover additional keys we could suggest
   * to ask for access back to that data owner.
   */

  private async recoverFromShamirSplitKeys(
    dataOwner: DataOwnerWithType,
    allKeys: { [pubKeyFingerprint: string]: KeyPair<CryptoKey> },
    missingKeysFp: Set<string>
  ): Promise<{ [pubKeyFingerprint: string]: KeyPair<CryptoKey> }> {
    if (
      dataOwner.dataOwner.publicKey &&
      dataOwner.dataOwner.privateKeyShamirPartitions &&
      Object.keys(dataOwner.dataOwner.privateKeyShamirPartitions).length > 0
    ) {
      const selfId = dataOwner.dataOwner.id!
      const shamirSplits: { [keyPairFp: string]: { [delegateId: string]: string } } = {
        [dataOwner.dataOwner.publicKey!.slice(-32)]: dataOwner.dataOwner.privateKeyShamirPartitions!,
      }
      const delegatesOfSplits = Array.from(
        new Set(
          Object.entries(shamirSplits).flatMap(([splitKeyFp, splitKeyData]) => (missingKeysFp.has(splitKeyFp) ? Object.keys(splitKeyData) : []))
        )
      )
      const exchangeKeys: { [delegateId: string]: CryptoKey[] } = {}
      for (const delegate of delegatesOfSplits) {
        const currExchangeKeys = await this.baseExchangeKeysManager.getEncryptedExchangeKeysFor(selfId, delegate)
        exchangeKeys[delegate] = (await this.baseExchangeKeysManager.tryDecryptExchangeKeys(currExchangeKeys, allKeys)).successfulDecryptions
      }
      return await this.recoverWithSplits(dataOwner, shamirSplits, exchangeKeys)
    } else return {}
  }

  private async recoverWithSplits(
    dataOwner: DataOwnerWithType,
    splits: { [keyPairFp: string]: { [delegateId: string]: string } },
    exchangeKeys: { [delegateId: string]: CryptoKey[] }
  ): Promise<{ [pubKeyFingerprint: string]: KeyPair<CryptoKey> }> {
    const res: { [pubKeyFingerprint: string]: KeyPair<CryptoKey> } = {}
    const keysByFp = fingerprintToPublicKeysMapOf(dataOwner.dataOwner)
    for (const [fp, split] of Object.entries(splits)) {
      const recovered = await this.tryRecoverSplitPrivate(split, exchangeKeys)
      if (recovered) {
        const pub = keysByFp[fp]
        if (!pub) {
          console.warn(`Missing public key for fingerprint ${fp} of recovered shamir key.`)
        } else {
          try {
            res[fp] = {
              privateKey: recovered,
              publicKey: await this.primitives.RSA.importKey('spki', hex2ua(pub), ['encrypt']),
            }
          } catch (e) {
            console.warn(`Failed to import public key ${pub}`, e)
          }
        }
      }
    }
    return res
  }

  private async tryRecoverSplitPrivate(
    split: { [delegateId: string]: string },
    exchangeKeys: { [delegateId: string]: CryptoKey[] }
  ): Promise<CryptoKey | undefined> {
    const splitsCount = Object.keys(split).length
    if (splitsCount === 1) {
      // Not sure about the key nor if the key is accessible
      const [delegate, encryptedKey] = Object.entries(split)[0]
      for (const exchangeKey of exchangeKeys[delegate] ?? []) {
        try {
          const decrypted = await this.primitives.AES.decrypt(exchangeKey, hex2ua(encryptedKey))
          const importedKey = await this.primitives.RSA.importKey('pkcs8', decrypted, ['decrypt'])
          if (importedKey) return importedKey
        } catch (e) {}
      }
      return undefined
    } else {
      const decryptedSplits: string[] = []
      for (const delegateAndEncryptedSplit of Object.entries(split)) {
        const decrypted = await this.tryDecryptSplitPiece(delegateAndEncryptedSplit, exchangeKeys, splitsCount)
        if (decrypted) decryptedSplits.push(ua2hex(decrypted).slice(1)) // Drop padding
      }
      try {
        const combinedKey = hex2ua(this.primitives.shamir.combine(decryptedSplits))
        return await this.primitives.RSA.importKey('pkcs8', combinedKey, ['decrypt'])
      } catch (e) {
        // Could be not enough splits decrypted
        return undefined
      }
    }
  }

  private async tryDecryptSplitPiece(
    delegateAndEncryptedSplit: [string, string],
    exchangeKeys: { [delegateId: string]: CryptoKey[] },
    splitsCount: number
  ): Promise<ArrayBuffer | undefined> {
    const [delegate, encryptedPiece] = delegateAndEncryptedSplit
    for (const exchangeKey of exchangeKeys[delegate] ?? []) {
      try {
        const decrypted = await this.primitives.AES.decrypt(exchangeKey, hex2ua(encryptedPiece))
        if (this.validateDecryptedSplit(decrypted, splitsCount)) return decrypted
      } catch (e) {}
    }
    return undefined
  }

  private validateDecryptedSplit(decryptedSplit: ArrayBuffer, splitsCount: number): boolean {
    // Normally shamir split starts with 8 followed by the index of the split in hexadecimal.
    // However, we pad with an extra 'f' at the beginning
    const decryptedHex = ua2hex(decryptedSplit)
    if (decryptedHex[0] !== 'f' || decryptedHex[1] !== '8') return false
    try {
      const splitIndex = parseInt(decryptedHex.slice(2, 4), 16)
      return splitIndex > 0 && splitIndex <= splitsCount
    } catch (e) {
      return false
    }
  }

  private async recoverFromTransferKeys(
    dataOwner: DataOwnerWithType,
    allKeys: { [pubKeyFingerprint: string]: KeyPair<CryptoKey> },
    missingKeysFp: Set<string>
  ): Promise<{ [pubKeyFingerprint: string]: KeyPair<CryptoKey> }> {
    const publicKeyFingerprintToPublicKey = fingerprintToPublicKeysMapOf(dataOwner.dataOwner)
    const missingKeysTransferData: { [recoverableKeyPubFp: string]: { publicKey: string; encryptedPrivateKey: Set<string> } } = {}
    Object.values(dataOwner.dataOwner.transferKeys ?? {}).forEach((transferKeysByEncryptor) => {
      Object.entries(transferKeysByEncryptor).forEach(([transferToPublicKey, transferPrivateKeyEncrypted]) => {
        const transferToPublicKeyFp = transferToPublicKey.slice(-32) // We are not sure if transfer public key will be a fp or not
        if (missingKeysFp.has(transferToPublicKeyFp)) {
          const existingEntryValue = missingKeysTransferData[transferToPublicKeyFp]
          if (existingEntryValue) {
            existingEntryValue.encryptedPrivateKey.add(transferPrivateKeyEncrypted)
          } else {
            const fullPublicKey = publicKeyFingerprintToPublicKey[transferToPublicKeyFp]
            if (fullPublicKey) {
              missingKeysTransferData[transferToPublicKeyFp] = {
                publicKey: fullPublicKey,
                encryptedPrivateKey: new Set([transferPrivateKeyEncrypted]),
              }
            } else {
              console.warn('Invalid data owner: there is a transfer key for an unknown public key')
            }
          }
        }
      })
    })

    const { successfulDecryptions: availableExchangeKeys } = await this.baseExchangeKeysManager.tryDecryptExchangeKeys(
      await this.baseExchangeKeysManager.getEncryptedExchangeKeysFor(dataOwner.dataOwner.id!, dataOwner.dataOwner.id!),
      allKeys
    )

    return Object.entries(missingKeysTransferData).reduce(async (acc, [recoverableKeyPubFp, transferData]) => {
      const awaitedAcc = await acc
      const decryptedTransferData = await this.tryDecryptTransferData(transferData, availableExchangeKeys)
      if (decryptedTransferData != undefined) {
        return { ...awaitedAcc, [recoverableKeyPubFp]: decryptedTransferData }
      } else return awaitedAcc
    }, Promise.resolve({} as { [pubKeyFingerprint: string]: KeyPair<CryptoKey> }))
  }

  private async tryDecryptTransferData(
    transferData: { publicKey: string; encryptedPrivateKey: Set<string> },
    availableExchangeKeys: CryptoKey[]
  ): Promise<KeyPair<CryptoKey> | undefined> {
    for (const encryptedTransferKey of transferData.encryptedPrivateKey) {
      const decryptedTransferKey = await this.tryDecryptTransferKey(encryptedTransferKey, availableExchangeKeys)
      if (decryptedTransferKey != undefined)
        return {
          privateKey: decryptedTransferKey,
          publicKey: await this.primitives.RSA.importKey('spki', hex2ua(transferData.publicKey), ['encrypt']),
        }
    }
    return undefined
  }

  // attempt to decrypt a transfer key in pkcs8 using any of the provided exchange keys
  private async tryDecryptTransferKey(
    encryptedTransferKey: string, // in hex format
    exchangeKeys: CryptoKey[]
  ): Promise<CryptoKey | undefined> {
    const encryptedKeyBytes = hex2ua(encryptedTransferKey)
    for (const exchangeKey of exchangeKeys) {
      try {
        const decryptedKeyData = await this.primitives.AES.decrypt(exchangeKey, encryptedKeyBytes)
        const importedPrivateKey = await this.primitives.RSA.importPrivateKey('pkcs8', decryptedKeyData)
        if (importedPrivateKey != undefined) return importedPrivateKey
      } catch (e) {
        /* failure is a valid possibility: we don't know the correct key to use */
      }
    }
    return undefined
  }
}
