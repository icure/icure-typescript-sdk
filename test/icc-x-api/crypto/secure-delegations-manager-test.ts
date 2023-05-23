import { describe } from 'mocha'
import { CryptoPrimitives } from '../../../icc-x-api/crypto/CryptoPrimitives'
import { webcrypto } from 'crypto'
import { FakeEncryptionKeysManager } from '../../utils/FakeEncryptionKeysManager'
import { SecureDelegationsSecurityMetadataDecryptor } from '../../../icc-x-api/crypto/SecureDelegationsSecurityMetadataDecryptor'
import { SecureDelegationsEncryption } from '../../../icc-x-api/crypto/SecureDelegationsEncryption'
import { ua2hex } from '../../../icc-x-api'
import { SecureDelegationsManager } from '../../../icc-x-api/crypto/SecureDelegationsManager'
import { AccessControlSecretUtils } from '../../../icc-x-api/crypto/AccessControlSecretUtils'
import { ExchangeDataManager, initialiseExchangeDataManagerForCurrentDataOwner } from '../../../icc-x-api/crypto/ExchangeDataManager'
import { BaseExchangeDataManager } from '../../../icc-x-api/crypto/BaseExchangeDataManager'
import { FakeExchangeDataApi } from '../../utils/FakeExchangeDataApi'
import { FakeDataOwnerApi } from '../../utils/FakeDataOwnerApi'
import { TestCryptoStrategies } from '../../utils/TestCryptoStrategies'
import { FakeSignatureKeysManager } from '../../utils/FakeSignatureKeysManager'
import { KeyPair } from '../../../icc-x-api/crypto/RSA'
import { EntityShareRequest } from '../../../icc-api/model/requests/EntityShareRequest'
import { expect } from 'chai'
import { EncryptedEntityStub } from '../../../icc-api/model/models'
import { EntityWithDelegationTypeName } from '../../../icc-x-api/utils/EntityWithDelegationTypeName'
import { SecurityMetadata } from '../../../icc-api/model/SecurityMetadata'
import { SecureDelegation } from '../../../icc-api/model/SecureDelegation'
import { asyncGeneratorToArray } from '../../../icc-x-api/utils/collection-utils'
import { EntitySharedMetadataUpdateRequest } from '../../../icc-api/model/requests/EntitySharedMetadataUpdateRequest'
import { fingerprintV2 } from '../../../icc-x-api/crypto/utils'
import { DataOwnerTypeEnum } from '../../../icc-api/model/DataOwnerTypeEnum'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionInternal
import EntryUpdateTypeEnum = EntitySharedMetadataUpdateRequest.EntryUpdateTypeEnum

