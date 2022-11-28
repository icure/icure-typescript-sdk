import { AESUtils } from './AES'
import { KeyPair, RSAUtils } from './RSA'
import { ExchangeDataManager } from './ExchangeDataManager'
import { ExchangeDataCrypto } from './ExchangeDataCrypto'
import { DataOwnerWithType, IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { fold, hex2ua, ua2hex } from '../utils'
import { KeyManager } from './KeyManager'
import { acyclic, graphFromEdges, reachSetsAcyclic, StronglyConnectedGraph } from '../utils/graph-utils'

/**
 * Allows to manage transfer keys.
 */
export class TransferKeysManager {
  private readonly AES: AESUtils
  private readonly RSA: RSAUtils
  private readonly exchangeDataManager: ExchangeDataManager
  private readonly exchangeDataCrypto: ExchangeDataCrypto
  private readonly dataOwnerApi: IccDataOwnerXApi

  constructor(
    AES: AESUtils,
    RSA: RSAUtils,
    exchangeDataManager: ExchangeDataManager,
    exchangeDataCrypto: ExchangeDataCrypto,
    dataOwnerApi: IccDataOwnerXApi
  ) {
    this.AES = AES
    this.RSA = RSA
    this.exchangeDataManager = exchangeDataManager
    this.exchangeDataCrypto = exchangeDataCrypto
    this.dataOwnerApi = dataOwnerApi
  }

  /**
   * Analyses the transfer keys graph for the current data owner and suggests potential keys which could get better access to data by adding new
   * transfer keys.
   * This method is thought to be used in conjunction with {@link updateTransferKeys} for the creation of new transfer keys: after the user has
   * verified that he owns the public keys returned by this method (or only some of them) you can call {@link updateTransferKeys } with the verified
   * public keys to create the new transfer keys.
   *
   * @param keyManager key manager for the current data owner.
   * @return public keys of key pairs which would benefit from new transfer keys, in hex spki format.
   */
  async getNewTransferKeysSuggestions(keyManager: KeyManager): Promise<Set<string>> {
    const graph = await this.selfTransferKeysGraphFp()
    const candidatesFp = this.transferKeysCandidatesFp(this.transferTargetDeviceKey(keyManager).fingerprint, graph)
    const fpToFullMap = await this.selfFingerprintToPublicKeyMap()
    const deviceKeysFp = new Set(Object.keys(keyManager.getDeviceKeys()))
    return new Set(
      candidatesFp
        .flatMap((candidate) => graph.acyclicLabelToGroup[candidate])
        // Exclude keys from the device, in general they should not be candidates, but if it happens we can automatically consider them as verified.
        .filter((fp) => !deviceKeysFp.has(fp))
        .map((fp) => fpToFullMap[fp])
    )
  }

  /**
   * Create new transfer keys for the current data owner. This can be used to improve data accessibility from other devices or to implement a data
   * recovery function.
   *
   * ## Important
   *
   * The creation of new transfer keys should be done only after approval by the end-user. This feature effectively allows to share the private keys
   * currently available on this device with anyone that has access to a specific private key. Usually this would be another private key of the user
   * in a different device, but in case iCure got compromised this could be the key of an attacker.
   *
   * For this reason before creating transfer keys you should always let the user verify that the public keys which would be used for the encryption
   * of the new transfer keys are actually owned by the user themselves.
   *
   * @param keyManager key manager for the current data owner.
   * @param verifiedPublicKeys public keys in hex spki format that the current data owner has confirmed he owns.
   * @return the updated data owner.
   */
  async updateTransferKeys(keyManager: KeyManager, verifiedPublicKeys: string[]): Promise<void> {
    if (verifiedPublicKeys.length == 0) return
    const verifiedKeysFpSet = new Set(verifiedPublicKeys.map((x) => x.slice(-32)))
    // All keys of this device should be considered as verified, and if for some reasons they are not connected we can connect them.
    Object.keys(keyManager.getDeviceKeys()).forEach((dk) => verifiedKeysFpSet.add(dk))
    const graph = await this.selfTransferKeysGraphFp()
    const { fingerprint: targetKeyFp, keyPair: targetKey } = this.transferTargetDeviceKey(keyManager)
    const candidatesFp = this.transferKeysCandidatesFp(targetKeyFp, graph)
    const verifiedCandidates = candidatesFp.filter((candidate) =>
      graph.acyclicLabelToGroup[candidate].some((candidateGroupMember) => verifiedKeysFpSet.has(candidateGroupMember))
    )
    const verifiedCandidatesSet = new Set(verifiedCandidates)
    const reachSets = reachSetsAcyclic(graph.acyclicGraph)
    // Drop all candidates which can reach another candidate group: it is sufficient to create a transfer key from that group.
    const optimizedCandidates = verifiedCandidates.filter((candidate) =>
      Array.from(reachSets[candidate]).every((reachableNode) => !verifiedCandidatesSet.has(reachableNode))
    )
    if (optimizedCandidates.length == 0) throw 'Check failed: at least one candidate should survive optimization'
    const selfId = (await this.dataOwnerApi.getCurrentDataOwner()).dataOwner.id!
    const fpToPublicKey = await this.selfFingerprintToPublicKeyMap()
    const newExchangeKeyPublicKeys = optimizedCandidates.map((fp) => fpToPublicKey[fp])
    newExchangeKeyPublicKeys.push(fpToPublicKey[targetKeyFp])
    const { exchangeKey, encryptedExchangeKey } = await this.exchangeDataCrypto.createEncryptedExchangeKeyFor(newExchangeKeyPublicKeys)
    await this.exchangeDataManager.createEncryptedExchangeKeyFor(selfId, selfId, encryptedExchangeKey)
    // note: createEncryptedExchangeKeyFor updates self
    const encryptedTransferKey = await this.encryptTransferKey(targetKey, exchangeKey)
    const self = await this.dataOwnerApi.getCurrentDataOwner()
    const newTransferKeys = fold(optimizedCandidates, { ...(self.dataOwner.transferKeys ?? {}) }, (acc, candidateFp) => {
      const candidate = fpToPublicKey[candidateFp]
      const existingKeys = { ...(acc[candidate] ?? {}) }
      existingKeys[fpToPublicKey[targetKeyFp]] = encryptedTransferKey
      acc[candidate] = existingKeys
      return acc
    })
    await this.dataOwnerApi.updateDataOwner({
      type: self.type,
      dataOwner: {
        ...self.dataOwner,
        transferKeys: newTransferKeys,
      },
    })
  }

  /**
   * @internal this method is intended only for internal use and may be changed without notice.
   * Load all key pairs for the current data owner which can be obtained from the currently known keys and the transfer keys.
   * @param knownKeys key pairs already loaded for the current user.
   * @return new key pairs (exclude already known pairs) which could be loaded from the transfer keys using the known keys.
   */
  async loadSelfKeysFromTransfer(knownKeys: {
    [pubKeyFingerprint: string]: KeyPair<CryptoKey>
  }): Promise<{ [pubKeyFingerprint: string]: KeyPair<CryptoKey> }> {
    const self = await this.dataOwnerApi.getCurrentDataOwner()
    const selfPublicKeys = Array.from(await this.dataOwnerApi.getHexPublicKeysOf(self))
    const loadedStoredKeysFingerprintsSet = new Set(Object.keys(knownKeys))
    // The same private key may be encrypted using different exchange keys.
    const missingKeysTransferData: { [recoverableKeyPubFp: string]: { publicKey: string; encryptedPrivateKey: Set<string> } } = {}
    Object.values(self.dataOwner.transferKeys ?? {}).forEach((transferKeysByEncryptor) => {
      Object.entries(transferKeysByEncryptor).forEach(([transferPublicKey, transferPrivateKeyEncrypted]) => {
        const transferPublicKeyFp = transferPublicKey.slice(-32) // We are not sure if transfer public key will be a fp or not
        if (!loadedStoredKeysFingerprintsSet.has(transferPublicKeyFp)) {
          const existingEntryValue = missingKeysTransferData[transferPublicKeyFp]
          if (existingEntryValue != undefined) {
            existingEntryValue.encryptedPrivateKey.add(transferPrivateKeyEncrypted)
          } else {
            const fullPublicKey = selfPublicKeys.find((x) => x.slice(-32) == transferPublicKeyFp)
            if (fullPublicKey != undefined) {
              missingKeysTransferData[transferPublicKeyFp] = {
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

    // Load initially available exchange keys
    let { successfulDecryptions: availableExchangeKeys, failedDecryptions: encryptedExchangeKeys } =
      await this.exchangeDataCrypto.tryDecryptExchangeKeys(
        await this.exchangeDataManager.getEncryptedExchangeKeysFor(self.dataOwner.id!, self.dataOwner.id!),
        knownKeys
      )

    let result: { [pubKeyFingerprint: string]: KeyPair<CryptoKey> } = {}

    while (availableExchangeKeys.length > 0 && Object.keys(missingKeysTransferData).length > 0) {
      const newRecoveredKeys: { [pubKeyFingerprint: string]: KeyPair<CryptoKey> } = {}
      for (const [recoverableKeyPubFp, transferData] of Object.entries(missingKeysTransferData)) {
        const decryptedTransferData = await this.tryDecryptTransferData(transferData, availableExchangeKeys)
        if (decryptedTransferData != undefined) {
          newRecoveredKeys[recoverableKeyPubFp] = decryptedTransferData
          delete missingKeysTransferData[recoverableKeyPubFp]
        }
      }
      const newExchangeKeysDecryption = await this.exchangeDataCrypto.tryDecryptExchangeKeys(encryptedExchangeKeys, newRecoveredKeys)
      availableExchangeKeys = newExchangeKeysDecryption.successfulDecryptions
      encryptedExchangeKeys = newExchangeKeysDecryption.failedDecryptions
      result = { ...result, ...newRecoveredKeys }
    }

    return result
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
          publicKey: await this.RSA.importKey('spki', hex2ua(transferData.publicKey), ['encrypt']),
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
        const decryptedKeyData = await this.AES.decrypt(exchangeKey, encryptedKeyBytes)
        const importedPrivateKey = await this.RSA.importPrivateKey('pkcs8', decryptedKeyData)
        if (importedPrivateKey != undefined) return importedPrivateKey
      } catch (e) {
        /* failure is a valid possibility: we don't know the correct key to use */
      }
    }
    return undefined
  }

  // encrypts a transfer key in pkcs8 format using an exchange key, returns the hex representation
  private async encryptTransferKey(transferKey: KeyPair<CryptoKey>, exchangeKey: CryptoKey): Promise<string> {
    const exportedKey = await this.RSA.exportKey(transferKey.privateKey, 'pkcs8')
    return ua2hex(await this.AES.encrypt(exchangeKey, exportedKey))
  }

  // all public keys would go to the stored keys -> no need for specifying the key.
  // Result only includes the acyclic label, not the full group
  private transferKeysCandidatesFp(keyToFp: string, graph: StronglyConnectedGraph): string[] {
    return Object.entries(reachSetsAcyclic(graph.acyclicGraph))
      .filter(([from, reachable]) => from != keyToFp && !reachable.has(keyToFp))
      .map((x) => x[0])
  }

  private transferTargetDeviceKey(keyManager: KeyManager): { fingerprint: string; keyPair: KeyPair<CryptoKey> } {
    const [fingerprint, keyPair] = Object.entries(keyManager.getDeviceKeys())[0]
    return { fingerprint, keyPair }
  }

  // Uses fp as node names
  private async selfTransferKeysGraphFp(): Promise<StronglyConnectedGraph> {
    const self = await this.dataOwnerApi.getCurrentDataOwner()
    const publicKeys = Array.from(this.dataOwnerApi.getHexPublicKeysOf(await this.dataOwnerApi.getCurrentDataOwner()))
    const edges: [string, string][] = []
    Object.entries(self.dataOwner.transferKeys ?? {}).map(([from, tos]) => {
      Object.keys(tos).forEach((to) => {
        edges.push([from.slice(-32), to.slice(-32)])
      })
    })
    return acyclic(
      graphFromEdges(
        edges,
        publicKeys.map((x) => x.slice(-32))
      )
    )
  }

  private async selfFingerprintToPublicKeyMap(): Promise<{ [fp: string]: string }> {
    const publicKeys = Array.from(this.dataOwnerApi.getHexPublicKeysOf(await this.dataOwnerApi.getCurrentDataOwner()))
    const res: { [fp: string]: string } = {}
    publicKeys.forEach((pk) => {
      res[pk.slice(-32)] = pk
    })
    return res
  }
}
