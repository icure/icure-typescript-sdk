import { CachedDataOwner, DelegatorAndKeys, IccCryptoXApi } from '../icc-crypto-x-api'
import { StorageFacade } from '../storage/StorageFacade'
import { Delegation, EncryptedEntity, HealthcareParty } from '../../icc-api/model/models'
import { hex2ua, ua2hex, ua2string, ua2utf8 } from './binary-utils'

interface Result<A> {
  map<B>(f: (content: A) => Promise<B>): Promise<Result<B>>
  mapErrorMsg(f: (errorMsg: string) => string): Result<A>
  flatMap<B>(f: (content: A) => Promise<Result<B>>): Promise<Result<B>>
  pojo(): any
}
namespace Result {
  export class Success<A> implements Result<A> {
    constructor(private readonly content: A) {}

    map<B>(f: (content: A) => Promise<B>): Promise<Result<B>> {
      return f(this.content).then((x) => new Success(x))
    }

    flatMap<B>(f: (content: A) => Promise<Result<B>>): Promise<Result<B>> {
      return f(this.content)
    }

    mapErrorMsg(f: (errorMsg: string) => string): Result<A> {
      return this
    }

    pojo(): any {
      return this.content
    }
  }

  export class Failure implements Result<never> {
    constructor(private readonly failedOperation: string, private readonly errorMsg: string) {}

    map<B>(): Promise<Result<B>> {
      return Promise.resolve(this)
    }

    flatMap<B>(): Promise<Result<B>> {
      return Promise.resolve(this)
    }

    mapErrorMsg(f: (errorMsg: string) => string): Result<never> {
      return new Failure(this.failedOperation, f(this.errorMsg))
    }

    pojo(): any {
      return { failedOperation: this.failedOperation, errorMsg: this.errorMsg }
    }
  }

  export async function wrap<A>(operation: string, f: () => Promise<A>): Promise<Result<A>> {
    try {
      return new Success(await f())
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : typeof e === 'string' ? e : `Unexpected of type ${typeof e} content ${JSON.stringify(e)}`
      return new Failure(operation, errorMsg)
    }
  }
}

type DecryptedDelegationInfo = { [encryptedDelegationKey: string]: { [rawKey: string]: Result<string> } }

type DecryptedEntityInfo = {
  delegations: DecryptedDelegationInfo
  encryptionKeys: DecryptedDelegationInfo
  cryptedForeignKeys: DecryptedDelegationInfo
}

type EncryptedExchangeKeys = { [delegator: string]: { [mainXkDelegatorPubFp: string]: { [xkEncryptionPubFp: string]: string /*encryptedXkByKey*/ } } }

type ByDataOwnerData = {
  delegators: Result<CachedDataOwner[]>
  encryptedExchangeKeys: Result<EncryptedExchangeKeys>
  decryptedExchangeKeys: Result<DelegatorAndKeys[]>
  decryptedEntitiesMetadata: Result<{ [entityId: string]: DecryptedEntityInfo }>
}

type FullData = {
  description: string
  involvedEntities: EncryptedEntity[]
  hierarchy: Result<CachedDataOwner[]>
  keyData: Result<{ [fp: string]: { publicKey: string; privateKey: string } }>
  byDataOwner: Result<{
    [dataOwnerId: string]: ByDataOwnerData
  }>
}

export class ErrorReporting {
  constructor(private readonly crypto: IccCryptoXApi) {}

  async collectDataForReport(
    description: string, // Description of what caused the error
    involvedEntities: EncryptedEntity[], // Entities that were being processed when the error occurred
    dataOwnerId: string // Id of the data owner who was doing the processing when the error occurred
  ): Promise<{
    // minimalData: object // Should not contain any sensitive data
    fullData: object // May contain sensitive data, we should not ask for it unless desperate
  }> {
    const fullData = await this.collectFullData(description, involvedEntities, dataOwnerId)
    return { fullData: await this.fullDataPojo(fullData) }
  }

