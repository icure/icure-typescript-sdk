import { b64_2ab, EncryptedEntityWithType, EntityWithDelegationTypeName, hex2ua, ua2string } from '../utils'
import { ExchangeKeysManager } from './ExchangeKeysManager'
import { CryptoPrimitives } from './CryptoPrimitives'
import { Delegation } from '../../icc-api/model/Delegation'
import { ExchangeDataManager } from './ExchangeDataManager'
import { ExchangeDataMapManager } from './ExchangeDataMapManager'
import { SecureDelegationsEncryption } from './SecureDelegationsEncryption'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { EncryptedEntity, EncryptedEntityStub, SecureDelegation } from '../../icc-api/model/models'
import { ExchangeData } from '../../icc-api/model/internal/ExchangeData'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum

export type DelegationMembersDetails = {
  delegator: string | undefined
  delegate: string | undefined
  fullyExplicit: boolean
  accessControlSecret: string | undefined
  accessLevel: AccessLevelEnum
}

export enum SecurityMetadataType {
  SecretId = 1, // Start from 1, avoids issues with SecretId being falsy
  EncryptionKey,
  OwningEntityId,
}

export class SecurityMetadataDecryptor {
  constructor(
    private readonly exchangeKeysManager: ExchangeKeysManager,
    private readonly primitives: CryptoPrimitives,
    private readonly exchangeData: ExchangeDataManager,
    private readonly exchangeDataMap: ExchangeDataMapManager,
    private readonly secureDelegationsEncryption: SecureDelegationsEncryption,
    private readonly dataOwnerApi: IccDataOwnerXApi
  ) {}

  async decryptLegacyDelegations(
    entities: (EncryptedEntityStub | EncryptedEntity)[],
    dataOwnersHierarchySubset: string[],
    metadataType: SecurityMetadataType
  ): Promise<{ [entityId: string]: string[] }> {
    // For legacy delegations there is no advantage in doing stuff in bulk.
    const res: { [entityId: string]: string[] } = {}
    for (const e of entities) {
      const allDecrypted = await this.extractFromLegacyDelegations(e, dataOwnersHierarchySubset, metadataType)
      const deduplicatedDecrypted = new Set(allDecrypted.map((x) => x.decrypted))
      res[e.id!] = [...deduplicatedDecrypted]
    }
    return res
  }

  private async extractFromLegacyDelegations(
    entity: EncryptedEntityStub | EncryptedEntity,
    dataOwnersHierarchySubset: string[],
    metadataType: SecurityMetadataType
  ): Promise<{ decrypted: string; dataOwnersWithAccess: string[] }[]> {
    if (!dataOwnersHierarchySubset.length) throw new Error("`dataOwnersHierarchySubset` can't be empty")
    let delegations: { [delegateId: string]: Delegation[] }
    let validateDecrypted: (result: string) => Promise<boolean> = (x) => Promise.resolve(!!x)
    let mapDecrypted: (result: string) => string = (x) => x
    switch (metadataType) {
      case SecurityMetadataType.SecretId:
        delegations = entity.delegations ?? {}
        break
      case SecurityMetadataType.EncryptionKey:
        delegations = entity.encryptionKeys ?? {}
        validateDecrypted = async (key) => {
          if (!/^[0-9A-Fa-f\-]+$/g.test(key)) return false
          try {
            await this.primitives.AES.importKey('raw', hex2ua(key.replace(/-/g, '')))
            return true
          } catch (e) {
            console.warn(`Could not import key ${key} as an encryption key.`, e)
            return false
          }
        }
        mapDecrypted = (key) => key.replace(/-/g, '')
        break
      case SecurityMetadataType.OwningEntityId:
        delegations = entity.cryptedForeignKeys ?? {}
        break
      default:
        throw new Error(`Internal error: invalid SecurityMetadataType ${metadataType}`)
    }
    const delegationsWithOwner = Object.entries(delegations).flatMap(([delegateId, delegations]) =>
      dataOwnersHierarchySubset.some((dataOwnerId) => dataOwnerId === delegateId)
        ? this.populateLegacyDelegationDelegate(delegateId, delegations)
        : this.populateLegacyDelegationDelegate(
            delegateId,
            delegations.filter((d) => dataOwnersHierarchySubset.some((dataOwnerId) => d.owner === dataOwnerId))
          )
    )
    const res: { decrypted: string; dataOwnersWithAccess: string[] }[] = []
    for (const delegation of delegationsWithOwner) {
      const decrypted = await this.tryDecryptLegacyDelegation(delegation, (k) => validateDecrypted(k))
      if (decrypted)
        res.push({
          decrypted: mapDecrypted(decrypted),
          dataOwnersWithAccess: delegation.owner ? [delegation.owner, delegation.delegatedTo!] : [delegation.delegatedTo!],
        })
    }
    return res
  }

