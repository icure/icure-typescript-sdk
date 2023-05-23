import { KeyPair } from './RSA'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { ua2hex } from '../utils'
import { UserEncryptionKeysManager } from './UserEncryptionKeysManager'
import { reachSetsAcyclic, StronglyConnectedGraph } from '../utils/graph-utils'
import { fingerprintToPublicKeysMapOf, fingerprintV1, loadPublicKeys, transferKeysFpGraphOf } from './utils'
import { CryptoPrimitives } from './CryptoPrimitives'
import { IcureStorageFacade } from '../storage/IcureStorageFacade'
import { BaseExchangeDataManager } from './BaseExchangeDataManager'
import { UserSignatureKeysManager } from './UserSignatureKeysManager'
import { CryptoActorStubWithType } from '../../icc-api/model/CryptoActorStub'

/**
 * @internal this class is intended only for internal use and may be changed without notice.
 * Allows to create new transfer keys.
 */
export class TransferKeysManager {
  constructor(
    private readonly primitives: CryptoPrimitives,
    private readonly baseExchangeDataManager: BaseExchangeDataManager,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly encryptionKeysManager: UserEncryptionKeysManager,
    private readonly userSignatureKeysManager: UserSignatureKeysManager,
    private readonly icureStorage: IcureStorageFacade
  ) {}

  /**
   * Analyses the transfer keys graph and creates new transfer keys which allow to improve data accessibility from other devices.
   * For security reasons transfer keys will only be created between keys verified by the user, but this will be done ignoring any existing edges from
   * unverified keys to verified keys.
   * @param self the current data owner.
   * @return the updated data owner.
   */
  async updateTransferKeys(self: CryptoActorStubWithType): Promise<void> {
    const newEdgesByTarget = await this.getNewVerifiedTransferKeysEdges(self)
    if (!newEdgesByTarget.length) return
    const selfId = self.stub.id!
    const fpToPublicKey = fingerprintToPublicKeysMapOf(self.stub, 'sha-1')
    const fpToPublicKeyWithSha256 = fingerprintToPublicKeysMapOf(self.stub, 'sha-256')
    const signatureKeyPair = await this.userSignatureKeysManager.getOrCreateSignatureKeyPair()
    const verifiedFps = new Set(this.encryptionKeysManager.getSelfVerifiedKeys().map((x) => x.fingerprint))
    const allVerifiedSourcesAndTarget = Array.from(
      new Set(
        newEdgesByTarget.flatMap((x) =>
          // Sources are guaranteed to be verified, but target may not be
          verifiedFps.has(x.targetFp) ? [x.targetFp, ...x.sources] : x.sources
        )
      )
    )
    const newExchangeKeyPublicKeys = allVerifiedSourcesAndTarget.map((fp) => fpToPublicKey[fp]).filter((key) => !!key)
    const newExchangeKeyPublicKeysWithSha256 = allVerifiedSourcesAndTarget.map((fp) => fpToPublicKeyWithSha256[fp]).filter((key) => !!key)
    const createdExchangeData = await this.baseExchangeDataManager.createExchangeData(
      selfId,
      { [signatureKeyPair.fingerprint]: signatureKeyPair.keyPair.privateKey },
      {
        ...(await loadPublicKeys(this.primitives.RSA, newExchangeKeyPublicKeys, 'sha-1')),
        ...(await loadPublicKeys(this.primitives.RSA, newExchangeKeyPublicKeysWithSha256, 'sha-256')),
      }
    )
    let updatedTransferKeys = self.stub.transferKeys ?? {}
    for (const newEdges of newEdgesByTarget) {
      const encryptedTransferKey = await this.encryptTransferKey(newEdges.target, createdExchangeData.exchangeKey)
      updatedTransferKeys = newEdges.sources.reduce((acc, candidateFp) => {
        const existingKeys = { ...(acc[candidateFp] ?? {}) }
        existingKeys[newEdges.targetFp] = encryptedTransferKey
        acc[candidateFp] = existingKeys
        return acc
      }, updatedTransferKeys)
    }
    await this.dataOwnerApi.modifyCryptoActorStub({
      stub: {
        ...self.stub,
        transferKeys: updatedTransferKeys,
      },
      type: self.type,
    })
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

  private async transferTargetKeys(
    keyManager: UserEncryptionKeysManager,
    graph: StronglyConnectedGraph
  ): Promise<{ fingerprint: string; pair: KeyPair<CryptoKey> }[]> {
    const availableGroups = new Set(Object.keys(keyManager.getDecryptionKeys()).map((x) => graph.originalLabelToAcyclicLabel[x] ?? x))
    const groupsReachableFromAvailable = new Set(
      Object.entries(graph.acyclicGraph).flatMap(([source, reachables]) => (availableGroups.has(source) ? Array.from(reachables) : []))
    )
    const targetCandidates = Array.from(availableGroups).filter((x) => !groupsReachableFromAvailable.has(x))
    const verifiedFps = new Set(keyManager.getSelfVerifiedKeys().map((x) => x.fingerprint))
    return targetCandidates.map((candidateFp) => {
      const candidateGroup = graph.acyclicLabelToGroup[candidateFp] ?? [candidateFp] // May not be part of transfer keys graph yet
      const bestCandidateOfGroup = candidateGroup.find((x) => verifiedFps.has(x)) ?? candidateFp
      return { fingerprint: bestCandidateOfGroup, pair: keyManager.getKeyPairForFingerprint(bestCandidateOfGroup)!.pair }
    })
  }

  // Decides the best edges considering the verified public keys.
  private async getNewVerifiedTransferKeysEdges(self: CryptoActorStubWithType): Promise<
    {
      sources: string[]
      target: KeyPair<CryptoKey>
      targetFp: string
    }[]
  > {
    const verifiedKeysFpSet = new Set(this.encryptionKeysManager.getSelfVerifiedKeys().map((x) => x.fingerprint))
    Object.entries(await this.icureStorage.loadSelfVerifiedKeys(self.stub.id!)).forEach(([key, verified]) => {
      if (verified) verifiedKeysFpSet.add(fingerprintV1(key))
    })
    if (verifiedKeysFpSet.size == 0) return []
    const graph = transferKeysFpGraphOf(self.stub)
    // 1. Choose keys available in this device which should be reachable from all other verified keys
    const targetKeys = await this.transferTargetKeys(this.encryptionKeysManager, graph)
    const res = []
    for (const { fingerprint: targetKeyFp, pair: targetKey } of targetKeys) {
      // 2. Find groups which can't reach the existing target keys
      const candidatesFp = this.transferKeysCandidatesFp(targetKeyFp, graph)
      // 3. Keep only groups which contain at least a verified candidate
      const verifiedGroupCandidates = candidatesFp.filter((candidate) =>
        graph.acyclicLabelToGroup[candidate].some((candidateGroupMember) => verifiedKeysFpSet.has(candidateGroupMember))
      )
      const verifiedCandidatesSet = new Set(verifiedGroupCandidates)
      if (verifiedCandidatesSet.size == 0) continue
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
      res.push({
        sources: verifiedOptimizedCandidates,
        target: targetKey,
        targetFp: targetKeyFp,
      })
    }
    return res
  }
}
