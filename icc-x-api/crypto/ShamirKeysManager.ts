import { DataOwner, DataOwnerWithType, IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { KeyManager } from './KeyManager'
import { ExchangeKeysManager } from './ExchangeKeysManager'
import { CryptoPrimitives } from './CryptoPrimitives'
import { KeyPair } from './RSA'
import { hex2ua, ua2hex } from '../utils'

/**
 * Allows to create or update shamir split keys.
 */
export class ShamirKeysManager {
  private readonly primitives: CryptoPrimitives
  private readonly dataOwnerApi: IccDataOwnerXApi
  private readonly keyManager: KeyManager
  private readonly exchangeKeysManager: ExchangeKeysManager

  constructor(primitives: CryptoPrimitives, dataOwnerApi: IccDataOwnerXApi, keyManager: KeyManager, exchangeKeysManager: ExchangeKeysManager) {
    this.primitives = primitives
    this.dataOwnerApi = dataOwnerApi
    this.keyManager = keyManager
    this.exchangeKeysManager = exchangeKeysManager
  }

  /**
   * Get information on existing private keys splits for the provided data owner. For each private key of the provided data owner which has been
   * split using the Shamir sharing algorithm gives the list of the notaries (other data owners) which hold a copy of the key part.
   * @param dataOwner a data owner
   * @return the existing splits for the current data owner as a publicKeyFingerprint -> notariesIds object
   */
  getExistingSplitsInfo(dataOwner: DataOwner): { [keyPairFingerprint: string]: string[] } {
    const legacyPartitionDelegates = Object.keys(dataOwner.privateKeyShamirPartitions ?? {})
    if (legacyPartitionDelegates.length > 0) {
      const fp = dataOwner.publicKey?.slice(-32)
      if (!fp) {
        console.error('Invalid data owner: the owner has legacy key partitions but no legacy key.')
      } else return { [fp]: legacyPartitionDelegates }
    }
    return {}
  }

  /**
   * Creates, updates or deletes shamir splits for keys of the current data owner. Any request to update the splits for a specific key will completely
   * replace any existing data on that split (all previous notaries will be ignored).
   * Note: currently you can only split the legacy key pair.
   * @param keySplitsToUpdate the fingerprints of key pairs which will have updated/new splits and the details on how to create the updated splits.
   * @param keySplitsToDelete the fingerprints or hex-encoded spki public keys which will not be shared anymore.
   * @throws if the parameters refer to non-existing or unavailable keys, have split creation details, or if they request to delete a non-existing
   * split.
   */
  async updateSelfSplits(
    keySplitsToUpdate: { [publicKeyHexOrFp: string]: { notariesIds: string[]; minShares: number } },
    keySplitsToDelete: string[]
  ): Promise<DataOwnerWithType> {
    const self = await this.dataOwnerApi.getCurrentDataOwner()
    const toUpdateSet = new Set(Object.keys(keySplitsToUpdate).map((x) => x.slice(-32)))
    const toDeleteSet = new Set(keySplitsToDelete.slice(-32))
    const intersection = Array.from(toDeleteSet).filter((x) => toUpdateSet.has(x))
    const existingSplits = new Set(Object.keys(this.getExistingSplitsInfo(self.dataOwner)))
    const allKeys = this.keyManager.getDecryptionKeys()
    if (toDeleteSet.size !== keySplitsToDelete.length || toUpdateSet.size !== Object.keys(keySplitsToUpdate).length || intersection.length > 0)
      throw new Error(`Duplicate keys in input:\nkeySplitsToUpdate: ${keySplitsToUpdate}\nkeySplitsToDelete: ${keySplitsToDelete}`)
    Object.entries(keySplitsToUpdate).forEach(([key, params]) => this.validateShamirParams(key, params))
    if (!Array.from(existingSplits).every((x) => existingSplits.has(x))) {
      throw new Error(`Requested to delete non-existing split.\nexistingSplits: ${Array.from(existingSplits)}\ntoDelete:${Array.from(toDeleteSet)}`)
    }
    if (Array.from(toUpdateSet).some((x) => !allKeys[x])) {
      throw new Error(`Private key is not available for some of the requested key split updates. ${keySplitsToUpdate}`)
    }
    const delegatesKeys: { [delegateId: string]: CryptoKey } = {}
    let updatedSelf = self
    for (const delegateId of new Set(Object.values(keySplitsToUpdate).flatMap((x) => x.notariesIds))) {
      const res = await this.exchangeKeysManager.getOrCreateEncryptionExchangeKeysTo(delegateId)
      delegatesKeys[delegateId] = res.keys[0]
      if (res.updatedDelegator) {
        updatedSelf = res.updatedDelegator
      }
    }
    for (const [key, params] of Object.entries(keySplitsToUpdate)) {
      updatedSelf = await this.updateKeySplit(updatedSelf, key.slice(-32), params.notariesIds, params.minShares, delegatesKeys, allKeys)
    }
    for (const keyFp of toDeleteSet) {
      updatedSelf = this.deleteKeySplit(updatedSelf, keyFp)
    }
    return await this.dataOwnerApi.updateDataOwner(updatedSelf)
  }

  /*TODO
   * Get suggested recovery keys: analyse transfer keys and shamir to get keys which should be shared with shamir for optimal recovery.
   */

  private validateShamirParams(key: string, params: { notariesIds: string[]; minShares: number }) {
    if (params.notariesIds.length > 0) {
      if (params.minShares > params.notariesIds.length) {
        throw new Error(`Invalid parameters for key ${key}: min shares can't be greater than the number of delegates. ${params}`)
      }
    } else throw new Error(`Invalid parameters for key ${key}: must have at least one delegate. ${params}`)
  }

  private deleteKeySplit(dataOwner: DataOwnerWithType, keyFp: string): DataOwnerWithType {
    if (keyFp !== dataOwner.dataOwner.publicKey?.slice(-32)) {
      throw new Error('Currently it is possible to use shamir splits only for the legacy public key')
    }
    return {
      type: dataOwner.type,
      dataOwner: {
        ...dataOwner.dataOwner,
        privateKeyShamirPartitions: {},
      },
    }
  }

  private async updateKeySplit(
    dataOwner: DataOwnerWithType,
    keyFp: string,
    delegateIds: string[],
    minShares: number,
    delegatesKeys: { [p: string]: CryptoKey },
    allKeys: { [p: string]: KeyPair<CryptoKey> }
  ): Promise<DataOwnerWithType> {
    if (keyFp !== dataOwner.dataOwner.publicKey?.slice(-32)) {
      throw new Error('Currently it is possible to use shamir splits only for the legacy public key')
    }
    return {
      type: dataOwner.type,
      dataOwner: {
        ...dataOwner.dataOwner,
        privateKeyShamirPartitions: await this.createPartitionsFor(allKeys[keyFp], delegateIds, minShares, delegatesKeys),
      },
    }
  }

  private async createPartitionsFor(
    keyPair: KeyPair<CryptoKey>,
    delegateIds: string[],
    minShares: number,
    delegatesKeys: { [p: string]: CryptoKey }
  ): Promise<{ [delegateId: string]: string }> {
    const exportedKey = await this.primitives.RSA.exportKey(keyPair.privateKey, 'pkcs8')
    if (delegateIds.length == 1) {
      return await this.encryptShares([exportedKey], delegateIds, delegatesKeys)
    } else {
      const exportedKeysHex = ua2hex(exportedKey)
      const stringShares = this.primitives.shamir.share(exportedKeysHex, delegateIds.length, minShares)
      const paddedStringShares = stringShares.map((x) => `f${x}`) // Shares are uneven length, apart from that they are perfect hexes
      for (const share of paddedStringShares) {
        if (!/^(?:[0-9a-f][0-9a-f])+$/g.test(share)) throw new Error('Unexpected result of shamir split: padded shares should be a valid hex value')
        if (share !== ua2hex(hex2ua(share))) throw new Error('Unexpected result with encoding-decoding share')
      }
      return await this.encryptShares(
        paddedStringShares.map((x) => hex2ua(x)),
        delegateIds,
        delegatesKeys
      )
    }
  }

  private async encryptShares(
    shares: ArrayBuffer[],
    delegateIds: string[],
    delegatesKeys: { [p: string]: CryptoKey }
  ): Promise<{ [delegateId: string]: string }> {
    return delegateIds.reduce(
      async (acc, delegateId, index) => ({
        ...(await acc),
        [delegateId]: ua2hex(await this.primitives.AES.encrypt(delegatesKeys[delegateId], shares[index])),
      }),
      Promise.resolve({} as { [delegateId: string]: string })
    )
  }
}