  private populateLegacyDelegationDelegate(delegateId: string, delegations: Delegation[]): Delegation[] {
    return delegations.map((d) => (d.delegatedTo === delegateId ? d : { ...d, delegatedTo: delegateId }))
  }

  private async tryDecryptLegacyDelegation(
    delegation: Delegation,
    validateDecrypted: (result: string) => Promise<boolean>
  ): Promise<string | undefined> {
    const exchangeKeys = await this.exchangeKeysManager.getDecryptionExchangeKeysFor(delegation.owner!, delegation.delegatedTo!)
    for (const key of exchangeKeys) {
      try {
        // Format of encrypted key for any delegation should be entityId:key, but with the merging of entities the entityId might not match the
        // current id. As a checksum we are only verifying that the decrypted bytes can be represented as a string with exactly one ':'.
        // Additionally, we also have a validator that is specific for each type of delegation content (encryption key, secret id, ...)
        const decrypted = ua2string(await this.primitives.AES.decrypt(key, hex2ua(delegation.key!)))
        const decryptedSplit = decrypted.split(':')
        if (decryptedSplit.length === 2) {
          if (await validateDecrypted(decryptedSplit[1])) return decryptedSplit[1]
        } else {
          console.warn("Error in the decrypted delegation: content should contain exactly 1 ':', the delegation is ignored.")
        }
      } catch (e) {
        // Do nothing: the delegation uses another exchange key owner->delegator
      }
    }
  }

  async decryptSecureDelegationsUsingCache(
    entities: (EncryptedEntityStub | EncryptedEntity)[],
    dataOwnersHierarchySubset: string[],
    metadataType: SecurityMetadataType
  ): Promise<{ [entityId: string]: string[] }> {
    const toSearchById: Set<string> = new Set([])
    const toSearchByDelegationKey: Set<string> = new Set([])
    for (const e of entities) {
      for (const [delegationKey, delegation] of Object.entries(e.securityMetadata?.secureDelegations ?? {})) {
        if (
          !delegation.delegator ||
          !delegation.delegate ||
          dataOwnersHierarchySubset.some((it) => it == delegation.delegator || it == delegation.delegator)
        ) {
          if (delegation.exchangeDataId) {
            toSearchById.add(delegation.exchangeDataId)
          } else {
            toSearchByDelegationKey.add(delegationKey)
          }
        }
      }
    }
    const cachedByExchangeDataId = await this.exchangeData.getDecryptionDataKeyByIds([...toSearchById], false)
    const cachedByDelegationKey = await this.exchangeData.getCachedDecryptionDataKeyByAccessControlHash([...toSearchByDelegationKey])
    const res: { [entityId: string]: string[] } = {}
    for (const entity of entities) {
      const currEntityRes: Set<string> = new Set([])
      for (const [delegationKey, delegation] of Object.entries(entity.securityMetadata?.secureDelegations ?? {})) {
        const cached = delegation.exchangeDataId ? cachedByExchangeDataId[delegation.exchangeDataId] : cachedByDelegationKey[delegationKey]
        if (
          cached?.exchangeKey &&
          dataOwnersHierarchySubset.some((it) => it == cached?.exchangeData?.delegator || it == cached?.exchangeData?.delegate)
        ) {
          ;(await this.decryptSecureDelegationMetadata(delegation, metadataType, cached.exchangeKey)).forEach((decrypted) =>
            currEntityRes.add(decrypted)
          )
        }
      }
      res[entity.id!] = [...currEntityRes]
    }
    return res
  }

  hasSecurityMetadataOfType(delegation: SecureDelegation, metadataType: SecurityMetadataType): boolean {
    switch (metadataType) {
      case SecurityMetadataType.SecretId:
        return (delegation.secretIds ?? []).length > 0
      case SecurityMetadataType.EncryptionKey:
        return (delegation.encryptionKeys ?? []).length > 0
      case SecurityMetadataType.OwningEntityId:
        return (delegation.owningEntityIds ?? []).length > 0
      default:
        throw new Error('Internal error: invalid metadata type')
    }
  }