  /*TODO: Minimal
   * - Redact any mention of private keys or exchange keys from error messages
   * - Keep only collected public keys
   * - Keep only id, delegations, crypted foreign keys, encryption keys, and secret foreign keys of involved entities
   * - Keep only id, publicKey, aesExchangeKeys, and hcPartyKeys of data owners
   */

  private async collectFullData(description: string, involvedEntities: EncryptedEntity[], dataOwnerId: string): Promise<FullData> {
    const hierarchy = await this.collectDataOwnerHierarchy(dataOwnerId)
    const keyData = await this.collectAvailableKeys()
    const byDataOwner = await hierarchy.map(async (hierarchy) => {
      const res = {} as { [dataOwnerId: string]: ByDataOwnerData }
      for (const currOwner of hierarchy) {
        const delegators = await this.getDelegators(involvedEntities, currOwner.dataOwner.id!)
        const encryptedExchangeKeys = await this.findEncryptedExchangeKeys(currOwner.dataOwner.id!)
        const decryptedExchangeKeys = await delegators.flatMap(async (delegators) => {
          return this.decryptExchangeKeys(
            currOwner.dataOwner.id!,
            delegators.map((x) => x.dataOwner.id!)
          )
        })
        const decryptedEntitiesMetadata = await decryptedExchangeKeys.flatMap(async (xks) => {
          return await this.decryptDelegations(xks, involvedEntities, currOwner.dataOwner.id!)
        })
        res[currOwner.dataOwner.id!] = {
          delegators,
          encryptedExchangeKeys,
          decryptedExchangeKeys,
          decryptedEntitiesMetadata,
        }
      }
      return res
    })
    return {
      description,
      involvedEntities,
      hierarchy,
      keyData,
      byDataOwner,
    }
  }

  private async fullDataPojo(data: FullData): Promise<object> {
    return {
      description: data.description,
      involvedEntities: data.involvedEntities,
      hierarchy: data.hierarchy.pojo(),
      keyData: data.keyData.pojo(),
      byDataOwner: (
        await data.byDataOwner.map(async (byDataOwnerContent) => {
          const res = {} as { [dataOwnerId: string]: object }
          for (const [dataOwnerId, dataOwnerContent] of Object.entries(byDataOwnerContent)) {
            res[dataOwnerId] = {
              delegators: dataOwnerContent.delegators.pojo(),
              encryptedExchangeKeys: dataOwnerContent.encryptedExchangeKeys.pojo(),
              decryptedExchangeKeys: dataOwnerContent.decryptedExchangeKeys.pojo(),
              decryptedEntitiesMetadata: (
                await dataOwnerContent.decryptedEntitiesMetadata.map(async (decryptedEntitiesData) => {
                  const currEntityData = {} as { [entityId: string]: object }
                  for (const [entityId, entityData] of Object.entries(decryptedEntitiesData)) {
                    currEntityData[entityId] = await this.decryptedEntityInfoPojo(entityData)
                  }
                  return currEntityData
                })
              ).pojo(),
            }
          }
          return res
        })
      ).pojo(),
    }
  }

  private async decryptedEntityInfoPojo(data: DecryptedEntityInfo): Promise<object> {
    return {
      delegations: await this.decryptedDelegationInfoPojo(data.delegations),
      encryptionKeys: await this.decryptedDelegationInfoPojo(data.encryptionKeys),
      cryptedForeignKeys: await this.decryptedDelegationInfoPojo(data.cryptedForeignKeys),
    }
  }

  private async decryptedDelegationInfoPojo(data: DecryptedDelegationInfo): Promise<object> {
    const res = {} as { [encryptedDelegationKey: string]: object }
    for (const [encryptedDelegationKey, rawKeys] of Object.entries(data)) {
      const currRawKeys = {} as { [rawKey: string]: object }
      for (const [rawKey, result] of Object.entries(rawKeys)) {
        currRawKeys[rawKey] = result.pojo()
      }
      res[encryptedDelegationKey] = currRawKeys
    }
    return res
  }

