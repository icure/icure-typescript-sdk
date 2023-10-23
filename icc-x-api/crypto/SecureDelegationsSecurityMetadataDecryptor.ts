import { SecurityMetadataDecryptor } from './SecurityMetadataDecryptor'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import { ExchangeDataManager } from './ExchangeDataManager'
import { EncryptedEntityWithType } from '../utils/EntityWithDelegationTypeName'
import { ExchangeData } from '../../icc-api/model/internal/ExchangeData'
import { SecureDelegationsEncryption } from './SecureDelegationsEncryption'
import AccessLevel = SecureDelegation.AccessLevelEnum
import { EncryptedEntity, EncryptedEntityStub } from '../../icc-api/model/models'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { ExchangeDataMapManager } from './ExchangeDataMapManager'
import { ExchangeDataMap } from '../../icc-api/model/internal/ExchangeDataMap'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum

type DelegationDecryptionDetails = {
  delegation: SecureDelegation
  hashes: string[]
}

export type DelegationMembersDetails = {
  delegator: string | undefined
  delegate: string | undefined
  fullyExplicit: boolean
  accessControlSecret: string | undefined
  accessLevel: AccessLevelEnum
}

export class SecureDelegationsSecurityMetadataDecryptor implements SecurityMetadataDecryptor {
  constructor(
    private readonly exchangeData: ExchangeDataManager,
    private readonly exchangeDataMap: ExchangeDataMapManager,
    private readonly secureDelegationsEncryption: SecureDelegationsEncryption,
    private readonly dataOwnerApi: IccDataOwnerXApi
  ) {}

  decryptEncryptionKeysOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[]
  ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
    return this.decryptSecureDelegations(
      typedEntity,
      dataOwnersHierarchySubset,
      (d) => d.encryptionKeys ?? [],
      (e, k) => this.secureDelegationsEncryption.decryptEncryptionKey(e, k)
    )
  }

  decryptOwningEntityIdsOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[]
  ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
    return this.decryptSecureDelegations(
      typedEntity,
      dataOwnersHierarchySubset,
      (d) => d.owningEntityIds ?? [],
      (e, k) => this.secureDelegationsEncryption.decryptOwningEntityId(e, k)
    )
  }

  decryptSecretIdsOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[]
  ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
    return this.decryptSecureDelegations(
      typedEntity,
      dataOwnersHierarchySubset,
      (d) => d.secretIds ?? [],
      (e, k) => this.secureDelegationsEncryption.decryptSecretId(e, k)
    )
  }

  /**
   * Get information for members of secure delegations in the entity. Also provides information for delegations with anonymous delegate and/or
   * delegator if one of the delegation members is the current data owner (or a parent) AND has still access to the exchange data used in the .
   */
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
    const cachedExchangeData = await this.exchangeData.getCachedDecryptionDataKeyByAccessControlHash(
      remainingDelegations.map((d) => d[0]),
      typedEntity.type,
      typedEntity.entity.secretForeignKeys ?? []
    )
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
    const allHashes = [
      ...remainingDelegations.flatMap(([hash, _]) => hash),
      ...Object.keys(typedEntity.entity.securityMetadata?.keysEquivalences ?? {}),
    ]
    const encryptedExchangeDataIds = (await this.exchangeDataMap.getExchangeDataMapBatch(allHashes)).reduce((maps, current) => {
      return {
        ...maps,
        [current.id]: current,
      }
    }, {} as { [hash: string]: ExchangeDataMap })
    for (const [hash, delegation] of remainingDelegations) {
      if (hierarchy.some((x) => x === delegation.delegate || x === delegation.delegator)) {
        const dataId = !!encryptedExchangeDataIds[hash]
          ? await this.secureDelegationsEncryption.decryptExchangeDataId(encryptedExchangeDataIds[hash].encryptedExchangeDataIds)
          : undefined
        const exchangeDataInfo = dataId
          ? await this.exchangeData.getDecryptionDataKeyById(dataId, typedEntity.type, typedEntity.entity.secretForeignKeys ?? [], true)
          : undefined
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

  hasAnyEncryptionKeys(entity: EncryptedEntity | EncryptedEntityStub): boolean {
    return Object.values(entity.securityMetadata?.secureDelegations ?? {}).some((d) => d.encryptionKeys?.length)
  }

  async getEntityAccessLevel(typedEntity: EncryptedEntityWithType, dataOwnersHierarchySubset: string[]): Promise<AccessLevel | undefined> {
    if (!dataOwnersHierarchySubset.length) throw new Error("`dataOwnersHierarchySubset` can't be empty")
    // If the data owner is explicit all delegations he can access has his id. If the delegator is anonymous all delegations he can access are
    // accessible by hash. No mixed scenario possible.
    let accessibleDelegations: SecureDelegation[] = Object.values(typedEntity.entity.securityMetadata?.secureDelegations ?? {}).filter(
      (secureDelegation) =>
        dataOwnersHierarchySubset.some((dataOwner) => dataOwner === secureDelegation.delegator || dataOwner === secureDelegation.delegate)
    )
    if (!accessibleDelegations.length) {
      const equivalences = typedEntity.entity.securityMetadata?.keysEquivalences
      const availableCanonicalHashes = Array.from(
        new Set(
          Object.keys(
            await this.exchangeData.getCachedDecryptionDataKeyByAccessControlHash(
              [
                ...Object.keys(typedEntity.entity.securityMetadata?.secureDelegations ?? {}),
                ...Object.keys(typedEntity.entity.securityMetadata?.keysEquivalences ?? {}),
              ],
              typedEntity.type,
              typedEntity.entity.secretForeignKeys ?? []
            )
          ).map((hash) => {
            const canonicalEquivalence = equivalences ? equivalences[hash] : undefined
            return canonicalEquivalence ? canonicalEquivalence : hash
          })
        )
      )
      accessibleDelegations = availableCanonicalHashes.map((hash) => (typedEntity.entity.securityMetadata?.secureDelegations ?? {})[hash])
    }

    const permissions = accessibleDelegations.map((secureDelegation) => secureDelegation.permissions)
    let maxLevel: AccessLevel | undefined = undefined
    for (const permission of permissions) {
      if (permission === AccessLevel.WRITE) {
        return AccessLevel.WRITE
      }
      if (permission === AccessLevel.READ) {
        maxLevel = AccessLevel.READ
      }
    }
    return maxLevel
  }

  private decryptSecureDelegations(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[],
    getDataToDecrypt: (delegation: SecureDelegation) => string[],
    decryptDataWithKey: (encryptedData: string, key: CryptoKey) => Promise<string>
  ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
    if (!dataOwnersHierarchySubset.length) throw new Error("`dataOwnersHierarchySubset` can't be empty")
    const self = this

    async function getFirstDecryptedExchangeDataIdForHash(
      hashes: string[],
      encryptedExchangeDataIdsByDelegationKey: { [hash: string]: ExchangeDataMap }
    ): Promise<string | undefined> {
      for (const hash of new Set(hashes)) {
        const decryptedExchangeDataId = !!encryptedExchangeDataIdsByDelegationKey[hash]
          ? await self.secureDelegationsEncryption.decryptExchangeDataId(encryptedExchangeDataIdsByDelegationKey[hash]?.encryptedExchangeDataIds)
          : undefined
        if (!!decryptedExchangeDataId) return decryptedExchangeDataId
      }
    }

    async function decrypt(
      delegation: SecureDelegation,
      exchangeDataDetails: { exchangeData: ExchangeData; exchangeKey: CryptoKey | undefined }
    ): Promise<{ decrypted: string; dataOwnersWithAccess: string[] }[]> {
      if (!exchangeDataDetails.exchangeKey) return []
      const dataToDecrypt = getDataToDecrypt(delegation)
      if (!dataToDecrypt.length) return []
      if (!dataOwnersHierarchySubset.some((x) => x === exchangeDataDetails.exchangeData.delegator || x === exchangeDataDetails.exchangeData.delegate))
        return []
      const dataOwnersWithAccess = [exchangeDataDetails.exchangeData.delegator, exchangeDataDetails.exchangeData.delegate]
      const res = []
      for (const curr of dataToDecrypt) {
        res.push({ decrypted: await decryptDataWithKey(curr, exchangeDataDetails.exchangeKey), dataOwnersWithAccess })
      }
      return res
    }

    async function* generator(): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
      let remainingDelegations: DelegationDecryptionDetails[] = Object.entries(typedEntity.entity.securityMetadata?.secureDelegations ?? {}).map(
        ([canonicalHash, delegation]) => ({
          delegation,
          hashes: [
            canonicalHash,
            ...Object.entries(typedEntity.entity.securityMetadata?.keysEquivalences ?? {})
              .filter((x) => x[1] == canonicalHash)
              .map((x) => x[0]),
          ],
        })
      )

      /*
       * Generate from least expensive to most (in terms of time to decrypt). 1 and 2a have equivalent costs.
       * 1) Secure delegations with cached exchange data by hash
       * 2) Secure delegations with cached exchange data by id for explicit->explicit delegations where delegator and/or delegate is me or parent
       * 3) Non cached secure delegations for explicit->explicit delegations where delegator and/or delegate is me or parent (half of old 3)
       * 4) Decrypt secure delegation id for explicit->anonymous or anonymous->explicit where explicit is me or parent (2b and half of old3)
       */

      // Step 1) Secure delegations with cached exchange data by hash
      if (!remainingDelegations.length) return
      const cachedDataByHash = await self.exchangeData.getCachedDecryptionDataKeyByAccessControlHash(
        [
          ...Object.keys(typedEntity.entity.securityMetadata?.secureDelegations ?? {}),
          ...Object.keys(typedEntity.entity.securityMetadata?.keysEquivalences ?? {}),
        ],
        typedEntity.type,
        typedEntity.entity.secretForeignKeys ?? []
      )
      let updatedRemainingDelegations: DelegationDecryptionDetails[] = []
      for (const decryptionDetails of remainingDelegations) {
        const exchangeDataDetails = decryptionDetails.hashes.map((h) => cachedDataByHash?.[h]).find((x) => !!x)
        if (exchangeDataDetails) {
          for (const decrypted of await decrypt(decryptionDetails.delegation, exchangeDataDetails)) yield decrypted
        } else if (
          (!!decryptionDetails.delegation.delegate || !!decryptionDetails.delegation.delegator) &&
          dataOwnersHierarchySubset.some((x) => x === decryptionDetails.delegation.delegate || x === decryptionDetails.delegation.delegator)
        ) {
          updatedRemainingDelegations.push(decryptionDetails)
        }
      }
      remainingDelegations = updatedRemainingDelegations
      updatedRemainingDelegations = []

      // Step 2) Secure delegations with cached exchange data by id for explicit->explicit delegations where delegator and/or delegate is me or parent
      if (!remainingDelegations.length) return
      for (const decryptionDetails of remainingDelegations) {
        const exchangeDataDetails = decryptionDetails.delegation.exchangeDataId
          ? await self.exchangeData.getDecryptionDataKeyById(
              decryptionDetails.delegation.exchangeDataId,
              typedEntity.type,
              typedEntity.entity.secretForeignKeys ?? [],
              false
            )
          : undefined
        if (!!exchangeDataDetails) {
          for (const decrypted of await decrypt(decryptionDetails.delegation, exchangeDataDetails)) yield decrypted
        } else {
          updatedRemainingDelegations.push(decryptionDetails)
        }
      }
      remainingDelegations = updatedRemainingDelegations
      updatedRemainingDelegations = []

      // Step 3) Non cached secure delegations for explicit->explicit delegations where delegator and/or delegate is me or parent
      if (!remainingDelegations.length) return
      for (const decryptionDetails of remainingDelegations) {
        const exchangeDataDetails = decryptionDetails.delegation.exchangeDataId
          ? await self.exchangeData.getDecryptionDataKeyById(
              decryptionDetails.delegation.exchangeDataId,
              typedEntity.type,
              typedEntity.entity.secretForeignKeys ?? [],
              true
            )
          : undefined
        if (!!exchangeDataDetails) {
          for (const decrypted of await decrypt(decryptionDetails.delegation, exchangeDataDetails)) yield decrypted
        } else {
          updatedRemainingDelegations.push(decryptionDetails)
        }
      }
      remainingDelegations = updatedRemainingDelegations

      // Step 4) Decrypt secure delegation id for explicit->anonymous or anonymous->explicit where explicit is me or parent
      if (!remainingDelegations.length) return
      const allHashes = [
        ...remainingDelegations.flatMap((x) => x.hashes),
        ...Object.keys(typedEntity.entity.securityMetadata?.keysEquivalences ?? {}),
      ]
      const encryptedExchangeDataIdsByDelegationKey = (await self.exchangeDataMap.getExchangeDataMapBatch(allHashes)).reduce((maps, current) => {
        return {
          ...maps,
          [current.id]: current,
        }
      }, {} as { [hash: string]: ExchangeDataMap })
      for (const decryptionDetails of remainingDelegations) {
        const decryptedExchangeDataId = await getFirstDecryptedExchangeDataIdForHash(
          decryptionDetails.hashes,
          encryptedExchangeDataIdsByDelegationKey
        )
        if (decryptedExchangeDataId) {
          const exchangeDataDetails = await self.exchangeData.getDecryptionDataKeyById(
            decryptedExchangeDataId,
            typedEntity.type,
            typedEntity.entity.secretForeignKeys ?? [],
            true
          )
          if (exchangeDataDetails) {
            for (const decrypted of await decrypt(decryptionDetails.delegation, exchangeDataDetails)) yield decrypted
          }
        }
      }
    }

    return generator()
  }
}