  async decryptSecureDelegationsUsingKnownExchangeData(
    entities: (EncryptedEntityStub | EncryptedEntity)[],
    dataOwnersHierarchySubset: string[],
    metadataType: SecurityMetadataType
  ): Promise<{ [entityId: string]: string[] }> {
    const toSearchById: Set<string> = new Set([])
    for (const e of entities) {
      for (const delegation of Object.values(e.securityMetadata?.secureDelegations ?? {})) {
        if (dataOwnersHierarchySubset.some((it) => it == delegation.delegator || it == delegation.delegator)) {
          if (delegation.exchangeDataId && this.hasSecurityMetadataOfType(delegation, metadataType)) {
            toSearchById.add(delegation.exchangeDataId)
          }
        }
      }
    }
    const retrievedByExchangeDataId = toSearchById.size > 0 ? await this.exchangeData.getDecryptionDataKeyByIds([...toSearchById], true) : {}
    const res: { [entityId: string]: string[] } = {}
    for (const entity of entities) {
      const currEntityRes: Set<string> = new Set([])
      for (const delegation of Object.values(entity.securityMetadata?.secureDelegations ?? {})) {
        const currDelegationExchangeData = delegation.exchangeDataId ? retrievedByExchangeDataId[delegation.exchangeDataId] : undefined
        if (currDelegationExchangeData?.exchangeKey) {
          ;(await this.decryptSecureDelegationMetadata(delegation, metadataType, currDelegationExchangeData.exchangeKey)).forEach((decrypted) =>
            currEntityRes.add(decrypted)
          )
        }
      }
      res[entity.id!] = [...currEntityRes]
    }
    return res
  }

  async decryptSecureDelegationsUsingExchangeDataMap(
    entities: (EncryptedEntityStub | EncryptedEntity)[],
    dataOwnersHierarchySubset: string[],
    metadataType: SecurityMetadataType
  ): Promise<{ [entityId: string]: string[] }> {
    const toSearchByExchangeDataMap: Set<string> = new Set([])
    for (const e of entities) {
      for (const [delegationKey, delegation] of Object.entries(e.securityMetadata?.secureDelegations ?? {})) {
        if (dataOwnersHierarchySubset.some((it) => it == delegation.delegator || it == delegation.delegator)) {
          if (!delegation.exchangeDataId && this.hasSecurityMetadataOfType(delegation, metadataType)) {
            toSearchByExchangeDataMap.add(delegationKey)
          }
        }
      }
    }
    const exchangeDataMaps =
      toSearchByExchangeDataMap.size > 0 ? await this.exchangeDataMap.getExchangeDataMapBatch([...toSearchByExchangeDataMap]) : []
    const exchangeDataIdByDelegationKey: { [delegationKey: string]: string } = {}
    for (const exchangeDataMap of exchangeDataMaps) {
      const decrypted = await this.secureDelegationsEncryption.decryptExchangeDataId(exchangeDataMap.encryptedExchangeDataIds)
      if (decrypted) {
        exchangeDataIdByDelegationKey[exchangeDataMap.id] = decrypted
      }
    }
    if (Object.keys(exchangeDataIdByDelegationKey).length == 0) return {}
    const retrievedByExchangeDataId =
      Object.values(exchangeDataIdByDelegationKey).length > 0
        ? await this.exchangeData.getDecryptionDataKeyByIds([...new Set(Object.values(exchangeDataIdByDelegationKey))], true)
        : {}
    const res: { [entityId: string]: string[] } = {}
    for (const entity of entities) {
      const currEntityRes: Set<string> = new Set([])
      for (const [delegationKey, delegation] of Object.entries(entity.securityMetadata?.secureDelegations ?? {})) {
        const exchangeDataId = exchangeDataIdByDelegationKey[delegationKey]
        const cached = exchangeDataId ? retrievedByExchangeDataId[exchangeDataId] : undefined
        if (cached?.exchangeKey) {
          ;(await this.decryptSecureDelegationMetadata(delegation, metadataType, cached.exchangeKey)).forEach((decrypted) =>
            currEntityRes.add(decrypted)
          )
        }
      }
      res[entity.id!] = [...currEntityRes]
    }
    return res
  }