  // res[0] -> self, res[1] -> self.parent, ...
  private async collectDataOwnerHierarchy(startOwnerId: string): Promise<Result<CachedDataOwner[]>> {
    return Result.wrap('collectDataOwnerHierarchy', async () => {
      const res = []
      res.push(await this.crypto.getDataOwner(startOwnerId, true))
      while (!!(res[res.length - 1].dataOwner as any).parentId) {
        res.push(await this.crypto.getDataOwner((res[res.length - 1].dataOwner as any).parentId, true))
      }
      return res
    })
  }

  private async collectAvailableKeys(): Promise<Result<{ [fp: string]: { publicKey: string; privateKey: string } }>> {
    return Result.wrap('collectAvailableKeys', async () => {
      const res = {} as { [fp: string]: { publicKey: string; privateKey: string } }
      for (const [fp, pair] of Object.entries(this.crypto.rsaKeyPairs)) {
        res[fp] = {
          publicKey: ua2hex(await this.crypto.RSA.exportKey(pair.publicKey, 'spki')),
          privateKey: ua2hex(await this.crypto.RSA.exportKey(pair.privateKey, 'pkcs8')),
        }
      }
      return res
    })
  }

  private async getDelegators(entities: EncryptedEntity[], hierarchyMemberId: string): Promise<Result<CachedDataOwner[]>> {
    return Result.wrap('getDelegators', async () => {
      const allDelegationLikes = entities.flatMap((e) => [
        ...(e.delegations?.[hierarchyMemberId] ?? []),
        ...(e.encryptionKeys?.[hierarchyMemberId] ?? []),
        ...(e.cryptedForeignKeys?.[hierarchyMemberId] ?? []),
      ])
      const ownerIds = new Set(allDelegationLikes.map((d) => d.owner))
      const res = []
      for (const ownerId of ownerIds) {
        if (!!ownerId) res.push(await this.crypto.getDataOwner(ownerId, true))
      }
      return res
    })
  }

  private async findEncryptedExchangeKeys(hierarchyMemberId: string): Promise<Result<EncryptedExchangeKeys>> {
    return Result.wrap('findEncryptedExchangeKeys', () => this.crypto.getEncryptedAesExchangeKeysForDelegate(hierarchyMemberId))
  }

  private async decryptExchangeKeys(hierarchyMemberId: string, delegatorsIds: string[]): Promise<Result<DelegatorAndKeys[]>> {
    return Result.wrap('decryptExchangeKeys', async () => this.crypto.decryptAndImportAesHcPartyKeysForDelegators(delegatorsIds, hierarchyMemberId))
  }

  private async decryptDelegations(keys: DelegatorAndKeys[], entities: EncryptedEntity[], hierarchyMemberId: string) {
    return Result.wrap('decryptDelegations', async () => {
      const res = {} as { [entityId: string]: DecryptedEntityInfo }
      for (const entity of entities) {
        const delegations = await this.decryptDelegationLikes(keys, entity.delegations?.[hierarchyMemberId] ?? [])
        const encryptionKeys = await this.decryptDelegationLikes(keys, entity.encryptionKeys?.[hierarchyMemberId] ?? [])
        const cryptedForeignKeys = await this.decryptDelegationLikes(keys, entity.cryptedForeignKeys?.[hierarchyMemberId] ?? [])
        res[entity.id!] = { delegations, encryptionKeys, cryptedForeignKeys }
      }
      return res
    })
  }

  private async decryptDelegationLikes(keys: DelegatorAndKeys[], delegationLikes: Delegation[]): Promise<DecryptedDelegationInfo> {
    const res = {} as DecryptedDelegationInfo
    for (const currDelegation of delegationLikes) {
      const currDelegationRes = {} as { [rawKey: string]: Result<string> }
      for (const currKey of keys) {
        if (currKey.delegatorId == currDelegation.owner) {
          currDelegationRes[currKey.rawKey] = await Result.wrap('decryptDelegation', async () => {
            const decrypted = await this.crypto.AES.decrypt(currKey.key, hex2ua(currDelegation.key!))
            return ua2string(decrypted)
          })
        }
      }
      res[currDelegation.key!] = currDelegationRes
    }
    return res
  }
}
