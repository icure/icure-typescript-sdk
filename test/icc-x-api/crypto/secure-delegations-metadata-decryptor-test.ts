import { describe } from 'mocha'
import { CryptoPrimitives } from '../../../icc-x-api/crypto/CryptoPrimitives'
import { randomUUID, webcrypto } from 'crypto'
import { FakeEncryptionKeysManager } from '../../utils/FakeEncryptionKeysManager'
import { SecureDelegationsSecurityMetadataDecryptor } from '../../../icc-x-api/crypto/SecureDelegationsSecurityMetadataDecryptor'
import { SecureDelegationsEncryption } from '../../../icc-x-api/crypto/SecureDelegationsEncryption'
import { FakeDecryptionExchangeDataManager } from '../../utils/FakeExchangeDataManager'
import { EncryptedEntityWithType, EntityWithDelegationTypeName } from '../../../icc-x-api/utils/EntityWithDelegationTypeName'
import { ExchangeData } from '../../../icc-api/model/ExchangeData'
import { expect } from 'chai'
import { IcureStub } from '../../../icc-api/model/IcureStub'
import { SecureDelegation } from '../../../icc-api/model/SecureDelegation'
import AccessLevel = SecureDelegation.AccessLevelEnum
import { ua2hex } from '../../../icc-x-api'
import { SecurityMetadata } from '../../../icc-api/model/SecurityMetadata'
import { asyncGeneratorToArray } from '../../../icc-x-api/utils/collection-utils'

