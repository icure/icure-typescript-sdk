import { CachedDataOwner, DelegatorAndKeys, IccCryptoXApi } from '../icc-crypto-x-api'
import { Delegation, EncryptedEntity } from '../../icc-api/model/models'
import { hex2ua, string2ua, ua2hex, ua2string } from './binary-utils'

interface Result<A> {
  map<B>(f: (content: A) => Promise<B>): Promise<Result<B>>
  mapErrorMsg(f: (errorMsg: string) => string): Result<A>
  flatMap<B>(f: (content: A) => Promise<Result<B>>): Promise<Result<B>>
  pojo(): any
  getOrElse(defaultValue: () => A): A
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

    getOrElse(defaultValue: () => A): A {
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

    getOrElse(defaultValue: () => never): never {
      return defaultValue()
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

type DecryptedDelegationInfo = { [encryptedDelegationKey: string]: { [rawKey: string]: Result<string> } } // rawKey: exchangeKey used in the decryption

type DecryptedEntityInfo = {
  delegations: DecryptedDelegationInfo
  encryptionKeys: DecryptedDelegationInfo
  cryptedForeignKeys: DecryptedDelegationInfo
}

type EncryptedExchangeKeys = { [delegator: string]: { [mainXkDelegatorPubFp: string]: { [xkEncryptionPubFp: string]: string /*encryptedXkByKey*/ } } }

type ByDataOwnerData = {
  delegators: Result<CachedDataOwner[]>
  encryptedExchangeKeys: Result<EncryptedExchangeKeys> // As retrieved using the view: may differ from data retrieved by delegators
  decryptedExchangeKeys: Result<DelegatorAndKeys[]>
  decryptedEntitiesMetadata: Result<{ [entityId: string]: DecryptedEntityInfo }>
}

type FullData = {
  description: string
  involvedEntities: EncryptedEntity[]
  hierarchy: Result<CachedDataOwner[]>
  availableKeypairsPublic: Result<{ [fp: string]: string }>
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
    minimalData: object // Does not contain any sensitive data
    fullData: object // May contain sensitive data, we should not ask for it unless desperate
  }> {
    const fullData = await this.collectFullData(description, involvedEntities, dataOwnerId)
    return {
      fullData: await new FullDataExporter(this.crypto).exportDataToPojo(fullData),
      minimalData: await new MinimalDataExporter(this.crypto).exportDataToPojo(fullData),
    }
  }

  private async collectFullData(description: string, involvedEntities: EncryptedEntity[], dataOwnerId: string): Promise<FullData> {
    const hierarchy = await this.collectDataOwnerHierarchy(dataOwnerId)
    const availableKeypairsPublic = await this.collectAvailableKeypairsPublic()
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
      availableKeypairsPublic,
      byDataOwner,
    }
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

  private async collectAvailableKeypairsPublic(): Promise<Result<{ [fp: string]: string }>> {
    return Result.wrap('collectAvailableKeypairsPublic', async () => {
      const res = {} as { [fp: string]: string }
      for (const [fp, pair] of Object.entries(this.crypto.rsaKeyPairs)) {
        res[fp] = ua2hex(await this.crypto.RSA.exportKey(pair.publicKey, 'spki'))
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

abstract class DataExporter {
  protected constructor(protected readonly crypto: IccCryptoXApi) {}

  async exportDataToPojo(data: FullData): Promise<object> {
    /*
     * To make sure we don't leak info we salt sensitive data before hasing it (for example we want to make sure that we are unable to figure out the
     * actual value of a cfk by comparing its hash to the hash of all the ids of patients/messages in the database)
     */
    const salt = this.crypto.randomUuid()
    const errorMsgSubstitutions = await this.getErrorMsgSubstitutions(data, salt)
    return {
      description: data.description,
      involvedEntities: data.involvedEntities.map((x) => this.encryptedEntityPojo(x)),
      hierarchy: (await data.hierarchy.map((res) => Promise.resolve(res.map((x) => this.dataOwnerPojo(x)))))
        .mapErrorMsg((x) => this.applyErrorMsgSubstitutions(x, errorMsgSubstitutions))
        .pojo(),
      availableKeypairsPublic: data.availableKeypairsPublic.mapErrorMsg((x) => this.applyErrorMsgSubstitutions(x, errorMsgSubstitutions)).pojo(),
      byDataOwner: (
        await data.byDataOwner.map(async (byDataOwnerContent) => {
          const res = {} as { [dataOwnerId: string]: object }
          for (const [dataOwnerId, dataOwnerContent] of Object.entries(byDataOwnerContent)) {
            res[dataOwnerId] = {
              delegators: (await dataOwnerContent.delegators.map((ds) => Promise.resolve(ds.map((d) => this.dataOwnerPojo(d)))))
                .mapErrorMsg((x) => this.applyErrorMsgSubstitutions(x, errorMsgSubstitutions))
                .pojo(),
              encryptedExchangeKeys: dataOwnerContent.encryptedExchangeKeys
                .mapErrorMsg((x) => this.applyErrorMsgSubstitutions(x, errorMsgSubstitutions))
                .pojo(),
              decryptedExchangeKeys: (await dataOwnerContent.decryptedExchangeKeys.map((x) => this.decryptedExchangeKeysPojo(x, salt)))
                .mapErrorMsg((x) => this.applyErrorMsgSubstitutions(x, errorMsgSubstitutions))
                .pojo(),
              decryptedEntitiesMetadata: (
                await dataOwnerContent.decryptedEntitiesMetadata.map(async (decryptedEntitiesData) => {
                  const currEntityData = {} as { [entityId: string]: object }
                  for (const [entityId, entityData] of Object.entries(decryptedEntitiesData)) {
                    currEntityData[entityId] = await this.decryptedEntityInfoPojo(entityData, salt, errorMsgSubstitutions)
                  }
                  return currEntityData
                })
              )
                .mapErrorMsg((x) => this.applyErrorMsgSubstitutions(x, errorMsgSubstitutions))
                .pojo(),
            }
          }
          return res
        })
      )
        .mapErrorMsg((x) => this.applyErrorMsgSubstitutions(x, errorMsgSubstitutions))
        .pojo(),
    }
  }

  protected abstract getErrorMsgSubstitutions(data: FullData, salt: string): Promise<{ [key: string]: string }>
  protected abstract encryptedEntityPojo(entity: EncryptedEntity): object
  protected abstract dataOwnerPojo(dataOwner: CachedDataOwner): object
  protected async decryptedExchangeKeysPojo(decryptedExchangeKeys: DelegatorAndKeys[], hashingSalt: string): Promise<object> {
    const res = []
    for (const d of decryptedExchangeKeys) {
      res.push({
        delegatorId: d.delegatorId,
        keyInfo: await this.processRawSecretToExtendedInfo(d.rawKey, hashingSalt),
      })
    }
    return res
  }
  private async decryptedEntityInfoPojo(data: DecryptedEntityInfo, salt: string, errorMsgSubstitutions: { [key: string]: string }): Promise<object> {
    return {
      delegations: await this.decryptedDelegationInfoPojo(data.delegations, salt, errorMsgSubstitutions),
      encryptionKeys: await this.decryptedDelegationInfoPojo(data.encryptionKeys, salt, errorMsgSubstitutions),
      cryptedForeignKeys: await this.decryptedDelegationInfoPojo(data.cryptedForeignKeys, salt, errorMsgSubstitutions),
    }
  }
  private async decryptedDelegationInfoPojo(
    data: DecryptedDelegationInfo,
    salt: string,
    errorMsgSubstitutions: { [key: string]: string }
  ): Promise<object> {
    const res = {} as { [encryptedDelegationKey: string]: object }
    for (const [encryptedDelegationKey, rawKeys] of Object.entries(data)) {
      const currRawKeys = {} as { [rawKey: string]: object }
      for (const [rawKey, result] of Object.entries(rawKeys)) {
        currRawKeys[await this.processRawSecretToString(rawKey, salt)] = (await result.map((x) => this.processRawSecretToExtendedInfo(x, salt)))
          .mapErrorMsg((x) => this.applyErrorMsgSubstitutions(x, errorMsgSubstitutions))
          .pojo()
      }
      res[encryptedDelegationKey] = currRawKeys
    }
    return res
  }
  protected abstract processRawSecretToString(rawSecret: string, salt: string): Promise<string>
  protected abstract processRawSecretToExtendedInfo(rawSecret: string, salt: string): Promise<any>

  private applyErrorMsgSubstitutions(msg: string, substitutions: { [key: string]: string }): string {
    let res = msg
    for (const [key, value] of Object.entries(substitutions)) {
      res = res.split(key).join(value) // Replace all
    }
    return res
  }
}

class FullDataExporter extends DataExporter {
  constructor(crypto: IccCryptoXApi) {
    super(crypto)
  }

  protected dataOwnerPojo(dataOwner: CachedDataOwner): object {
    return dataOwner
  }

  protected encryptedEntityPojo(entity: EncryptedEntity): object {
    return entity
  }

  protected processRawSecretToExtendedInfo(rawSecret: string, salt: string): Promise<any> {
    return Promise.resolve(rawSecret)
  }

  protected processRawSecretToString(rawSecret: string, salt: string): Promise<string> {
    return Promise.resolve(rawSecret)
  }

  protected getErrorMsgSubstitutions(data: FullData, salt: string): Promise<{ [p: string]: string }> {
    return Promise.resolve({})
  }
}

class MinimalDataExporter extends DataExporter {
  constructor(crypto: IccCryptoXApi) {
    super(crypto)
  }

  protected dataOwnerPojo(dataOwner: CachedDataOwner): object {
    return {
      id: dataOwner.dataOwner.id,
      rev: dataOwner.dataOwner.rev,
      type: dataOwner.type,
      publicKey: dataOwner.dataOwner.publicKey,
      aesExchangeKeys: dataOwner.dataOwner.aesExchangeKeys,
      hcPartyKeys: dataOwner.dataOwner.hcPartyKeys,
    }
  }

  protected encryptedEntityPojo(entity: EncryptedEntity): object {
    return {
      id: entity.id,
      rev: entity.rev,
      delegations: entity.delegations,
      cryptedForeignKeys: entity.cryptedForeignKeys,
      encryptionKeys: entity.encryptionKeys,
      secretForeignKeys: entity.secretForeignKeys,
    }
  }

  protected async processRawSecretToExtendedInfo(rawSecret: string, salt: string): Promise<any> {
    return {
      hashedValue: await this.hashWithSalt(rawSecret, salt),
      ...this.analyseRawSecret(rawSecret),
      byColumnSeparatedPiece: rawSecret.includes(':') ? rawSecret.split(':').map((x) => this.analyseRawSecret(x)) : undefined,
    }
  }

  private analyseRawSecret(rawSecret: string): object {
    return {
      length: rawSecret.length,
      isUuid: !!rawSecret.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
      isSameCaseHex: !!rawSecret.match(/^[0-9a-f]+$/) || !!rawSecret.match(/^[0-9A-F]+$/),
      isMixedCaseHex: !!rawSecret.match(/^[0-9a-fA-F]+$/),
    }
  }

  protected processRawSecretToString(rawSecret: string, salt: string): Promise<string> {
    return this.hashWithSalt(rawSecret, salt)
  }

  private async hashWithSalt(data: string, hashingSalt: string): Promise<string> {
    return ua2hex(await this.crypto.sha256(string2ua(data + hashingSalt)))
  }

  protected async getErrorMsgSubstitutions(data: FullData, salt: string): Promise<{ [p: string]: string }> {
    const res: { [p: string]: string } = {}
    for (const infoOfCurrentDataOnwer of Object.values(data.byDataOwner.getOrElse(() => ({})))) {
      for (const key of infoOfCurrentDataOnwer.decryptedExchangeKeys.getOrElse(() => [])) {
        res[key.rawKey] = 'hashedRawKey-' + (await this.hashWithSalt(key.delegatorId, salt))
      }
    }
    return res
  }
}