  async decryptAll(
    entity: EncryptedEntityStub | EncryptedEntity,
    dataOwnersHierarchySubset: string[],
    metadataType: SecurityMetadataType
  ): Promise<{ ownerId: string; extracted: string[] }[]> {
    const allExtractedWithDataOwners = [
      ...(await this.decryptAllLegacyDelegations(entity, dataOwnersHierarchySubset, metadataType)),
      ...(await this.decryptAllSecureDelegations(entity, dataOwnersHierarchySubset, metadataType)),
    ]
    return dataOwnersHierarchySubset.map((dataOwner) => {
      const decryptedEntriesForDataOwner = allExtractedWithDataOwners
        .filter((x) => x.dataOwnersWithAccess.some((d) => dataOwner == d))
        .map((x) => x.decrypted)
      return {
        ownerId: dataOwner,
        extracted: [...new Set(decryptedEntriesForDataOwner)],
      }
    })
  }

  async decryptAllLegacyDelegations(
    entity: EncryptedEntityStub | EncryptedEntity,
    dataOwnersHierarchySubset: string[],
    metadataType: SecurityMetadataType
  ): Promise<{ decrypted: string; dataOwnersWithAccess: string[] }[]> {
    return this.extractFromLegacyDelegations(entity, dataOwnersHierarchySubset, metadataType)
  }

  async decryptAllSecureDelegations(
    entity: EncryptedEntityStub | EncryptedEntity,
    dataOwnersHierarchySubset: string[],
    metadataType: SecurityMetadataType
  ): Promise<{ decrypted: string; dataOwnersWithAccess: string[] }[]> {
    const secureDelegationEntries: [string, SecureDelegation][] = Object.entries(entity.securityMetadata?.secureDelegations ?? {})
    const toSearchByDelegationKey: string[] = secureDelegationEntries.flatMap(([delegationKey, delegation]): string[] => {
      if (!delegation.exchangeDataId) {
        return [delegationKey]
      } else {
        return []
      }
    })
    const exchangeDataByDelegationKey = await this.exchangeData.getCachedDecryptionDataKeyByAccessControlHash(toSearchByDelegationKey)
    const toSearchWithExchangeDataMap = secureDelegationEntries.flatMap(([delegationKey, delegation]): string[] => {
      if (
        !delegation.exchangeDataId &&
        dataOwnersHierarchySubset.some((it) => delegation.delegate == it || delegation.delegator == it) &&
        !exchangeDataIdByDelegationKey[delegationKey] &&
        this.hasSecurityMetadataOfType(delegation, metadataType)
      ) {
        return [delegationKey]
      } else {
        return []
      }
    })
    const exchangeDataMaps =
      toSearchWithExchangeDataMap.length > 0 ? await this.exchangeDataMap.getExchangeDataMapBatch(toSearchWithExchangeDataMap) : []
    const exchangeDataIdByDelegationKey: { [delegationKey: string]: string } = {}
    for (const exchangeDataMap of exchangeDataMaps) {
      const decrypted = await this.secureDelegationsEncryption.decryptExchangeDataId(exchangeDataMap.encryptedExchangeDataIds)
      if (decrypted) {
        exchangeDataIdByDelegationKey[exchangeDataMap.id] = decrypted
      }
    }
    const toSearchDirectlyById = secureDelegationEntries.flatMap(([delegationKey, delegation]): string[] => {
      if (
        delegation.exchangeDataId &&
        dataOwnersHierarchySubset.some((it) => delegation.delegate == it || delegation.delegator == it) &&
        !exchangeDataIdByDelegationKey[delegationKey] &&
        this.hasSecurityMetadataOfType(delegation, metadataType)
      ) {
        return [delegation.exchangeDataId]
      } else {
        return []
      }
    })
    const allExchangeDataIdToRetrieve = [...new Set([...toSearchDirectlyById, ...Object.values(exchangeDataIdByDelegationKey)])]
    const exchangeDataById =
      allExchangeDataIdToRetrieve.length > 0 ? await this.exchangeData.getDecryptionDataKeyByIds(allExchangeDataIdToRetrieve, true) : {}
    const allExtractedWithDataOwners: { decrypted: string; dataOwnersWithAccess: string[] }[] = []
    for (const [delegationKey, delegation] of secureDelegationEntries) {
      let exchangeData:
        | {
            exchangeKey: CryptoKey | undefined
            accessControlSecret: string | undefined
            exchangeData: ExchangeData
          }
        | undefined = undefined
      if (exchangeDataByDelegationKey[delegationKey]) {
        exchangeData = exchangeDataByDelegationKey[delegationKey]
      } else if (delegation.exchangeDataId) {
        exchangeData = exchangeDataById[delegation.exchangeDataId]
      } else if (exchangeDataIdByDelegationKey[delegationKey]) {
        exchangeData = exchangeDataById[exchangeDataIdByDelegationKey[delegationKey]]
      }
      if (exchangeData && exchangeData.exchangeKey) {
        const decrypted = await this.decryptSecureDelegationMetadata(delegation, metadataType, exchangeData.exchangeKey)
        for (const d of decrypted) {
          allExtractedWithDataOwners.push({
            decrypted: d,
            dataOwnersWithAccess: [exchangeData.exchangeData.delegator, exchangeData.exchangeData.delegate],
          })
        }
      }
    }
    return allExtractedWithDataOwners
  }

