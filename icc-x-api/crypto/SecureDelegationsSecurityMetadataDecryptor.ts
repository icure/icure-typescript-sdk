import { SecurityMetadataDecryptor } from './SecurityMetadataDecryptor'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import { ExchangeDataManager } from './ExchangeDataManager'
import { EncryptedEntityWithType } from '../utils/EntityWithDelegationTypeName'
import { ExchangeData } from '../../icc-api/model/ExchangeData'
import { SecureDelegationsUtils } from './SecureDelegationsUtils'

type DelegationDecryptionDetails = {
  delegation: SecureDelegation
  hashes: string[]
  exchangeDataId: string | undefined
}

export class SecureDelegationsSecurityMetadataDecryptor implements SecurityMetadataDecryptor {
  constructor(private readonly exchangeData: ExchangeDataManager, private readonly secureDelegationsUtils: SecureDelegationsUtils) {}

  decryptEncryptionKeysOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[],
    tagsFilter: (tags: string[]) => boolean
  ): AsyncGenerator<{ encryptionKey: string; dataOwnersWithAccess: string[] }, void, never> {
    return this.decryptSecureDelegations(
      typedEntity,
      dataOwnersHierarchySubset,
      (t) => tagsFilter(t),
      (d) => d.encryptionKeys ?? [],
      (e, k) => this.secureDelegationsUtils.decryptEncryptionKey(e, k),
      (decrypted, dataOwnersWithAccess) => ({ encryptionKey: decrypted, dataOwnersWithAccess })
    )
  }

  decryptOwningEntityIdsOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[],
    tagsFilter: (tags: string[]) => boolean
  ): AsyncGenerator<{ owningEntityId: string; dataOwnersWithAccess: string[] }, void, never> {
    return this.decryptSecureDelegations(
      typedEntity,
      dataOwnersHierarchySubset,
      (t) => tagsFilter(t),
      (d) => d.owningEntityIds ?? [],
      (e, k) => this.secureDelegationsUtils.decryptOwningEntityId(e, k),
      (decrypted, dataOwnersWithAccess) => ({ owningEntityId: decrypted, dataOwnersWithAccess })
    )
  }

  decryptSecretIdsOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[],
    tagsFilter: (tags: string[]) => boolean
  ): AsyncGenerator<{ secretId: string; dataOwnersWithAccess: string[] }, void, never> {
    return this.decryptSecureDelegations(
      typedEntity,
      dataOwnersHierarchySubset,
      (t) => tagsFilter(t),
      (d) => d.secretIds ?? [],
      (e, k) => this.secureDelegationsUtils.decryptSecretId(e, k),
      (decrypted, dataOwnersWithAccess) => ({ secretId: decrypted, dataOwnersWithAccess })
    )
  }

  private decryptSecureDelegations<T>(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[],
    tagsFilter: (tags: string[]) => boolean,
    getDataToDecrypt: (delegation: SecureDelegation) => string[],
    decryptDataWithKey: (encryptedData: string, key: CryptoKey) => Promise<string>,
    makeResult: (decrypted: string, dataOwnersWithAccess: string[]) => T
  ): AsyncGenerator<T, void, never> {
    if (!dataOwnersHierarchySubset.length) throw new Error("`dataOwnersHierarchySubset` can't be empty")
    const self = this

    async function decrypt(
      delegation: SecureDelegation,
      exchangeDataDetails: { exchangeData: ExchangeData; exchangeKey: CryptoKey | undefined }
    ): Promise<T[]> {
      if (!exchangeDataDetails.exchangeKey) return []
      const dataToDecrypt = getDataToDecrypt(delegation)
      if (!dataToDecrypt.length) return []
      if (!dataOwnersHierarchySubset.some((x) => x === exchangeDataDetails.exchangeData.delegator || x === exchangeDataDetails.exchangeData.delegate))
        return []
      const dataOwnersWithAccess = [exchangeDataDetails.exchangeData.delegator, exchangeDataDetails.exchangeData.delegate]
      const res = []
      for (const curr of dataToDecrypt) {
        res.push(makeResult(await decryptDataWithKey(curr, exchangeDataDetails.exchangeKey), dataOwnersWithAccess))
      }
      return res
    }

    async function* generator(): AsyncGenerator<T, void, never> {
      let remainingDelegations: DelegationDecryptionDetails[] = Object.entries(typedEntity.entity.securityMetadata?.secureDelegations ?? {})
        .filter(([_, delegation]) => tagsFilter(delegation.tags ?? []))
        .map(([canonicalHash, delegation]) => ({
          delegation,
          exchangeDataId: delegation.exchangeDataId, // Initially only if explicit, later will also fill for encrypted
          hashes: [
            canonicalHash,
            ...Object.entries(typedEntity.entity.securityMetadata?.keysEquivalences ?? {})
              .filter((x) => x[1] == canonicalHash)
              .map((x) => x[0]),
          ],
        }))
      if (!remainingDelegations.length) return
      /*
       * Generate from least expensive to most (in terms of time to decrypt). 1 and 2a have equivalent costs.
       * 1) Secure delegations with cached exchange data by hash
       * 2) Secure delegations with cached exchange data by id for relevant data owners
       *    a) With clear-text id
       *    b) With encrypted id
       * 3) Secure delegations with exchange data by id not cached, for relevant data owners (all ids already decrypted)
       */

      // Step 1) Secure delegations with cached exchange data by hash
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
          (!!decryptionDetails.delegation.delegate || !!decryptionDetails.delegation.delegate) &&
          dataOwnersHierarchySubset.some((x) => x === decryptionDetails.delegation.delegate || x === decryptionDetails.delegation.delegator)
        ) {
          updatedRemainingDelegations.push(decryptionDetails)
        }
      }
      remainingDelegations = updatedRemainingDelegations
      updatedRemainingDelegations = []

      // Step 2)a) Secure delegations with cached exchange data by clear-text id for relevant data owners
      if (!remainingDelegations.length) return
      for (const decryptionDetails of remainingDelegations) {
        const exchangeDataDetails = decryptionDetails.exchangeDataId
          ? await self.exchangeData.getDecryptionDataKeyById(
              decryptionDetails.exchangeDataId,
              typedEntity.type,
              typedEntity.entity.secretForeignKeys ?? [],
              false
            )
          : undefined
        if (exchangeDataDetails) {
          for (const decrypted of await decrypt(decryptionDetails.delegation, exchangeDataDetails)) yield decrypted
        } else {
          updatedRemainingDelegations.push(decryptionDetails)
        }
      }
      remainingDelegations = updatedRemainingDelegations
      updatedRemainingDelegations = []

      // Step 2)b) Secure delegations with cached exchange data by decrypted id for relevant data owners
      if (!remainingDelegations.length) return
      for (const decryptionDetails of remainingDelegations) {
        if (!decryptionDetails.exchangeDataId) {
          const decryptedExchangeDataId = await self.secureDelegationsUtils.decryptExchangeDataId(decryptionDetails.delegation)
          if (decryptedExchangeDataId) {
            const exchangeDataDetails = await self.exchangeData.getDecryptionDataKeyById(
              decryptedExchangeDataId,
              typedEntity.type,
              typedEntity.entity.secretForeignKeys ?? [],
              false
            )
            if (exchangeDataDetails) {
              for (const decrypted of await decrypt(decryptionDetails.delegation, exchangeDataDetails)) yield decrypted
            } else {
              updatedRemainingDelegations.push({
                delegation: decryptionDetails.delegation,
                exchangeDataId: decryptedExchangeDataId,
                hashes: decryptionDetails.hashes,
              })
            }
          }
        } else remainingDelegations.push(decryptionDetails)
      }
      remainingDelegations = updatedRemainingDelegations

      // Step 3) Secure delegations with exchange data by id (clear-text or decrypted) not cached for relevant data owners
      if (!remainingDelegations.length) return
      for (const decryptionDetails of remainingDelegations) {
        const exchangeDataDetails = await self.exchangeData.getDecryptionDataKeyById(
          decryptionDetails.exchangeDataId!,
          typedEntity.type,
          typedEntity.entity.secretForeignKeys ?? [],
          false
        )
        if (exchangeDataDetails) {
          for (const decrypted of await decrypt(decryptionDetails.delegation, exchangeDataDetails)) yield decrypted
        }
      }
    }

    return generator()
  }
}
