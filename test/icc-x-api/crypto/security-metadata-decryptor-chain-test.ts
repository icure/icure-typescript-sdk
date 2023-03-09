import { describe } from 'mocha'
import { expect } from 'chai'
import { SecurityMetadataDecryptorChain } from '../../../icc-x-api/crypto/SecurityMetadataDecryptor'
import { EncryptedEntity, EncryptedEntityStub } from '../../../icc-api/model/models'
import { toString } from 'lodash'
import { EncryptedEntityWithType } from '../../../icc-x-api/utils/EntityWithDelegationTypeName'

describe('Security metadata decryptor chain', async function () {
  const expectedEntity: EncryptedEntityWithType = { entity: {} as EncryptedEntityStub, type: 'Patient' }
  const expectedDataOwnerHierarchySubset = ['a', 'b']

  it('should return all elements in order for encryption keys', async function () {
    const chained = new SecurityMetadataDecryptorChain([
      {
        decryptEncryptionKeysOf(
          typedEntity: EncryptedEntityWithType,
          dataOwnersHierarchySubset: string[],
          tagsFilter: (tags: string[]) => boolean
        ): AsyncGenerator<{ encryptionKey: string; dataOwnersWithAccess: string[] }, void, never> {
          expect(typedEntity).to.equal(expectedEntity)
          expect(dataOwnersHierarchySubset).to.equal(expectedDataOwnerHierarchySubset)
          tagsFilter([])
          async function* generator(): AsyncGenerator<{ encryptionKey: string; dataOwnersWithAccess: string[] }, void, never> {
            yield { encryptionKey: '1', dataOwnersWithAccess: ['1'] }
            yield { encryptionKey: '2', dataOwnersWithAccess: ['2'] }
            yield { encryptionKey: '3', dataOwnersWithAccess: ['3'] }
          }
          return generator()
        },
        decryptOwningEntityIdsOf: () => {
          throw new Error('This should not be called')
        },
        decryptSecretIdsOf: () => {
          throw new Error('This should not be called')
        },
      },
      {
        decryptEncryptionKeysOf(
          typedEntity: EncryptedEntityWithType,
          dataOwnersHierarchySubset: string[],
          tagsFilter: (tags: string[]) => boolean
        ): AsyncGenerator<{ encryptionKey: string; dataOwnersWithAccess: string[] }, void, never> {
          expect(typedEntity).to.equal(expectedEntity)
          expect(dataOwnersHierarchySubset).to.equal(expectedDataOwnerHierarchySubset)
          tagsFilter([])
          async function* generator(): AsyncGenerator<{ encryptionKey: string; dataOwnersWithAccess: string[] }, void, never> {
            yield { encryptionKey: '4', dataOwnersWithAccess: ['4'] }
            yield { encryptionKey: '5', dataOwnersWithAccess: ['5'] }
            yield { encryptionKey: '6', dataOwnersWithAccess: ['6'] }
          }
          return generator()
        },
        decryptOwningEntityIdsOf: () => {
          throw new Error('This should not be called')
        },
        decryptSecretIdsOf: () => {
          throw new Error('This should not be called')
        },
      },
    ])
    let callsToTags = 0
    let generator = chained.decryptEncryptionKeysOf(expectedEntity, expectedDataOwnerHierarchySubset, () => {
      callsToTags++
      return true
    })
    let next = await generator.next()
    for (let i = 1; i <= 6; i++) {
      const si = toString(i)
      expect(next.value?.encryptionKey).to.equal(si)
      expect(next.value?.dataOwnersWithAccess?.[0]).to.equal(si)
      expect(next.value?.dataOwnersWithAccess).to.have.length(1)
      expect(next.done).to.be.false
      next = await generator.next()
    }
    expect(next.value).to.be.undefined
    expect(next.done).to.be.true
    expect(callsToTags).to.equal(2)
  })

  it('should return all elements in order for secret ids', async function () {
    const chained = new SecurityMetadataDecryptorChain([
      {
        decryptSecretIdsOf(
          typedEntity: EncryptedEntityWithType,
          dataOwnersHierarchySubset: string[],
          tagsFilter: (tags: string[]) => boolean
        ): AsyncGenerator<{ secretId: string; dataOwnersWithAccess: string[] }, void, never> {
          expect(typedEntity).to.equal(expectedEntity)
          expect(dataOwnersHierarchySubset).to.equal(expectedDataOwnerHierarchySubset)
          tagsFilter([])
          async function* generator(): AsyncGenerator<{ secretId: string; dataOwnersWithAccess: string[] }, void, never> {
            yield { secretId: '1', dataOwnersWithAccess: ['1'] }
            yield { secretId: '2', dataOwnersWithAccess: ['2'] }
            yield { secretId: '3', dataOwnersWithAccess: ['3'] }
          }
          return generator()
        },
        decryptEncryptionKeysOf: () => {
          throw new Error('This should not be called')
        },
        decryptOwningEntityIdsOf: () => {
          throw new Error('This should not be called')
        },
      },
      {
        decryptSecretIdsOf(
          typedEntity: EncryptedEntityWithType,
          dataOwnersHierarchySubset: string[],
          tagsFilter: (tags: string[]) => boolean
        ): AsyncGenerator<{ secretId: string; dataOwnersWithAccess: string[] }, void, never> {
          expect(typedEntity).to.equal(expectedEntity)
          expect(dataOwnersHierarchySubset).to.equal(expectedDataOwnerHierarchySubset)
          tagsFilter([])
          async function* generator(): AsyncGenerator<{ secretId: string; dataOwnersWithAccess: string[] }, void, never> {
            yield { secretId: '4', dataOwnersWithAccess: ['4'] }
            yield { secretId: '5', dataOwnersWithAccess: ['5'] }
            yield { secretId: '6', dataOwnersWithAccess: ['6'] }
          }
          return generator()
        },
        decryptEncryptionKeysOf: () => {
          throw new Error('This should not be called')
        },
        decryptOwningEntityIdsOf: () => {
          throw new Error('This should not be called')
        },
      },
    ])
    let callsToTags = 0
    let generator = chained.decryptSecretIdsOf(expectedEntity, expectedDataOwnerHierarchySubset, () => {
      callsToTags++
      return true
    })
    let next = await generator.next()
    for (let i = 1; i <= 6; i++) {
      const si = toString(i)
      expect(next.value?.secretId).to.equal(si)
      expect(next.value?.dataOwnersWithAccess?.[0]).to.equal(si)
      expect(next.value?.dataOwnersWithAccess).to.have.length(1)
      expect(next.done).to.be.false
      next = await generator.next()
    }
    expect(next.value).to.be.undefined
    expect(next.done).to.be.true
    expect(callsToTags).to.equal(2)
  })

  it('should return all elements in order for owning entity id', async function () {
    const chained = new SecurityMetadataDecryptorChain([
      {
        decryptOwningEntityIdsOf(
          typedEntity: EncryptedEntityWithType,
          dataOwnersHierarchySubset: string[],
          tagsFilter: (tags: string[]) => boolean
        ): AsyncGenerator<{ owningEntityId: string; dataOwnersWithAccess: string[] }, void, never> {
          expect(typedEntity).to.equal(expectedEntity)
          expect(dataOwnersHierarchySubset).to.equal(expectedDataOwnerHierarchySubset)
          tagsFilter([])
          async function* generator(): AsyncGenerator<{ owningEntityId: string; dataOwnersWithAccess: string[] }, void, never> {
            yield { owningEntityId: '1', dataOwnersWithAccess: ['1'] }
            yield { owningEntityId: '2', dataOwnersWithAccess: ['2'] }
            yield { owningEntityId: '3', dataOwnersWithAccess: ['3'] }
          }
          return generator()
        },
        decryptEncryptionKeysOf: () => {
          throw new Error('This should not be called')
        },
        decryptSecretIdsOf: () => {
          throw new Error('This should not be called')
        },
      },
      {
        decryptOwningEntityIdsOf(
          typedEntity: EncryptedEntityWithType,
          dataOwnersHierarchySubset: string[],
          tagsFilter: (tags: string[]) => boolean
        ): AsyncGenerator<{ owningEntityId: string; dataOwnersWithAccess: string[] }, void, never> {
          expect(typedEntity).to.equal(expectedEntity)
          expect(dataOwnersHierarchySubset).to.equal(expectedDataOwnerHierarchySubset)
          tagsFilter([])
          async function* generator(): AsyncGenerator<{ owningEntityId: string; dataOwnersWithAccess: string[] }, void, never> {
            yield { owningEntityId: '4', dataOwnersWithAccess: ['4'] }
            yield { owningEntityId: '5', dataOwnersWithAccess: ['5'] }
            yield { owningEntityId: '6', dataOwnersWithAccess: ['6'] }
          }
          return generator()
        },
        decryptEncryptionKeysOf: () => {
          throw new Error('This should not be called')
        },
        decryptSecretIdsOf: () => {
          throw new Error('This should not be called')
        },
      },
    ])
    let callsToTags = 0
    let generator = chained.decryptOwningEntityIdsOf(expectedEntity, expectedDataOwnerHierarchySubset, () => {
      callsToTags++
      return true
    })
    let next = await generator.next()
    for (let i = 1; i <= 6; i++) {
      const si = toString(i)
      expect(next.value?.owningEntityId).to.equal(si)
      expect(next.value?.dataOwnersWithAccess?.[0]).to.equal(si)
      expect(next.value?.dataOwnersWithAccess).to.have.length(1)
      expect(next.done).to.be.false
      next = await generator.next()
    }
    expect(next.value).to.be.undefined
    expect(next.done).to.be.true
    expect(callsToTags).to.equal(2)
  })
})