  async getDelegationMemberDetails(typedEntity: EncryptedEntityWithType): Promise<{
    [delegationKey: string]: DelegationMembersDetails
  }> {
    const res: { [delegationKey: string]: DelegationMembersDetails } = {}
    // 1. Add all explicit data owners, keep only delegations with at least an anonymous data owner to check later
    let remainingDelegations = Object.entries(typedEntity.entity.securityMetadata?.secureDelegations ?? {})
    let updatedRemainingDelegations: [string, SecureDelegation][] = []
    for (const delegationEntry of remainingDelegations) {
      const delegation = delegationEntry[1]
      if (delegation.delegator && delegation.delegate) {
        res[delegationEntry[0]] = {
          delegate: delegation.delegate,
          delegator: delegation.delegator,
          fullyExplicit: true,
          accessLevel: delegation.permissions,
          accessControlSecret: undefined,
        }
      } else {
        updatedRemainingDelegations.push(delegationEntry)
      }
    }
    remainingDelegations = updatedRemainingDelegations
    if (!remainingDelegations.length) return res
    updatedRemainingDelegations = []
    // 2. Attempt to identify the anonymous data owner of remaining delegations by checking if we have the exchange data cached by hash
    // Note: we can find exchange data by hash only if we could successfully decrypt it
    const cachedExchangeData = await this.exchangeData.getCachedDecryptionDataKeyByAccessControlHash(remainingDelegations.map((d) => d[0]))
    for (const delegationEntry of remainingDelegations) {
      const exchangeDataOfDelegation = cachedExchangeData[delegationEntry[0]]
      if (exchangeDataOfDelegation) {
        res[delegationEntry[0]] = {
          delegate: exchangeDataOfDelegation.exchangeData.delegate,
          delegator: exchangeDataOfDelegation.exchangeData.delegator,
          fullyExplicit: false,
          accessLevel: delegationEntry[1].permissions,
          accessControlSecret: exchangeDataOfDelegation.accessControlSecret,
        }
      } else {
        updatedRemainingDelegations.push(delegationEntry)
      }
    }
    remainingDelegations = updatedRemainingDelegations
    if (!remainingDelegations.length) return res
    updatedRemainingDelegations = []
    // 3. Attempt to identify the anonymous data owner of remaining delegations between us (or one of our parents) and an anonymous data owner
    const hierarchy = await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()
    const remainingExchangeDataMaps = await this.exchangeDataMap.getExchangeDataMapBatch(remainingDelegations.map(([hash, _]) => hash))
    const exchangeDataIdByDelegationKey: { [delegationKey: string]: string } = {}
    for (const exchangeDataMap of remainingExchangeDataMaps) {
      const decrypted = await this.secureDelegationsEncryption.decryptExchangeDataId(exchangeDataMap.encryptedExchangeDataIds)
      if (decrypted) {
        exchangeDataIdByDelegationKey[exchangeDataMap.id] = decrypted
      }
    }
    const exchangeDataByIds = await this.exchangeData.getDecryptionDataKeyByIds(Object.values(exchangeDataIdByDelegationKey), true)
    for (const [hash, delegation] of remainingDelegations) {
      if (hierarchy.some((x) => x === delegation.delegate || x === delegation.delegator)) {
        const dataId = exchangeDataIdByDelegationKey[hash]
        const exchangeDataInfo = dataId ? exchangeDataByIds[dataId] : undefined
        if (exchangeDataInfo) {
          res[hash] = {
            delegator: exchangeDataInfo.exchangeData.delegator,
            delegate: exchangeDataInfo.exchangeData.delegate,
            fullyExplicit: false,
            accessLevel: delegation.permissions,
            accessControlSecret: exchangeDataInfo.accessControlSecret,
          }
        } else {
          updatedRemainingDelegations.push([hash, delegation])
        }
      } else {
        updatedRemainingDelegations.push([hash, delegation])
      }
    }
    return {
      ...res,
      ...Object.fromEntries(
        updatedRemainingDelegations.map(([hash, secureDelegation]) => [
          hash,
          {
            delegator: secureDelegation.delegator,
            delegate: secureDelegation.delegate,
            fullyExplicit: false,
            accessLevel: secureDelegation.permissions,
            accessControlSecret: undefined,
          },
        ])
      ),
    }
  }

