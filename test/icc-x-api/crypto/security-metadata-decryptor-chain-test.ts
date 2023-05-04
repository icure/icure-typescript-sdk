import { describe } from 'mocha'
import { expect } from 'chai'
import { SecurityMetadataDecryptor, SecurityMetadataDecryptorChain } from '../../../icc-x-api/crypto/SecurityMetadataDecryptor'
import { EncryptedEntityStub } from '../../../icc-api/model/models'
import { toString } from 'lodash'
import { EncryptedEntityWithType } from '../../../icc-x-api/utils/EntityWithDelegationTypeName'
import { SecureDelegation } from '../../../icc-api/model/SecureDelegation'
import AccessLevel = SecureDelegation.AccessLevelEnum

describe('Security metadata decryptor chain', async function () {
  const expectedEntity: EncryptedEntityWithType = { entity: {} as EncryptedEntityStub, type: 'Patient' }
  const expectedDataOwnerHierarchySubset = ['a', 'b']

  it('should return all elements in order for encryption keys', async function () {
    const chained = new SecurityMetadataDecryptorChain([
      {
        decryptEncryptionKeysOf(
          typedEntity: EncryptedEntityWithType,
          dataOwnersHierarchySubset: string[]
        ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
          expect(typedEntity).to.equal(expectedEntity)
          expect(dataOwnersHierarchySubset).to.equal(expectedDataOwnerHierarchySubset)
          async function* generator(): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
            yield { decrypted: '1', dataOwnersWithAccess: ['1'] }
            yield { decrypted: '2', dataOwnersWithAccess: ['2'] }
            yield { decrypted: '3', dataOwnersWithAccess: ['3'] }
          }
          return generator()
        },
        decryptOwningEntityIdsOf: () => {
          throw new Error('This should not be called')
        },
        decryptSecretIdsOf: () => {
          throw new Error('This should not be called')
        },
        getEntityAccessLevel: () => {
          throw new Error('This should not be called')
        },
        hasAnyEncryptionKeys(): boolean {
          throw new Error('This should not be called')
        },
      },
      {
        decryptEncryptionKeysOf(
          typedEntity: EncryptedEntityWithType,
          dataOwnersHierarchySubset: string[]
        ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
          expect(typedEntity).to.equal(expectedEntity)
          expect(dataOwnersHierarchySubset).to.equal(expectedDataOwnerHierarchySubset)
          async function* generator(): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
            yield { decrypted: '4', dataOwnersWithAccess: ['4'] }
            yield { decrypted: '5', dataOwnersWithAccess: ['5'] }
            yield { decrypted: '6', dataOwnersWithAccess: ['6'] }
          }
          return generator()
        },
        decryptOwningEntityIdsOf: () => {
          throw new Error('This should not be called')
        },
        decryptSecretIdsOf: () => {
          throw new Error('This should not be called')
        },
        getEntityAccessLevel: () => {
          throw new Error('This should not be called')
        },
        hasAnyEncryptionKeys(): boolean {
          throw new Error('This should not be called')
        },
      },
    ])
    let generator = chained.decryptEncryptionKeysOf(expectedEntity, expectedDataOwnerHierarchySubset)
    let next = await generator.next()
    for (let i = 1; i <= 6; i++) {
      const si = toString(i)
      expect(next.value?.decrypted).to.equal(si)
      expect(next.value?.dataOwnersWithAccess?.[0]).to.equal(si)
      expect(next.value?.dataOwnersWithAccess).to.have.length(1)
      expect(next.done).to.be.false
      next = await generator.next()
    }
    expect(next.value).to.be.undefined
    expect(next.done).to.be.true
  })

  it('should return all elements in order for secret ids', async function () {
    const chained = new SecurityMetadataDecryptorChain([
      {
        decryptSecretIdsOf(
          typedEntity: EncryptedEntityWithType,
          dataOwnersHierarchySubset: string[]
        ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
          expect(typedEntity).to.equal(expectedEntity)
          expect(dataOwnersHierarchySubset).to.equal(expectedDataOwnerHierarchySubset)
          async function* generator(): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
            yield { decrypted: '1', dataOwnersWithAccess: ['1'] }
            yield { decrypted: '2', dataOwnersWithAccess: ['2'] }
            yield { decrypted: '3', dataOwnersWithAccess: ['3'] }
          }
          return generator()
        },
        decryptEncryptionKeysOf: () => {
          throw new Error('This should not be called')
        },
        decryptOwningEntityIdsOf: () => {
          throw new Error('This should not be called')
        },
        getEntityAccessLevel: () => {
          throw new Error('This should not be called')
        },
        hasAnyEncryptionKeys(): boolean {
          throw new Error('This should not be called')
        },
      },
      {
        decryptSecretIdsOf(
          typedEntity: EncryptedEntityWithType,
          dataOwnersHierarchySubset: string[]
        ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
          expect(typedEntity).to.equal(expectedEntity)
          expect(dataOwnersHierarchySubset).to.equal(expectedDataOwnerHierarchySubset)
          async function* generator(): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
            yield { decrypted: '4', dataOwnersWithAccess: ['4'] }
            yield { decrypted: '5', dataOwnersWithAccess: ['5'] }
            yield { decrypted: '6', dataOwnersWithAccess: ['6'] }
          }
          return generator()
        },
        decryptEncryptionKeysOf: () => {
          throw new Error('This should not be called')
        },
        decryptOwningEntityIdsOf: () => {
          throw new Error('This should not be called')
        },
        getEntityAccessLevel: () => {
          throw new Error('This should not be called')
        },
        hasAnyEncryptionKeys(): boolean {
          throw new Error('This should not be called')
        },
      },
    ])
    let generator = chained.decryptSecretIdsOf(expectedEntity, expectedDataOwnerHierarchySubset)
    let next = await generator.next()
    for (let i = 1; i <= 6; i++) {
      const si = toString(i)
      expect(next.value?.decrypted).to.equal(si)
      expect(next.value?.dataOwnersWithAccess?.[0]).to.equal(si)
      expect(next.value?.dataOwnersWithAccess).to.have.length(1)
      expect(next.done).to.be.false
      next = await generator.next()
    }
    expect(next.value).to.be.undefined
    expect(next.done).to.be.true
  })

  it('should return all elements in order for owning entity id', async function () {
    const chained = new SecurityMetadataDecryptorChain([
      {
        decryptOwningEntityIdsOf(
          typedEntity: EncryptedEntityWithType,
          dataOwnersHierarchySubset: string[]
        ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
          expect(typedEntity).to.equal(expectedEntity)
          expect(dataOwnersHierarchySubset).to.equal(expectedDataOwnerHierarchySubset)
          async function* generator(): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
            yield { decrypted: '1', dataOwnersWithAccess: ['1'] }
            yield { decrypted: '2', dataOwnersWithAccess: ['2'] }
            yield { decrypted: '3', dataOwnersWithAccess: ['3'] }
          }
          return generator()
        },
        decryptEncryptionKeysOf: () => {
          throw new Error('This should not be called')
        },
        decryptSecretIdsOf: () => {
          throw new Error('This should not be called')
        },
        getEntityAccessLevel: () => {
          throw new Error('This should not be called')
        },
        hasAnyEncryptionKeys(): boolean {
          throw new Error('This should not be called')
        },
      },
      {
        decryptOwningEntityIdsOf(
          typedEntity: EncryptedEntityWithType,
          dataOwnersHierarchySubset: string[]
        ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
          expect(typedEntity).to.equal(expectedEntity)
          expect(dataOwnersHierarchySubset).to.equal(expectedDataOwnerHierarchySubset)
          async function* generator(): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
            yield { decrypted: '4', dataOwnersWithAccess: ['4'] }
            yield { decrypted: '5', dataOwnersWithAccess: ['5'] }
            yield { decrypted: '6', dataOwnersWithAccess: ['6'] }
          }
          return generator()
        },
        decryptEncryptionKeysOf: () => {
          throw new Error('This should not be called')
        },
        decryptSecretIdsOf: () => {
          throw new Error('This should not be called')
        },
        getEntityAccessLevel: () => {
          throw new Error('This should not be called')
        },
        hasAnyEncryptionKeys(): boolean {
          throw new Error('This should not be called')
        },
      },
    ])
    let generator = chained.decryptOwningEntityIdsOf(expectedEntity, expectedDataOwnerHierarchySubset)
    let next = await generator.next()
    for (let i = 1; i <= 6; i++) {
      const si = toString(i)
      expect(next.value?.decrypted).to.equal(si)
      expect(next.value?.dataOwnersWithAccess?.[0]).to.equal(si)
      expect(next.value?.dataOwnersWithAccess).to.have.length(1)
      expect(next.done).to.be.false
      next = await generator.next()
    }
    expect(next.value).to.be.undefined
    expect(next.done).to.be.true
  })

  it('should return the best access level across all decryptors of the chain', async function () {
    function newAccessLevelDecryptor(accessLevel: AccessLevel | undefined): SecurityMetadataDecryptor {
      return {
        decryptOwningEntityIdsOf: () => {
          throw new Error('This should not be called')
        },
        decryptEncryptionKeysOf: () => {
          throw new Error('This should not be called')
        },
        decryptSecretIdsOf: () => {
          throw new Error('This should not be called')
        },
        getEntityAccessLevel: (typedEntity, dataOwnersHierarchySubset) => {
          expect(typedEntity).to.equal(expectedEntity)
          expect(dataOwnersHierarchySubset).to.equal(expectedDataOwnerHierarchySubset)
          return Promise.resolve(accessLevel)
        },
        hasAnyEncryptionKeys(): boolean {
          throw new Error('This should not be called')
        },
      }
    }
    expect(
      await new SecurityMetadataDecryptorChain([newAccessLevelDecryptor(undefined), newAccessLevelDecryptor(AccessLevel.READ)]).getEntityAccessLevel(
        expectedEntity,
        expectedDataOwnerHierarchySubset
      )
    ).to.equal(AccessLevel.READ)
    expect(
      await new SecurityMetadataDecryptorChain([newAccessLevelDecryptor(AccessLevel.READ), newAccessLevelDecryptor(undefined)]).getEntityAccessLevel(
        expectedEntity,
        expectedDataOwnerHierarchySubset
      )
    ).to.equal(AccessLevel.READ)
    expect(
      await new SecurityMetadataDecryptorChain([
        newAccessLevelDecryptor(AccessLevel.READ),
        newAccessLevelDecryptor(undefined),
        newAccessLevelDecryptor(AccessLevel.WRITE),
        newAccessLevelDecryptor(AccessLevel.READ),
      ]).getEntityAccessLevel(expectedEntity, expectedDataOwnerHierarchySubset)
    ).to.equal(AccessLevel.WRITE)
    expect(
      await new SecurityMetadataDecryptorChain([newAccessLevelDecryptor(undefined), newAccessLevelDecryptor(undefined)]).getEntityAccessLevel(
        expectedEntity,
        expectedDataOwnerHierarchySubset
      )
    ).to.equal(undefined)
    expect(
      await new SecurityMetadataDecryptorChain([
        newAccessLevelDecryptor(undefined),
        newAccessLevelDecryptor(AccessLevel.READ),
        newAccessLevelDecryptor(AccessLevel.READ),
        newAccessLevelDecryptor(undefined),
        newAccessLevelDecryptor(AccessLevel.WRITE),
      ]).getEntityAccessLevel(expectedEntity, expectedDataOwnerHierarchySubset)
    ).to.equal(AccessLevel.WRITE)
  })
})
