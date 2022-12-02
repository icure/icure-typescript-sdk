import { AESUtils } from './AES'
import { KeyPair, RSAUtils } from './RSA'
import { BaseExchangeKeysManager } from './BaseExchangeKeysManager'
import { DataOwnerWithType, IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { hex2ua, ua2hex } from '../utils'
import { KeyManager } from './KeyManager'
import { reachSetsAcyclic, StronglyConnectedGraph } from '../utils/graph-utils'
import { fingerprintToPublicKeysMapOf, transferKeysFpGraphOf } from './utils'

/**
 * @internal this class is intended only for internal use and may be changed without notice.
 * Allows to manage transfer keys.
 */
export class TransferKeysManager {
  private readonly AES: AESUtils
  private readonly RSA: RSAUtils
  private readonly baseExchangeKeysManager: BaseExchangeKeysManager
  private readonly dataOwnerApi: IccDataOwnerXApi

  constructor(AES: AESUtils, RSA: RSAUtils, baseExchangeKeysManager: BaseExchangeKeysManager, dataOwnerApi: IccDataOwnerXApi) {
    this.AES = AES
    this.RSA = RSA
    this.baseExchangeKeysManager = baseExchangeKeysManager
    this.dataOwnerApi = dataOwnerApi
  }

  /**
   * Analyses the transfer keys graph for the current data owner and suggests potential keys which could get better access to data by adding new
   * transfer keys.
   * This method is thought to be used in conjunction with {@link updateTransferKeys} for the creation of new transfer keys: after the user has
   * verified that he owns the public keys returned by this method (or only some of them) you can call {@link updateTransferKeys } with the verified
   * public keys to create the new transfer keys.
   *
   * @param self the current data owner
   * @param keyManager key manager for the current data owner.
   * @return public keys of key pairs which would benefit from new transfer keys, in hex spki format.
   */
  async getNewTransferKeysSuggestions(self: DataOwnerWithType, keyManager: KeyManager): Promise<Set<string>> {
    const graph = transferKeysFpGraphOf(self)
    const candidatesFp = this.transferKeysCandidatesFp((await this.transferTargetDeviceKey(keyManager)).fingerprint, graph)
    const fpToFullMap = fingerprintToPublicKeysMapOf(self)
    const deviceKeysFp = new Set((await keyManager.getSelfVerifiedKeys()).map((x) => x.fingerprint))
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
   * @param self the current data owner
   * @param keyManager key manager for the current data owner.
   * @param verifiedPublicKeys public keys in hex spki format that the current data owner has confirmed he owns.
   * @return the updated data owner.
   */
  async updateTransferKeys(self: DataOwnerWithType, keyManager: KeyManager, verifiedPublicKeys: string[]): Promise<void> {
    const newEdges = await this.getNewVerifiedTransferKeysEdges(self, keyManager, verifiedPublicKeys)
    if (!newEdges) return
    const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
    const fpToPublicKey = fingerprintToPublicKeysMapOf(self)
    const newExchangeKeyPublicKeys = newEdges.sources.map((fp) => fpToPublicKey[fp])
    const { key: exchangeKey, updatedDelegator: updatedSelf } = await this.baseExchangeKeysManager.createOrUpdateEncryptedExchangeKeyFor(
      selfId,
      selfId,
      newEdges.target,
      newExchangeKeyPublicKeys
    )
    // note: createEncryptedExchangeKeyFor may update self
    const encryptedTransferKey = await this.encryptTransferKey(newEdges.target, exchangeKey)
    const newTransferKeys = newEdges.sources.reduce(
      (acc, candidateFp) => {
        const candidate = fpToPublicKey[candidateFp]
        const existingKeys = { ...(acc[candidate] ?? {}) }
        existingKeys[fpToPublicKey[newEdges.targetFp]] = encryptedTransferKey
        acc[candidate] = existingKeys
        return acc
      },
      { ...(updatedSelf.dataOwner.transferKeys ?? {}) }
    )
    await this.dataOwnerApi.updateDataOwner({
      type: updatedSelf.type,
      dataOwner: {
        ...updatedSelf.dataOwner,
        transferKeys: newTransferKeys,
      },
    })
  }

  /**
   * Load all key pairs for the current data owner which can be obtained from the currently known keys and the transfer keys.
   * @param self the current data owner
   * @param knownKeys key pairs already loaded for the current user.
   * @return new key pairs (exclude already known pairs) which could be loaded from the transfer keys using the known keys.
   */
  async loadSelfKeysFromTransfer(
    self: DataOwnerWithType,
    knownKeys: { [pubKeyFingerprint: string]: KeyPair<CryptoKey> }
  ): Promise<{ [pubKeyFingerprint: string]: KeyPair<CryptoKey> }> {
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
      await this.baseExchangeKeysManager.tryDecryptExchangeKeys(
        await this.baseExchangeKeysManager.getEncryptedExchangeKeysFor(self.dataOwner.id!, self.dataOwner.id!),
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
      const newExchangeKeysDecryption = await this.baseExchangeKeysManager.tryDecryptExchangeKeys(encryptedExchangeKeys, newRecoveredKeys)
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

  private async transferTargetDeviceKey(keyManager: KeyManager): Promise<{ fingerprint: string; pair: KeyPair<CryptoKey> }> {
    return (await keyManager.getSelfVerifiedKeys())[0]
  }

  // Decides the best edges considering the verified public keys.
  private async getNewVerifiedTransferKeysEdges(
    self: DataOwnerWithType,
    keyManager: KeyManager,
    verifiedPublicKeys: string[]
  ): Promise<
    | undefined
    | {
        sources: string[]
        target: KeyPair<CryptoKey>
        targetFp: string
      }
  > {
    if (verifiedPublicKeys.length == 0) return undefined
    const verifiedKeysFpSet = new Set(verifiedPublicKeys.map((x) => x.slice(-32)))
    // All keys of this device should be considered as verified, and if for some reasons they are not connected we can connect them.
    ;(await keyManager.getSelfVerifiedKeys()).forEach((dk) => verifiedKeysFpSet.add(dk.fingerprint))
    const graph = transferKeysFpGraphOf(self)
    const { fingerprint: targetKeyFp, pair: targetKey } = await this.transferTargetDeviceKey(keyManager)
    const candidatesFp = this.transferKeysCandidatesFp(targetKeyFp, graph)
    const verifiedGroupCandidates = candidatesFp.filter((candidate) =>
      graph.acyclicLabelToGroup[candidate].some((candidateGroupMember) => verifiedKeysFpSet.has(candidateGroupMember))
    )
    const verifiedCandidatesSet = new Set(verifiedGroupCandidates)
    const reachSets = reachSetsAcyclic(graph.acyclicGraph)
    // Drop all candidates which can reach another candidate group: it is sufficient to create a transfer key from that group.
    const optimizedCandidates = verifiedGroupCandidates.filter((candidate) =>
      Array.from(reachSets[candidate]).every((reachableNode) => !verifiedCandidatesSet.has(reachableNode))
    )
    if (optimizedCandidates.length == 0) throw 'Check failed: at least one candidate should survive optimization'
    // Transfer keys could also be faked: to make sure we are not giving access to something wrong we remap the candidates to a verified public keys
    const verifiedOptimizedCandidates = optimizedCandidates.map((candidate) => {
      const res = graph.acyclicLabelToGroup[candidate].find((groupMemberFp) => verifiedKeysFpSet.has(groupMemberFp))
      if (!res) throw 'Check failed: optimized candidates groups should have at least a verified member'
      return res
    })
    return {
      sources: verifiedOptimizedCandidates,
      target: targetKey,
      targetFp: targetKeyFp,
    }
  }
}