  async decryptSecureDelegationMetadata(delegation: SecureDelegation, metadataType: SecurityMetadataType, key: CryptoKey): Promise<string[]> {
    switch (metadataType) {
      case SecurityMetadataType.SecretId:
        return this.secureDelegationsEncryption.decryptSecretIds(delegation, key)
      case SecurityMetadataType.EncryptionKey:
        return this.secureDelegationsEncryption.decryptEncryptionKeys(delegation, key)
      case SecurityMetadataType.OwningEntityId:
        return this.secureDelegationsEncryption.decryptOwningEntityIds(delegation, key)
      default:
        throw new Error(`Internal error: invalid SecurityMetadataType ${metadataType}`)
    }
  }

  async getEntityLegacyDelegationAccessLevel(
    entity: EncryptedEntityStub | EncryptedEntity,
    dataOwnersHierarchySubset: string[]
  ): Promise<AccessLevelEnum | undefined> {
    if (!dataOwnersHierarchySubset.length) throw new Error("`dataOwnersHierarchySubset` can't be empty")
    // Legacy delegations provide write access
    if (Object.keys(entity.delegations ?? {}).some((delegate) => dataOwnersHierarchySubset.includes(delegate))) {
      return AccessLevelEnum.WRITE
    }
    return undefined
  }

  async getEntitySecureDelegationAccessLevel(
    entity: EncryptedEntityStub | EncryptedEntity,
    dataOwnersHierarchySubset: string[]
  ): Promise<AccessLevelEnum | undefined> {
    if (!dataOwnersHierarchySubset.length) throw new Error("`dataOwnersHierarchySubset` can't be empty")
    // If the data owner is explicit all delegations he can access has his id. If the delegator is anonymous all delegations he can access are
    // accessible by hash. No mixed scenario possible.
    let accessibleDelegations: SecureDelegation[] = Object.values(entity.securityMetadata?.secureDelegations ?? {}).filter((secureDelegation) =>
      dataOwnersHierarchySubset.some((dataOwner) => dataOwner === secureDelegation.delegator || dataOwner === secureDelegation.delegate)
    )
    if (!accessibleDelegations.length) {
      const availableCanonicalHashes = Object.keys(
        await this.exchangeData.getCachedDecryptionDataKeyByAccessControlHash(Object.keys(entity.securityMetadata?.secureDelegations ?? {}))
      )
      accessibleDelegations = availableCanonicalHashes.map((hash) => (entity.securityMetadata?.secureDelegations ?? {})[hash])
    }
    const permissions = accessibleDelegations.map((secureDelegation) => secureDelegation.permissions)
    let maxLevel: AccessLevelEnum | undefined = undefined
    for (const permission of permissions) {
      if (permission === AccessLevelEnum.WRITE) {
        return AccessLevelEnum.WRITE
      }
      if (permission === AccessLevelEnum.READ) {
        maxLevel = AccessLevelEnum.READ
      }
    }
    return maxLevel
  }

  async getEntityAccessLevel(
    entity: EncryptedEntityStub | EncryptedEntity,
    dataOwnersHierarchySubset: string[]
  ): Promise<AccessLevelEnum | undefined> {
    const legacyAccess = await this.getEntityLegacyDelegationAccessLevel(entity, dataOwnersHierarchySubset)
    if (legacyAccess != undefined) return legacyAccess
    return this.getEntitySecureDelegationAccessLevel(entity, dataOwnersHierarchySubset)
  }

  hasAnyEncryptionKeys(entity: EncryptedEntityStub | EncryptedEntity): boolean {
    return Object.keys(entity.encryptionKeys ?? {}).length > 0 || Object.keys(entity.securityMetadata?.secureDelegations ?? {}).length > 0
  }
}