describe('Secure delegations manager', async function () {
  const primitives = new CryptoPrimitives(webcrypto as any)
  let selfId: string
  let selfKeyFp: string
  let selfKeypair: KeyPair<CryptoKey>
  let delegateId: string
  let delegateKeyFp: string
  let delegateKeypair: KeyPair<CryptoKey>
  let dataOwnerApi: FakeDataOwnerApi
  let secureDelegationsEncryption: SecureDelegationsEncryption
  let decryptor: SecureDelegationsSecurityMetadataDecryptor
  let manager: SecureDelegationsManager
  let exchangeData: ExchangeDataManager
  let accessControlSecretUtils: AccessControlSecretUtils

  async function initialiseComponents(explicitSelf: boolean, explicitDelegate: boolean) {
    selfId = primitives.randomUuid()
    selfKeypair = await primitives.RSA.generateKeyPair('sha-256')
    selfKeyFp = ua2hex(await primitives.RSA.exportKey(selfKeypair.publicKey, 'spki')).slice(-32)
    delegateId = primitives.randomUuid()
    delegateKeypair = await primitives.RSA.generateKeyPair('sha-256')
    delegateKeyFp = fingerprintV2(ua2hex(await primitives.RSA.exportKey(delegateKeypair.publicKey, 'spki')))
    dataOwnerApi = new FakeDataOwnerApi(
      {
        id: selfId,
        type: explicitSelf ? DataOwnerTypeEnum.Hcp : DataOwnerTypeEnum.Patient,
        publicKey: ua2hex(await primitives.RSA.exportKey(selfKeypair.publicKey, 'spki')),
      },
      [
        {
          id: delegateId,
          type: explicitDelegate ? DataOwnerTypeEnum.Hcp : DataOwnerTypeEnum.Patient,
          publicKey: ua2hex(await primitives.RSA.exportKey(delegateKeypair.publicKey, 'spki')),
        },
      ]
    )
    const cryptoStrategies = new TestCryptoStrategies()
    const exchangeDataApi = new FakeExchangeDataApi()
    accessControlSecretUtils = new AccessControlSecretUtils(primitives)
    const encryptionKeysManager = await FakeEncryptionKeysManager.create(primitives, [selfKeypair])
    const signatureKeysManager = new FakeSignatureKeysManager(primitives)
    const baseExchangeData = new BaseExchangeDataManager(exchangeDataApi, dataOwnerApi, primitives, !explicitSelf)
    exchangeData = await initialiseExchangeDataManagerForCurrentDataOwner(
      baseExchangeData,
      encryptionKeysManager,
      signatureKeysManager,
      accessControlSecretUtils,
      cryptoStrategies,
      dataOwnerApi,
      primitives
    )
    secureDelegationsEncryption = new SecureDelegationsEncryption(encryptionKeysManager, primitives)
    decryptor = new SecureDelegationsSecurityMetadataDecryptor(exchangeData, secureDelegationsEncryption, dataOwnerApi)
    manager = new SecureDelegationsManager(
      exchangeData,
      secureDelegationsEncryption,
      accessControlSecretUtils,
      encryptionKeysManager,
      primitives,
      dataOwnerApi,
      cryptoStrategies,
      !explicitSelf
    )
  }

  it('should make a share request which will create a decryptable secure delegation.', async function () {
    async function doTest(explicitSelf: boolean, explicitDelegate: boolean) {
      await initialiseComponents(explicitSelf, explicitDelegate)
      const secretIds = [ua2hex(primitives.randomBytes(16)), ua2hex(primitives.randomBytes(16))]
      const encryptionKeys = [ua2hex(primitives.randomBytes(16))]
      const owningEntityIds = [ua2hex(primitives.randomBytes(16)), ua2hex(primitives.randomBytes(16)), ua2hex(primitives.randomBytes(16))]
      const entityType = 'Patient'
      const shareOrUpdateParams = await manager.makeShareOrUpdateRequestParams(
        { entity: { secretForeignKeys: [] }, type: entityType },
        delegateId,
        secretIds,
        encryptionKeys,
        owningEntityIds,
        EntityShareRequest.RequestedPermissionEnum.MAX_WRITE
      )
      expect(shareOrUpdateParams).to.not.be.undefined
      expect(shareOrUpdateParams!.update).to.be.undefined
      expect(shareOrUpdateParams!.share).to.not.be.undefined
      const shareParams = shareOrUpdateParams!.share!
      expect(shareParams.accessControlHashes).to.have.length(1)
      if (explicitSelf && explicitDelegate) {
        expect(shareParams.exchangeDataId).to.not.be.undefined
        expect(Object.entries(shareParams.encryptedExchangeDataId ?? {})).to.have.length(0)
      } else if (explicitSelf && !explicitDelegate) {
        expect(shareParams.exchangeDataId).to.be.undefined
        expect(Object.entries(shareParams.encryptedExchangeDataId ?? {})).to.have.length(1)
        expect(shareParams.encryptedExchangeDataId![selfKeyFp]).to.not.be.undefined
      } else if (!explicitSelf && explicitDelegate) {
        expect(shareParams.exchangeDataId).to.be.undefined
        expect(Object.entries(shareParams.encryptedExchangeDataId ?? {})).to.have.length(1)
        expect(shareParams.encryptedExchangeDataId![delegateKeyFp]).to.not.be.undefined
      } else {
        expect(shareParams.exchangeDataId).to.be.undefined
        expect(Object.entries(shareParams.encryptedExchangeDataId ?? {})).to.have.length(0)
      }
      const fakeEntity: { entity: EncryptedEntityStub; type: EntityWithDelegationTypeName } = {
        entity: {
          secretForeignKeys: [],
          securityMetadata: new SecurityMetadata({
            secureDelegations: {
              [shareParams.accessControlHashes[0]]: new SecureDelegation({
                delegator: shareParams.explicitDelegator,
                delegate: shareParams.explicitDelegate,
                secretIds: shareParams.secretIds,
                encryptionKeys: shareParams.encryptionKeys,
                owningEntityIds: shareParams.owningEntityIds,
                exchangeDataId: shareParams.exchangeDataId,
                encryptedExchangeDataId: shareParams.encryptedExchangeDataId,
                permissions: SecureDelegation.AccessLevelEnum.WRITE,
              }),
            },
          }),
        },
        type: 'Patient',
      }
      await exchangeData.clearOrRepopulateCache()
      const decryptedSecretIds = (await asyncGeneratorToArray(decryptor.decryptSecretIdsOf(fakeEntity, [selfId]))).map((x) => x.decrypted)
      const decryptedEncryptionKeys = (await asyncGeneratorToArray(decryptor.decryptEncryptionKeysOf(fakeEntity, [selfId]))).map((x) => x.decrypted)
      const decryptedOwningEntityIds = (await asyncGeneratorToArray(decryptor.decryptOwningEntityIdsOf(fakeEntity, [selfId]))).map((x) => x.decrypted)
      expect(decryptedSecretIds).to.have.length(secretIds.length)
      for (const secretId of secretIds) {
        expect(decryptedSecretIds).to.include(secretId)
      }
      expect(decryptedEncryptionKeys).to.have.length(encryptionKeys.length)
      for (const encryptionKey of encryptionKeys) {
        expect(decryptedEncryptionKeys).to.include(encryptionKey)
      }
      expect(decryptedOwningEntityIds).to.have.length(owningEntityIds.length)
      for (const owningEntityId of owningEntityIds) {
        expect(decryptedOwningEntityIds).to.include(owningEntityId)
      }
    }
    console.log('Patient->Patient')
    await doTest(false, false)
    console.log('Hcp->Patient')
    await doTest(true, false)
    console.log('Patient->Hcp')
    await doTest(false, true)
    console.log('Hcp->Hcp')
    await doTest(true, true)
  })

  it('should make an update request which the missing entries for existing secure delegations.', async function () {
    async function doTest(makeAccessibleFromAlias: boolean) {
      await initialiseComponents(false, false)
      const canonicalSfk = primitives.randomUuid()
      const aliasSfk = primitives.randomUuid()
      const exchangeDataInfo = await exchangeData.getOrCreateEncryptionDataTo(delegateId, 'Patient', [])
      const canonicalKey = await accessControlSecretUtils.secureDelegationKeyFor(exchangeDataInfo.accessControlSecret, 'Patient', canonicalSfk)
      const aliasKey = await accessControlSecretUtils.secureDelegationKeyFor(exchangeDataInfo.accessControlSecret, 'Patient', aliasSfk)
      const existingSecretIds = [ua2hex(primitives.randomBytes(16))]
      const newSecretIds = [ua2hex(primitives.randomBytes(16))]
      const existingEncryptionKeys: string[] = []
      const newEncryptionKeys = [ua2hex(primitives.randomBytes(16))]
      const existingOwningEntityIds = [ua2hex(primitives.randomBytes(16))]
      const newOwningEntityIds: string[] = []
      const fakeEntity: { entity: EncryptedEntityStub; type: EntityWithDelegationTypeName } = {
        entity: {
          secretForeignKeys: makeAccessibleFromAlias ? [aliasSfk] : [canonicalSfk],
          securityMetadata: new SecurityMetadata({
            secureDelegations: {
              [canonicalKey]: new SecureDelegation({
                delegator: selfId,
                delegate: selfId,
                secretIds: await secureDelegationsEncryption.encryptSecretIds(existingSecretIds, exchangeDataInfo.exchangeKey),
                encryptionKeys: await secureDelegationsEncryption.encryptEncryptionKeys(existingEncryptionKeys, exchangeDataInfo.exchangeKey),
                owningEntityIds: await secureDelegationsEncryption.encryptOwningEntityIds(existingOwningEntityIds, exchangeDataInfo.exchangeKey),
                permissions: SecureDelegation.AccessLevelEnum.WRITE,
              }),
            },
            keysEquivalences: { [aliasKey]: canonicalKey },
          }),
        },
        type: 'Patient',
      }
      const shareOrUpdateParams = await manager.makeShareOrUpdateRequestParams(
        fakeEntity,
        delegateId,
        [...existingSecretIds, ...newSecretIds],
        [...existingEncryptionKeys, ...newEncryptionKeys],
        [...existingOwningEntityIds, ...newOwningEntityIds],
        RequestedPermissionEnum.MAX_WRITE
      )
      expect(shareOrUpdateParams).to.not.be.undefined
      expect(shareOrUpdateParams!.share).to.be.undefined
      expect(shareOrUpdateParams!.update).to.not.be.undefined
      const updateParams = shareOrUpdateParams!.update!
      expect(updateParams.metadataAccessControlHash).to.equal(canonicalKey)
      expect(Object.keys(updateParams.secretIds ?? {})).to.have.length(newSecretIds.length)
      for (const [secretId, updateType] of Object.entries(updateParams.secretIds ?? {})) {
        expect(updateType).to.equal(EntryUpdateTypeEnum.CREATE)
        expect(newSecretIds).to.contain(await secureDelegationsEncryption.decryptSecretId(secretId, exchangeDataInfo.exchangeKey))
      }
      expect(Object.keys(updateParams.encryptionKeys ?? {})).to.have.length(newEncryptionKeys.length)
      for (const [encryptionKey, updateType] of Object.entries(updateParams.encryptionKeys ?? {})) {
        expect(updateType).to.equal(EntryUpdateTypeEnum.CREATE)
        expect(newEncryptionKeys).to.contain(await secureDelegationsEncryption.decryptEncryptionKey(encryptionKey, exchangeDataInfo.exchangeKey))
      }
      expect(Object.keys(updateParams.owningEntityIds ?? {})).to.have.length(newOwningEntityIds.length)
      for (const [owningEntityId, updateType] of Object.entries(updateParams.owningEntityIds ?? {})) {
        expect(updateType).to.equal(EntryUpdateTypeEnum.CREATE)
        expect(newOwningEntityIds).to.contain(await secureDelegationsEncryption.decryptOwningEntityId(owningEntityId, exchangeDataInfo.exchangeKey))
      }
    }
    await doTest(true)
    await doTest(false)
  })

  it('should return undefined for existing secure delegations if it contains all entries.', async function () {
    await initialiseComponents(false, false)
    const canonicalSfk = primitives.randomUuid()
    const exchangeDataInfo = await exchangeData.getOrCreateEncryptionDataTo(delegateId, 'Patient', [])
    const canonicalKey = await accessControlSecretUtils.secureDelegationKeyFor(exchangeDataInfo.accessControlSecret, 'Patient', canonicalSfk)
    const existingSecretIds = [ua2hex(primitives.randomBytes(16))]
    const existingEncryptionKeys: string[] = []
    const existingOwningEntityIds = [ua2hex(primitives.randomBytes(16))]
    const fakeEntity: { entity: EncryptedEntityStub; type: EntityWithDelegationTypeName } = {
      entity: {
        secretForeignKeys: [canonicalSfk],
        securityMetadata: new SecurityMetadata({
          secureDelegations: {
            [canonicalKey]: new SecureDelegation({
              delegator: selfId,
              delegate: selfId,
              secretIds: await secureDelegationsEncryption.encryptSecretIds(existingSecretIds, exchangeDataInfo.exchangeKey),
              encryptionKeys: await secureDelegationsEncryption.encryptEncryptionKeys(existingEncryptionKeys, exchangeDataInfo.exchangeKey),
              owningEntityIds: await secureDelegationsEncryption.encryptOwningEntityIds(existingOwningEntityIds, exchangeDataInfo.exchangeKey),
              permissions: SecureDelegation.AccessLevelEnum.WRITE,
            }),
          },
        }),
      },
      type: 'Patient',
    }
    const shareOrUpdateParams = await manager.makeShareOrUpdateRequestParams(
      fakeEntity,
      delegateId,
      [...existingSecretIds],
      [...existingEncryptionKeys],
      [...existingOwningEntityIds],
      RequestedPermissionEnum.MAX_WRITE
    )
    expect(shareOrUpdateParams).to.be.undefined
  })
})
