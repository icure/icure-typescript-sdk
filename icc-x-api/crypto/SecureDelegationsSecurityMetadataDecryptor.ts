import { SecurityMetadataDecryptor } from './SecurityMetadataDecryptor'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import { ExchangeDataManager } from './ExchangeDataManager'
import { EncryptedEntityWithType } from '../utils/EntityWithDelegationTypeName'
import { ExchangeData } from '../../icc-api/model/ExchangeData'
import { SecureDelegationsEncryption } from './SecureDelegationsEncryption'
import AccessLevel = SecureDelegation.AccessLevel

type DelegationDecryptionDetails = {
  delegation: SecureDelegation
  hashes: string[]
  exchangeDataId: string | undefined
}

export class SecureDelegationsSecurityMetadataDecryptor implements SecurityMetadataDecryptor {
  constructor(private readonly exchangeData: ExchangeDataManager, private readonly secureDelegationsEncryption: SecureDelegationsEncryption) {}

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

  async getFullEntityAccessLevel(typedEntity: EncryptedEntityWithType, dataOwnersHierarchySubset: string[]): Promise<AccessLevel | undefined> {
    if (!dataOwnersHierarchySubset.length) throw new Error("`dataOwnersHierarchySubset` can't be empty")
    // All delegations are either accessible directly or through a hash/access control key. There is no "mixed scenario" possible
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
          exchangeDataId: delegation.exchangeDataId, // Initially only if explicit, later will also fill for encrypted
          hashes: [
            canonicalHash,
            ...Object.entries(typedEntity.entity.securityMetadata?.keysEquivalences ?? {})
              .filter((x) => x[1] == canonicalHash)
              .map((x) => x[0]),
          ],
        })
      )
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
          (!!decryptionDetails.delegation.delegate || !!decryptionDetails.delegation.delegator) &&
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
          const decryptedExchangeDataId = await self.secureDelegationsEncryption.decryptExchangeDataId(decryptionDetails.delegation)
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
        } else updatedRemainingDelegations.push(decryptionDetails)
      }
      remainingDelegations = updatedRemainingDelegations

      // Step 3) Secure delegations with exchange data by id (clear-text or decrypted) not cached for relevant data owners
      if (!remainingDelegations.length) return
      for (const decryptionDetails of remainingDelegations) {
        const exchangeDataDetails = await self.exchangeData.getDecryptionDataKeyById(
          decryptionDetails.exchangeDataId!,
          typedEntity.type,
          typedEntity.entity.secretForeignKeys ?? [],
          true
        )
        if (exchangeDataDetails) {
          for (const decrypted of await decrypt(decryptionDetails.delegation, exchangeDataDetails)) yield decrypted
        }
      }
    }

    return generator()
  }
}