describe('Secure delegations security metadata decryptor', async function () {
  const primitives = new CryptoPrimitives(webcrypto as any)
  const expectedType: EntityWithDelegationTypeName = 'AccessLog'
  const expectedSfks = [primitives.randomUuid(), primitives.randomUuid()]
  let encryptionKeysManager: FakeEncryptionKeysManager
  let exchangeData: FakeDecryptionExchangeDataManager
  let decryptor: SecureDelegationsSecurityMetadataDecryptor
  let secureDelegationsEncryption: SecureDelegationsEncryption

  async function initialiseComponents() {
    encryptionKeysManager = await FakeEncryptionKeysManager.create(primitives, [], [await primitives.RSA.generateKeyPair()])
    exchangeData = new FakeDecryptionExchangeDataManager(expectedType, expectedSfks)
    secureDelegationsEncryption = new SecureDelegationsEncryption(encryptionKeysManager, primitives)
    decryptor = new SecureDelegationsSecurityMetadataDecryptor(exchangeData, secureDelegationsEncryption)
  }

  async function randomHash(): Promise<string> {
    return ua2hex(await primitives.sha256(primitives.randomBytes(4)))
  }

  async function createExchangeDataAndSecureDelegationEncryptedData(
    exchangeDataDelegator: string,
    exchangeDataDelegate: string
  ): Promise<{
    exchangeData: ExchangeData
    exchangeKey: CryptoKey
    secureDelegationEncryptedData: {
      secretIds: string[]
      encryptionKeys: string[]
      owningEntityIds: string[]
    }
    expectedDecryptedData: {
      secretIds: string[]
      encryptionKeys: string[]
      owningEntityIds: string[]
    }
  }> {
    const exchangeKey = await primitives.AES.generateCryptoKey(false)
    const exchangeData = new ExchangeData({
      id: primitives.randomUuid(),
      delegator: exchangeDataDelegator,
      delegate: exchangeDataDelegate,
      exchangeKey: { ignored: 'in this test' },
      accessControlSecret: { ignored: 'in this test' },
      signature: { ignored: 'in this test' },
    })
    const expectedDecryptedData = {
      secretIds: [primitives.randomUuid(), primitives.randomUuid()],
      encryptionKeys: [await primitives.AES.generateCryptoKey(true), await primitives.AES.generateCryptoKey(true)],
      owningEntityIds: [primitives.randomUuid(), primitives.randomUuid()],
    }
    const secureDelegationEncryptedData = {
      secretIds: await Promise.all(expectedDecryptedData.secretIds.map((x) => secureDelegationsEncryption.encryptSecretId(x, exchangeKey))),
      encryptionKeys: await Promise.all(
        expectedDecryptedData.encryptionKeys.map((x) => secureDelegationsEncryption.encryptEncryptionKey(x, exchangeKey))
      ),
      owningEntityIds: await Promise.all(
        expectedDecryptedData.owningEntityIds.map((x) => secureDelegationsEncryption.encryptOwningEntityId(x, exchangeKey))
      ),
    }
    return { exchangeKey, exchangeData, expectedDecryptedData, secureDelegationEncryptedData }
  }

  function entityWithSecurityMetadata(securityMetadata: SecurityMetadata): EncryptedEntityWithType {
    return {
      entity: new IcureStub({
        secretForeignKeys: expectedSfks,
        securityMetadata,
      }),
      type: expectedType,
    }
  }

  function toSortedJson(data: { decrypted: string; dataOwnersWithAccess: string[] }): string {
    return JSON.stringify({
      decrypted: data.decrypted,
      dataOwnersWithAccess: [...data.dataOwnersWithAccess].sort(),
    })
  }

  async function verifyCanDecryptEntityData(
    entity: EncryptedEntityWithType,
    dataOwnerHierarchySubset: string[],
    expected: {
      exchangeData: ExchangeData
      expectedDecryptedData: {
        secretIds: string[]
        encryptionKeys: string[]
        owningEntityIds: string[]
      }
    }[]
  ) {
    const actualSecretIds = (await asyncGeneratorToArray(decryptor.decryptSecretIdsOf(entity, dataOwnerHierarchySubset))).map(toSortedJson)
    const actualOwningEntityIds = (await asyncGeneratorToArray(decryptor.decryptOwningEntityIdsOf(entity, dataOwnerHierarchySubset))).map(
      toSortedJson
    )
    const actualEncryptionKeys = (await asyncGeneratorToArray(decryptor.decryptEncryptionKeysOf(entity, dataOwnerHierarchySubset))).map(toSortedJson)
    const expectedSecretIds: string[] = []
    const expectedOwningEntityIds: string[] = []
    const expectedEncryptionKeys: string[] = []
    for (const data of expected) {
      data.expectedDecryptedData.secretIds.forEach((x) =>
        expectedSecretIds.push(toSortedJson({ decrypted: x, dataOwnersWithAccess: [data.exchangeData.delegate, data.exchangeData.delegator] }))
      )
      data.expectedDecryptedData.owningEntityIds.forEach((x) =>
        expectedOwningEntityIds.push(toSortedJson({ decrypted: x, dataOwnersWithAccess: [data.exchangeData.delegate, data.exchangeData.delegator] }))
      )
      data.expectedDecryptedData.encryptionKeys.forEach((x) =>
        expectedEncryptionKeys.push(toSortedJson({ decrypted: x, dataOwnersWithAccess: [data.exchangeData.delegate, data.exchangeData.delegator] }))
      )
    }
    expect(actualSecretIds).to.have.members(expectedSecretIds)
    expect(actualOwningEntityIds).to.have.members(expectedOwningEntityIds)
    expect(actualEncryptionKeys).to.have.members(expectedEncryptionKeys)
  }

  it('should be able to decrypt data from a secure delegation accessible by hash if the hash is cached', async function () {
    await initialiseComponents()
    const self = primitives.randomUuid()
    const createdData1 = await createExchangeDataAndSecureDelegationEncryptedData(self, primitives.randomUuid())
    const createdData2 = await createExchangeDataAndSecureDelegationEncryptedData(primitives.randomUuid(), self)
    const delegation1 = new SecureDelegation({
      ...createdData1.secureDelegationEncryptedData,
      delegator: undefined,
      delegate: undefined,
      exchangeDataId: undefined,
      encryptedExchangeDataId: undefined,
      permissions: AccessLevel.WRITE,
    })
    const delegation2 = new SecureDelegation({
      ...createdData2.secureDelegationEncryptedData,
      delegator: undefined,
      delegate: undefined,
      exchangeDataId: undefined,
      encryptedExchangeDataId: undefined,
      permissions: AccessLevel.WRITE,
    })
    const hash1 = await randomHash()
    const hash2 = await randomHash()
    const hash3 = await randomHash()
    const entity = entityWithSecurityMetadata(
      new SecurityMetadata({
        secureDelegations: { [hash1]: delegation1, [hash2]: delegation2 },
        keysEquivalences: { [hash3]: hash2 },
      })
    )
    exchangeData.cacheFakeData(createdData1.exchangeData, { exchangeKey: createdData1.exchangeKey, hashes: [hash1] })
    exchangeData.cacheFakeData(createdData2.exchangeData, { exchangeKey: createdData2.exchangeKey, hashes: [hash3] })
    await verifyCanDecryptEntityData(entity, [self], [createdData1, createdData2])
  })

  it('should be able to decrypt data from a secure delegation with clear text id where the delegator or delegate are in dataOwnersHierarchySubset', async function () {
    await initialiseComponents()
    const self = primitives.randomUuid()
    const other1 = primitives.randomUuid()
    const other2 = primitives.randomUuid()
    const createdData1 = await createExchangeDataAndSecureDelegationEncryptedData(self, other1)
    const createdData2 = await createExchangeDataAndSecureDelegationEncryptedData(other2, self)
    const delegation1 = new SecureDelegation({
      ...createdData1.secureDelegationEncryptedData,
      delegator: self,
      delegate: other1,
      exchangeDataId: createdData1.exchangeData.id,
      encryptedExchangeDataId: undefined,
      permissions: AccessLevel.WRITE,
    })
    const delegation2 = new SecureDelegation({
      ...createdData2.secureDelegationEncryptedData,
      delegator: other2,
      delegate: self,
      exchangeDataId: createdData2.exchangeData.id,
      encryptedExchangeDataId: undefined,
      permissions: AccessLevel.WRITE,
    })
    const entity = entityWithSecurityMetadata(
      new SecurityMetadata({
        secureDelegations: { [await randomHash()]: delegation1, [await randomHash()]: delegation2 },
      })
    )
    exchangeData.cacheFakeData(createdData1.exchangeData, { exchangeKey: createdData1.exchangeKey, hashes: [] }, true)
    exchangeData.cacheFakeData(createdData2.exchangeData, { exchangeKey: createdData2.exchangeKey, hashes: [] })
    await verifyCanDecryptEntityData(entity, [self], [createdData1, createdData2])
  })

  it('should be able to decrypt data from a secure delegation with encrypted id if the keys to decrypt the id are available and the delegator or delegate is in dataOwnersHierarchySubset', async function () {
    await initialiseComponents()
    const self = primitives.randomUuid()
    const createdData1 = await createExchangeDataAndSecureDelegationEncryptedData(self, primitives.randomUuid())
    const createdData2 = await createExchangeDataAndSecureDelegationEncryptedData(primitives.randomUuid(), self)
    const encryptionKeys = Object.fromEntries(Object.entries(encryptionKeysManager.getDecryptionKeys()).map(([fp, pair]) => [fp, pair.publicKey]))
    const delegation1 = new SecureDelegation({
      ...createdData1.secureDelegationEncryptedData,
      delegator: self,
      encryptedExchangeDataId: await secureDelegationsEncryption.encryptExchangeDataId(createdData1.exchangeData.id!, encryptionKeys),
      permissions: AccessLevel.WRITE,
    })
    const delegation2 = new SecureDelegation({
      ...createdData2.secureDelegationEncryptedData,
      delegate: self,
      encryptedExchangeDataId: await secureDelegationsEncryption.encryptExchangeDataId(createdData2.exchangeData.id!, encryptionKeys),
      permissions: AccessLevel.WRITE,
    })
    const entity = entityWithSecurityMetadata(
      new SecurityMetadata({
        secureDelegations: { [await randomHash()]: delegation1, [await randomHash()]: delegation2 },
      })
    )
    exchangeData.cacheFakeData(createdData1.exchangeData, { exchangeKey: createdData1.exchangeKey, hashes: [] }, true)
    exchangeData.cacheFakeData(createdData2.exchangeData, { exchangeKey: createdData2.exchangeKey, hashes: [] })
    await verifyCanDecryptEntityData(entity, [self], [createdData1, createdData2])
  })

  it('should be able to decrypt data from secure delegations accessible by encrypted or cleartext id', async function () {
    await initialiseComponents()
    const self = primitives.randomUuid()
    const other1 = primitives.randomUuid()
    const other2 = primitives.randomUuid()
    const createdData1 = await createExchangeDataAndSecureDelegationEncryptedData(self, other1)
    const createdData2 = await createExchangeDataAndSecureDelegationEncryptedData(other2, self)
    const createdData3 = await createExchangeDataAndSecureDelegationEncryptedData(self, primitives.randomUuid())
    const createdData4 = await createExchangeDataAndSecureDelegationEncryptedData(primitives.randomUuid(), self)
    const encryptionKeys = Object.fromEntries(Object.entries(encryptionKeysManager.getDecryptionKeys()).map(([fp, pair]) => [fp, pair.publicKey]))
    const delegation1 = new SecureDelegation({
      ...createdData1.secureDelegationEncryptedData,
      delegator: self,
      delegate: other1,
      exchangeDataId: createdData1.exchangeData.id,
      encryptedExchangeDataId: undefined,
      permissions: AccessLevel.WRITE,
    })
    const delegation2 = new SecureDelegation({
      ...createdData2.secureDelegationEncryptedData,
      delegator: other2,
      delegate: self,
      exchangeDataId: createdData2.exchangeData.id,
      encryptedExchangeDataId: undefined,
      permissions: AccessLevel.WRITE,
    })
    const delegation3 = new SecureDelegation({
      ...createdData3.secureDelegationEncryptedData,
      delegator: self,
      encryptedExchangeDataId: await secureDelegationsEncryption.encryptExchangeDataId(createdData3.exchangeData.id!, encryptionKeys),
      permissions: AccessLevel.WRITE,
    })
    const delegation4 = new SecureDelegation({
      ...createdData4.secureDelegationEncryptedData,
      delegate: self,
      encryptedExchangeDataId: await secureDelegationsEncryption.encryptExchangeDataId(createdData4.exchangeData.id!, encryptionKeys),
      permissions: AccessLevel.WRITE,
    })
    const entity = entityWithSecurityMetadata(
      new SecurityMetadata({
        secureDelegations: {
          [await randomHash()]: delegation1,
          [await randomHash()]: delegation2,
          [await randomHash()]: delegation3,
          [await randomHash()]: delegation4,
        },
      })
    )
    exchangeData.cacheFakeData(createdData1.exchangeData, { exchangeKey: createdData1.exchangeKey, hashes: [] }, true)
    exchangeData.cacheFakeData(createdData2.exchangeData, { exchangeKey: createdData2.exchangeKey, hashes: [] })
    exchangeData.cacheFakeData(createdData3.exchangeData, { exchangeKey: createdData3.exchangeKey, hashes: [] }, true)
    exchangeData.cacheFakeData(createdData4.exchangeData, { exchangeKey: createdData4.exchangeKey, hashes: [] })
    await verifyCanDecryptEntityData(entity, [self], [createdData1, createdData2, createdData3, createdData4])
  })

  // Note: mixed scenario where part of secure delegation is accessible by hash and part by id (clear-text or encrypted) is not realistic and not tested

  it('should ignore delegations accessible by id where the neither the delegator nor delegate are in dataOwnersHierarchySubset', async function () {
    await initialiseComponents()
    const createdData1 = await createExchangeDataAndSecureDelegationEncryptedData(primitives.randomUuid(), primitives.randomUuid())
    const createdData2 = await createExchangeDataAndSecureDelegationEncryptedData(primitives.randomUuid(), primitives.randomUuid())
    const delegation1 = new SecureDelegation({
      ...createdData1.secureDelegationEncryptedData,
      delegator: primitives.randomUuid(),
      delegate: primitives.randomUuid(),
      exchangeDataId: createdData1.exchangeData.id,
      encryptedExchangeDataId: undefined,
      permissions: AccessLevel.WRITE,
    })
    const delegation2 = new SecureDelegation({
      ...createdData2.secureDelegationEncryptedData,
      delegator: primitives.randomUuid(),
      delegate: primitives.randomUuid(),
      exchangeDataId: createdData2.exchangeData.id,
      encryptedExchangeDataId: undefined,
      permissions: AccessLevel.WRITE,
    })
    const entity = entityWithSecurityMetadata(
      new SecurityMetadata({
        secureDelegations: { [await randomHash()]: delegation1, [await randomHash()]: delegation2 },
      })
    )
    await verifyCanDecryptEntityData(entity, [primitives.randomUuid()], [])
  })

  it('should ignore secure delegation with encrypted id if the keys to decrypt the id are not available', async function () {
    await initialiseComponents()
    const self = primitives.randomUuid()
    const createdData = await createExchangeDataAndSecureDelegationEncryptedData(self, primitives.randomUuid())
    const newKey = await primitives.RSA.generateKeyPair()
    const newKeyFp = ua2hex(await primitives.RSA.exportKey(newKey.publicKey, 'spki')).slice(-32)
    const delegation = new SecureDelegation({
      ...createdData.secureDelegationEncryptedData,
      delegator: self,
      encryptedExchangeDataId: await secureDelegationsEncryption.encryptExchangeDataId(createdData.exchangeData.id!, {
        [newKeyFp]: newKey.publicKey,
      }),
      permissions: AccessLevel.WRITE,
    })
    const entity = entityWithSecurityMetadata(
      new SecurityMetadata({
        secureDelegations: { [await randomHash()]: delegation },
      })
    )
    exchangeData.cacheFakeData(createdData.exchangeData, { exchangeKey: createdData.exchangeKey, hashes: [] })
    await verifyCanDecryptEntityData(entity, [self], [])
  })

  it('should ignore secure delegations corresponding to exchange data which could not be decrypted', async function () {
    await initialiseComponents()
    const self = primitives.randomUuid()
    const other1 = primitives.randomUuid()
    const other2 = primitives.randomUuid()
    const createdData1 = await createExchangeDataAndSecureDelegationEncryptedData(self, other1)
    const createdData2 = await createExchangeDataAndSecureDelegationEncryptedData(other2, self)
    const delegation1 = new SecureDelegation({
      ...createdData1.secureDelegationEncryptedData,
      delegator: self,
      delegate: other1,
      exchangeDataId: createdData1.exchangeData.id,
      encryptedExchangeDataId: undefined,
      permissions: AccessLevel.WRITE,
    })
    const delegation2 = new SecureDelegation({
      ...createdData2.secureDelegationEncryptedData,
      delegator: other2,
      delegate: self,
      exchangeDataId: createdData2.exchangeData.id,
      encryptedExchangeDataId: undefined,
      permissions: AccessLevel.WRITE,
    })
    const entity = entityWithSecurityMetadata(
      new SecurityMetadata({
        secureDelegations: { [await randomHash()]: delegation1, [await randomHash()]: delegation2 },
      })
    )
    exchangeData.cacheFakeData(createdData1.exchangeData, { exchangeKey: createdData1.exchangeKey, hashes: [] })
    exchangeData.cacheFakeData(createdData2.exchangeData, undefined)
    await verifyCanDecryptEntityData(entity, [self], [createdData1])
  })

  it('should give an error if dataOwnersHierarchySubset is empty', async function () {
    await initialiseComponents()
    const entity = {
      entity: new IcureStub({ secretForeignKeys: expectedSfks }),
      type: expectedType,
    }
    let failed = 0
    try {
      decryptor.decryptEncryptionKeysOf(entity, [])
    } catch (e) {
      console.log(e)
      failed++
    }
    try {
      decryptor.decryptSecretIdsOf(entity, [])
    } catch (e) {
      console.log(e)
      failed++
    }
    try {
      decryptor.decryptOwningEntityIdsOf(entity, [])
    } catch (e) {
      console.log(e)
      failed++
    }
    try {
      await decryptor.getFullEntityAccessLevel(entity, [])
    } catch (e) {
      console.log(e)
      failed++
    }
    expect(failed).to.equal(4)
  })

  it('should return the best access level with directly accessible secure delegations', async function () {
    await initialiseComponents()
    const dataOwnerA = primitives.randomUuid()
    const dataOwnerB = primitives.randomUuid()
    const secureDelegationWriteA = new SecureDelegation({ delegator: dataOwnerA, permissions: AccessLevel.WRITE })
    const secureDelegationReadA = new SecureDelegation({ delegate: dataOwnerA, permissions: AccessLevel.READ })
    const secureDelegationWriteB = new SecureDelegation({ delegate: dataOwnerB, permissions: AccessLevel.WRITE })
    const secureDelegationReadB = new SecureDelegation({ delegator: dataOwnerB, permissions: AccessLevel.READ })
    const secureDelegationWriteOther = new SecureDelegation({ delegator: primitives.randomUuid(), permissions: AccessLevel.WRITE })
    const secureDelegationReadOther = new SecureDelegation({ delegator: primitives.randomUuid(), permissions: AccessLevel.READ })
    expect(
      await decryptor.getFullEntityAccessLevel(
        entityWithSecurityMetadata({
          secureDelegations: {
            [await randomHash()]: secureDelegationReadA,
            [await randomHash()]: secureDelegationWriteOther,
            [await randomHash()]: secureDelegationWriteB,
          },
        }),
        [dataOwnerA]
      )
    ).to.equal(AccessLevel.READ)
    expect(
      await decryptor.getFullEntityAccessLevel(
        entityWithSecurityMetadata({
          secureDelegations: {
            [await randomHash()]: secureDelegationReadA,
            [await randomHash()]: secureDelegationWriteOther,
            [await randomHash()]: secureDelegationWriteB,
          },
        }),
        [dataOwnerB]
      )
    ).to.equal(AccessLevel.WRITE)
    expect(
      await decryptor.getFullEntityAccessLevel(
        entityWithSecurityMetadata({
          secureDelegations: {
            [await randomHash()]: secureDelegationReadOther,
            [await randomHash()]: secureDelegationWriteB,
          },
        }),
        [dataOwnerA]
      )
    ).to.equal(undefined)
    expect(
      await decryptor.getFullEntityAccessLevel(
        entityWithSecurityMetadata({
          secureDelegations: {
            [await randomHash()]: secureDelegationReadA,
            [await randomHash()]: secureDelegationWriteOther,
            [await randomHash()]: secureDelegationWriteB,
          },
        }),
        [dataOwnerA, dataOwnerB]
      )
    ).to.equal(AccessLevel.WRITE)
    expect(
      await decryptor.getFullEntityAccessLevel(
        entityWithSecurityMetadata({
          secureDelegations: {
            [await randomHash()]: secureDelegationReadA,
            [await randomHash()]: secureDelegationReadB,
            [await randomHash()]: secureDelegationWriteOther,
          },
        }),
        [dataOwnerA, dataOwnerB]
      )
    ).to.equal(AccessLevel.READ)
    expect(
      await decryptor.getFullEntityAccessLevel(
        entityWithSecurityMetadata({
          secureDelegations: {
            [await randomHash()]: secureDelegationWriteA,
          },
        }),
        [dataOwnerA, dataOwnerB]
      )
    ).to.equal(AccessLevel.WRITE)
  })

  it('should return the best access level with secure delegations accessible through hash', async function () {
    const hashA = await randomHash()
    const hashB = await randomHash()
    const secureDelegationWriteA: [string, SecureDelegation] = [hashA, new SecureDelegation({ permissions: AccessLevel.WRITE })]
    const secureDelegationReadA: [string, SecureDelegation] = [hashA, new SecureDelegation({ permissions: AccessLevel.READ })]
    const secureDelegationWriteB: [string, SecureDelegation] = [hashB, new SecureDelegation({ permissions: AccessLevel.WRITE })]
    const secureDelegationReadB: [string, SecureDelegation] = [hashB, new SecureDelegation({ permissions: AccessLevel.READ })]
    const secureDelegationWriteOther: [string, SecureDelegation] = [
      await randomHash(),
      new SecureDelegation({ delegator: primitives.randomUuid(), permissions: AccessLevel.WRITE }),
    ]
    const secureDelegationReadOther: [string, SecureDelegation] = [
      await randomHash(),
      new SecureDelegation({ delegator: primitives.randomUuid(), permissions: AccessLevel.READ }),
    ]

    async function testWithEntriesAndHashes(entries: [string, SecureDelegation][], hashes: string[], expectedLevel: AccessLevel | undefined) {
      await initialiseComponents()
      for (const hash of hashes) {
        exchangeData.cacheFakeData({} as any, { exchangeKey: {} as any, hashes: [hash] })
      }
      expect(
        await decryptor.getFullEntityAccessLevel(
          entityWithSecurityMetadata({
            secureDelegations: Object.fromEntries(entries),
          }),
          [primitives.randomUuid()]
        )
      ).to.equal(expectedLevel)
    }

    await testWithEntriesAndHashes([secureDelegationReadA, secureDelegationWriteB, secureDelegationWriteOther], [hashA], AccessLevel.READ)
    await testWithEntriesAndHashes([secureDelegationReadA, secureDelegationWriteB, secureDelegationWriteOther], [hashB], AccessLevel.WRITE)
    await testWithEntriesAndHashes([secureDelegationWriteB, secureDelegationReadOther], [hashA], undefined)
    await testWithEntriesAndHashes([secureDelegationReadA, secureDelegationWriteB, secureDelegationWriteOther], [hashA, hashB], AccessLevel.WRITE)
    await testWithEntriesAndHashes([secureDelegationReadA, secureDelegationReadB, secureDelegationWriteOther], [hashA, hashB], AccessLevel.READ)
    await testWithEntriesAndHashes([secureDelegationWriteA], [hashA, hashB], AccessLevel.WRITE)
  })
})
