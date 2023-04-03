import { SecurityMetadataDecryptor } from './SecurityMetadataDecryptor'
import { EncryptedEntityWithType } from '../utils/EntityWithDelegationTypeName'
import { Delegation } from '../../icc-api/model/Delegation'
import { ua2string } from '../../icc-api/model/ModelHelper'
import { hex2ua } from '../utils'
import { CryptoPrimitives } from './CryptoPrimitives'
import { ExchangeKeysManager } from './ExchangeKeysManager'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import AccessLevel = SecureDelegation.AccessLevelEnum

export class LegacyDelegationSecurityMetadataDecryptor implements SecurityMetadataDecryptor {
  constructor(private readonly exchangeKeysManager: ExchangeKeysManager, private readonly primitives: CryptoPrimitives) {}

  decryptEncryptionKeysOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[]
  ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
    return this.extractFromDelegations(dataOwnersHierarchySubset, typedEntity.entity.encryptionKeys ?? {}, (d) => this.validateEncryptionKey(d))
  }

  decryptOwningEntityIdsOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[]
  ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
    return this.extractFromDelegations(dataOwnersHierarchySubset, typedEntity.entity.cryptedForeignKeys ?? {}, (d) =>
      Promise.resolve(this.validateOwningEntityId(d))
    )
  }

  decryptSecretIdsOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[]
  ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
    return this.extractFromDelegations(dataOwnersHierarchySubset, typedEntity.entity.delegations ?? {}, (d) =>
      Promise.resolve(this.validateSecretId(d))
    )
  }

  getFullEntityAccessLevel(typedEntity: EncryptedEntityWithType, dataOwnersHierarchySubset: string[]): Promise<AccessLevel | undefined> {
    const delegatesSet = new Set(Object.keys(typedEntity.entity.delegations ?? {}))
    return dataOwnersHierarchySubset.some((dataOwner) => delegatesSet.has(dataOwner))
      ? Promise.resolve(AccessLevel.WRITE)
      : Promise.resolve(undefined)
  }

  private extractFromDelegations(
    dataOwnersHierarchySubset: string[],
    delegations: { [delegateId: string]: Delegation[] },
    validateDecrypted: (result: string) => Promise<boolean>
  ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
    if (!dataOwnersHierarchySubset.length) throw new Error("`dataOwnersHierarchySubset` can't be empty")
    const delegationsWithOwner = Object.entries(delegations).flatMap(([delegateId, delegations]) =>
      dataOwnersHierarchySubset.some((dataOwnerId) => dataOwnerId === delegateId)
        ? this.populateDelegatedTo(delegateId, delegations)
        : this.populateDelegatedTo(
            delegateId,
            delegations.filter((d) => dataOwnersHierarchySubset.some((dataOwnerId) => d.owner === dataOwnerId))
          )
    )
    const self = this
    async function* generator() {
      for (const delegation of delegationsWithOwner) {
        const decrypted = await self.tryDecryptDelegation(delegation, (k) => validateDecrypted(k))
        if (decrypted)
          yield {
            decrypted,
            dataOwnersWithAccess: delegation.owner ? [delegation.owner, delegation.delegatedTo!] : [delegation.delegatedTo!],
          }
      }
    }
    return generator()
  }

  private populateDelegatedTo(delegateId: string, delegations: Delegation[]): Delegation[] {
    return delegations.map((d) => (d.delegatedTo === delegateId ? d : { ...d, delegatedTo: delegateId }))
  }

  private async tryDecryptDelegation(delegation: Delegation, validateDecrypted: (result: string) => Promise<boolean>): Promise<string | undefined> {
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

  private async validateEncryptionKey(key: string): Promise<boolean> {
    return !!(await this.tryImportKey(key))
  }

  private validateSecretId(key: string): boolean {
    return !!key
  }

  private validateOwningEntityId(key: string): boolean {
    return !!key
  }

  private async tryImportKey(key: string): Promise<CryptoKey | undefined> {
    if (!/^[0-9A-Fa-f\-]+$/g.test(key)) return undefined
    try {
      return await this.primitives.AES.importKey('raw', hex2ua(key.replace(/-/g, '')))
    } catch (e) {
      console.warn(`Could not import key ${key} as an encryption key.`, e)
      return undefined
    }
  }
}
