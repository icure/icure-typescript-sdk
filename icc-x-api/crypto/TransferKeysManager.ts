import { KeyPair } from './RSA'
import { BaseExchangeKeysManager } from './BaseExchangeKeysManager'
import { DataOwnerWithType, IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { ua2hex } from '../utils'
import { UserEncryptionKeysManager } from './UserEncryptionKeysManager'
import { reachSetsAcyclic, StronglyConnectedGraph } from '../utils/graph-utils'
import { fingerprintToPublicKeysMapOf, fingerprintV1, loadPublicKeys, transferKeysFpGraphOf, isFingerprintV1, fingerprintV1toV2 } from './utils'
import { CryptoPrimitives } from './CryptoPrimitives'
import { IcureStorageFacade } from '../storage/IcureStorageFacade'

/**
 * @internal this class is intended only for internal use and may be changed without notice.
 * Allows to create new transfer keys.
 */
export class TransferKeysManager {
  private readonly primitives: CryptoPrimitives
  private readonly baseExchangeKeysManager: BaseExchangeKeysManager
  private readonly dataOwnerApi: IccDataOwnerXApi
  private readonly keyManager: UserEncryptionKeysManager
  private readonly icureStorage: IcureStorageFacade

  constructor(
    primitives: CryptoPrimitives,
    baseExchangeKeysManager: BaseExchangeKeysManager,
    dataOwnerApi: IccDataOwnerXApi,
    keyManager: UserEncryptionKeysManager,
    icureStorage: IcureStorageFacade
  ) {
    this.primitives = primitives
    this.baseExchangeKeysManager = baseExchangeKeysManager
    this.dataOwnerApi = dataOwnerApi
    this.keyManager = keyManager
    this.icureStorage = icureStorage
  }

  /**
   * Analyses the transfer keys graph and creates new transfer keys which allow to improve data accessibility from other devices.
   * For security reasons transfer keys will only be created between keys verified by the user, but this will be done ignoring any existing edges from
   * unverified keys to verified keys.
   * @param self the current data owner.
   * @return the updated data owner.
   */
  async updateTransferKeys(self: DataOwnerWithType): Promise<void> {
    const newEdges = await this.getNewVerifiedTransferKeysEdges(self)
    if (!newEdges) return
    const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
    const fpToPublicKey = fingerprintToPublicKeysMapOf(self.dataOwner)
    const newExchangeKeyPublicKeys = newEdges.sources.map((fp) => fpToPublicKey[fp])
    const { key: exchangeKey, updatedDelegator: updatedSelf } = await this.baseExchangeKeysManager.createOrUpdateEncryptedExchangeKeyTo(
      selfId,
      newEdges.target,
      await loadPublicKeys(this.primitives.RSA, newExchangeKeyPublicKeys)
    )
    // note: createEncryptedExchangeKeyFor may update self
    const encryptedTransferKey = await this.encryptTransferKey(newEdges.target, exchangeKey)
    const newTransferKeys = newEdges.sources.reduce(
      (acc, candidateFp) => {
        const existingKeys = { ...(acc[candidateFp] ?? {}) }
        existingKeys[newEdges.targetFp] = encryptedTransferKey
        acc[candidateFp] = existingKeys
        return acc
      },
      { ...(updatedSelf.dataOwner.transferKeys ?? {}) }
    )
    await this.dataOwnerApi.updateDataOwner(
      IccDataOwnerXApi.instantiateDataOwnerWithType(
        {
          ...updatedSelf.dataOwner,
          transferKeys: newTransferKeys,
        },
        updatedSelf.type
      )
    )
  }

  // encrypts a transfer key in pkcs8 format using an exchange key, returns the hex representation
  private async encryptTransferKey(transferKey: KeyPair<CryptoKey>, exchangeKey: CryptoKey): Promise<string> {
    const exportedKey = await this.primitives.RSA.exportKey(transferKey.privateKey, 'pkcs8')
    return ua2hex(await this.primitives.AES.encrypt(exchangeKey, exportedKey))
  }

  // all public keys would go to the stored keys -> no need for specifying the key.
  // Result only includes the acyclic label, not the full group
  private transferKeysCandidatesFp(keyToFp: string, graph: StronglyConnectedGraph): string[] {
    return Object.entries(reachSetsAcyclic(graph.acyclicGraph))
      .filter(([from, reachable]) => from != keyToFp && !reachable.has(keyToFp))
      .map((x) => x[0])
  }

  private async transferTargetVerifiedKey(keyManager: UserEncryptionKeysManager): Promise<{ fingerprint: string; pair: KeyPair<CryptoKey> }> {
    return keyManager.getSelfVerifiedKeys()[0]
  }

  // Decides the best edges considering the verified public keys.
  private async getNewVerifiedTransferKeysEdges(self: DataOwnerWithType): Promise<
    | undefined
    | {
        sources: string[]
        target: KeyPair<CryptoKey>
        targetFp: string
      }
  > {
    const verifiedKeysFpSet = new Set(this.keyManager.getSelfVerifiedKeys().map((x) => x.fingerprint))
    Object.entries(await this.icureStorage.loadSelfVerifiedKeys(self.dataOwner.id!)).forEach(([key, verified]) => {
      if (verified) verifiedKeysFpSet.add(fingerprintV1(key))
    })
    if (verifiedKeysFpSet.size == 0) return undefined
    const graph = transferKeysFpGraphOf(self.dataOwner)
    // 1. Choose a key available in this device which should be reachable from all other verified keys
    const { fingerprint: targetKeyFp, pair: targetKey } = await this.transferTargetVerifiedKey(this.keyManager)
    // 2. Find groups which can't reach the existing target keys
    const candidatesFp = this.transferKeysCandidatesFp(targetKeyFp, graph)
    // 3. Keep only groups which contain at least a verified candidate
    const verifiedGroupCandidates = candidatesFp.filter((candidate) =>
      graph.acyclicLabelToGroup[candidate].some((candidateGroupMember) => verifiedKeysFpSet.has(candidateGroupMember))
    )
    const verifiedCandidatesSet = new Set(verifiedGroupCandidates)
    if (verifiedCandidatesSet.size == 0) return undefined
    // 4. Drop all candidates which can already reach another candidate group: it is sufficient to create a transfer key from that group.
    const reachSets = reachSetsAcyclic(graph.acyclicGraph)
    const optimizedCandidates = verifiedGroupCandidates.filter((candidate) =>
      Array.from(reachSets[candidate]).every((reachableNode) => !verifiedCandidatesSet.has(reachableNode))
    )
    if (optimizedCandidates.length == 0) throw new Error('Check failed: at least one candidate should survive optimization')
    // 5. Transfer keys could also be faked: to make sure we are not giving access to unauthorised people we remap the candidates to a verified public
    // keys
    const verifiedOptimizedCandidates = optimizedCandidates.map((candidate) => {
      const res = graph.acyclicLabelToGroup[candidate].find((groupMemberFp) => verifiedKeysFpSet.has(groupMemberFp))
      if (!res) throw new Error('Check failed: optimized candidates groups should have at least a verified member')
      return res
    })
    return {
      sources: verifiedOptimizedCandidates,
      target: targetKey,
      targetFp: targetKeyFp,
    }
  }
}
