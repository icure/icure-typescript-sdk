import { describe } from 'mocha'
import {
  ExchangeDataManager,
  ExchangeDataManagerOptionalParameters,
  initialiseExchangeDataManagerForCurrentDataOwner,
} from '../../../icc-x-api/crypto/ExchangeDataManager'
import { CryptoPrimitives } from '../../../icc-x-api/crypto/CryptoPrimitives'
import { webcrypto } from 'crypto'
import { BaseExchangeDataManager } from '../../../icc-x-api/crypto/BaseExchangeDataManager'
import { FakeExchangeDataApi } from '../../utils/FakeExchangeDataApi'
import { FakeDataOwnerApi } from '../../utils/FakeDataOwnerApi'
import { TestCryptoStrategies } from '../../utils/TestCryptoStrategies'
import { ua2b64, ua2hex } from '../../../icc-x-api'
import { FakeEncryptionKeysManager } from '../../utils/FakeEncryptionKeysManager'
import { FakeSignatureKeysManager } from '../../utils/FakeSignatureKeysManager'
import { AccessControlSecretUtils } from '../../../icc-x-api/crypto/AccessControlSecretUtils'
import { ExchangeData } from '../../../icc-api/model/ExchangeData'
import { expect } from 'chai'
import { setEquals } from '../../../icc-x-api/utils/collection-utils'
import { KeyPair } from '../../../icc-x-api/crypto/RSA'
import * as _ from 'lodash'
import { fingerprintV1, fingerprintV1toV2, fingerprintV2 } from '../../../icc-x-api/crypto/utils'

describe('Exchange data manager', async function () {
  const primitives = new CryptoPrimitives(webcrypto as any)
  const accessControlSecretUtils = new AccessControlSecretUtils(primitives)
  let selfId: string
  let selfKeyFpV1: string
  let selfKeyFpV2: string
  let selfKeypair: KeyPair<CryptoKey>
  let delegateId: string
  let delegateKeyFp: string
  let delegateKeypair: KeyPair<CryptoKey>
  let dataOwnerApi: FakeDataOwnerApi
  let exchangeDataApi: FakeExchangeDataApi
  let baseExchangeData: BaseExchangeDataManager
  let exchangeData: ExchangeDataManager
  let encryptionKeysManager: FakeEncryptionKeysManager
  let signatureKeysManager: FakeSignatureKeysManager

  async function initialiseComponents(
    allowFullExchangeDataLoad: boolean,
    optionalParameters: ExchangeDataManagerOptionalParameters & { verifiedDelegateKeys?: Set<string> } = {}
  ) {
    const dataOwnerType = allowFullExchangeDataLoad ? 'patient' : 'hcp'
    selfId = primitives.randomUuid()
    selfKeypair = await primitives.RSA.generateKeyPair('sha-256')
    selfKeyFpV1 = fingerprintV1(ua2hex(await primitives.RSA.exportKey(selfKeypair.publicKey, 'spki')))
    selfKeyFpV2 = fingerprintV1toV2(selfKeyFpV1)
    delegateId = primitives.randomUuid()
    delegateKeypair = await primitives.RSA.generateKeyPair('sha-256')
    delegateKeyFp = ua2hex(await primitives.RSA.exportKey(delegateKeypair.publicKey, 'spki')).slice(-32)
    dataOwnerApi = new FakeDataOwnerApi(
      {
        id: selfId,
        type: dataOwnerType,
        publicKeysForOaepWithSha256: [ua2hex(await primitives.RSA.exportKey(selfKeypair.publicKey, 'spki'))],
      },
      [
        {
          id: delegateId,
          type: dataOwnerType,
          publicKeysForOaepWithSha256: [ua2hex(await primitives.RSA.exportKey(delegateKeypair.publicKey, 'spki'))],
        },
      ]
    )
    const cryptoStrategies = new TestCryptoStrategies(undefined, undefined, optionalParameters.verifiedDelegateKeys)
    exchangeDataApi = new FakeExchangeDataApi()
    baseExchangeData = new BaseExchangeDataManager(exchangeDataApi, dataOwnerApi, primitives, allowFullExchangeDataLoad)
    encryptionKeysManager = await FakeEncryptionKeysManager.create(primitives, [selfKeypair])
    signatureKeysManager = new FakeSignatureKeysManager(primitives)
    exchangeData = await initialiseExchangeDataManagerForCurrentDataOwner(
      baseExchangeData,
      encryptionKeysManager,
      signatureKeysManager,
      accessControlSecretUtils,
      cryptoStrategies,
      dataOwnerApi,
      primitives,
      optionalParameters
    )
  }

  async function checkDataEqual(
    actual: { exchangeData: ExchangeData; accessControlSecret?: string; exchangeKey: CryptoKey | undefined } | undefined,
    expected: { exchangeData: ExchangeData; accessControlSecret?: string; exchangeKey: CryptoKey | undefined }
  ) {
    expect(actual).to.not.be.undefined
    expect(_.isEqual(_.omit(expected.exchangeData, ['rev']), _.omit(actual!.exchangeData, ['rev']))).to.equal(
      true,
      `Data should be equivalent\nExpected: ${JSON.stringify(expected.exchangeData, undefined, 2)}\nActual: ${JSON.stringify(
        actual!.exchangeData,
        undefined,
        2
      )}\n`
    )
    expect(expected.accessControlSecret).to.equal(actual!.accessControlSecret)
    await checkAesKeysEquality(actual!.exchangeKey, expected.exchangeKey)
  }

  async function checkAesKeysEquality(actual: CryptoKey | undefined, expected: CryptoKey | undefined) {
    if (!actual && !expected) return
    expect(!actual).to.equal(!expected, !expected ? 'Key should not have been decrypted' : 'Key should have been decrypted')
    expect(ua2hex(await primitives.AES.exportKey(expected!, 'raw'))).to.equal(ua2hex(await primitives.AES.exportKey(actual!, 'raw')))
  }

  async function createDataFromRandomToSelf(): Promise<{ exchangeData: ExchangeData; exchangeKey: CryptoKey; accessControlSecret: string }> {
    const encryptionKey = await primitives.RSA.generateKeyPair('sha-256')
    const encryptionFp = ua2hex(await primitives.RSA.exportKey(encryptionKey.publicKey, 'spki')).slice(-32)
    const signatureKey = await primitives.RSA.generateSignatureKeyPair()
    const signatureFp = ua2hex(await primitives.RSA.exportKey(signatureKey.publicKey, 'spki')).slice(-32)
    const created = await baseExchangeData.createExchangeData(
      selfId,
      { [signatureFp]: signatureKey.privateKey },
      { [encryptionFp]: encryptionKey.publicKey, [selfKeyFpV1]: selfKeypair.publicKey }
    )
    const modified = await exchangeDataApi.modifyExchangeData(
      new ExchangeData({
        ...created.exchangeData,
        delegator: primitives.randomUuid(),
      })
    )
    return { exchangeData: modified, exchangeKey: created.exchangeKey, accessControlSecret: created.accessControlSecret }
  }

  async function generateEncryptionKeys(n: number): Promise<{ pair: KeyPair<CryptoKey>; fingerprintV2: string; hexPub: string }[]> {
    return await Promise.all(
      Array(n)
        .fill(null)
        .map(async () => {
          const pair = await primitives.RSA.generateKeyPair('sha-256')
          const hexPub = ua2hex(await primitives.RSA.exportKey(pair.publicKey, 'spki'))
          const fingerprint = fingerprintV2(hexPub)
          return { pair, fingerprintV2: fingerprint, hexPub }
        })
    )
  }

  it('base should be able to retrieve all exchange data for the current data owner if allowed by the crypto strategies', async function () {
    async function doTest(allowFullExchangeDataLoad: boolean) {
      await initialiseComponents(allowFullExchangeDataLoad)
      const expectedData = await Promise.all(
        Array.from(Array(3500), async (_, i) => {
          const data = new ExchangeData({
            id: primitives.randomUuid(),
            delegate: i % 2 === 0 ? selfId : primitives.randomUuid(),
            delegator: i % 2 === 0 ? primitives.randomUuid() : selfId,
            exchangeKey: { not: 'important' },
            accessControlSecret: { not: 'important' },
            signature: { not: 'important' },
          })
          await exchangeDataApi.createExchangeData(data)
          return data
        })
      )
      await Promise.all(
        Array.from(Array(500), async () => {
          // Should not be in result
          const data = new ExchangeData({
            id: primitives.randomUuid(),
            delegate: primitives.randomUuid(),
            delegator: primitives.randomUuid(),
            exchangeKey: { not: 'important' },
            accessControlSecret: { not: 'important' },
            signature: { not: 'important' },
          })
          await exchangeDataApi.createExchangeData(data)
        })
      )
      const retrieved = await baseExchangeData.getAllExchangeDataForCurrentDataOwnerIfAllowed()
      if (allowFullExchangeDataLoad) {
        expect(retrieved).to.not.be.undefined
        expect(retrieved).to.have.length(expectedData.length)
        expect(setEquals(new Set(expectedData.map((x) => x.id)), new Set(retrieved!.map((x) => x.id))), 'Retrieved and expected ids').to.be.true
      } else {
        expect(retrieved).to.be.undefined
      }
    }
    await doTest(true)
    await doTest(false)
  })

  it('should create new encryption keys when none is available', async function () {
    async function doTest(allowFullExchangeDataLoad: boolean) {
      await initialiseComponents(allowFullExchangeDataLoad)
      const sfk = primitives.randomUuid()
      const initialisedCount = exchangeDataApi.callCount
      const createdData = await exchangeData.getOrCreateEncryptionDataTo(delegateId, 'Contact', [sfk])
      const retrievedCachedData = await exchangeData.getOrCreateEncryptionDataTo(delegateId, 'Contact', [sfk])
      exchangeDataApi.compareCallCountFromBaseline(initialisedCount, {
        createExchangeData: 1,
        // If we could fully preload we already know whether the exchange key already exists or not, otherwise we have to request from the api
        getExchangeDataByDelegatorDelegate: allowFullExchangeDataLoad ? 0 : 1,
        modifyExchangeData: 0,
        getExchangeDataById: 0,
        getExchangeDataByParticipant: 0,
      })
      await checkDataEqual(retrievedCachedData, createdData)
      const decryptedKeyByDelegate = await baseExchangeData.tryDecryptExchangeKeys([createdData.exchangeData], { [delegateKeyFp]: delegateKeypair })
      const decryptedAccessControlSecretByDelegate = await baseExchangeData.tryDecryptAccessControlSecret([createdData.exchangeData], {
        [delegateKeyFp]: delegateKeypair,
      })
      await checkAesKeysEquality(decryptedKeyByDelegate.successfulDecryptions[0], createdData.exchangeKey)
      expect(decryptedAccessControlSecretByDelegate.successfulDecryptions[0]).to.equal(createdData.accessControlSecret)
      expect(retrievedCachedData.exchangeData.delegator).to.equal(selfId)
      expect(retrievedCachedData.exchangeData.delegate).to.equal(delegateId)
      expect(Object.keys(retrievedCachedData.exchangeData.signature)).to.have.length(1)
      expect(Object.keys(retrievedCachedData.exchangeData.exchangeKey)).to.have.length(2)
      expect(Object.keys(retrievedCachedData.exchangeData.accessControlSecret)).to.have.length(2)
    }
    await doTest(true)
    await doTest(false)
  })

  it('should create encryption keys to self when none is available', async function () {
    async function doTest(allowFullExchangeDataLoad: boolean) {
      await initialiseComponents(allowFullExchangeDataLoad)
      const createdData = await exchangeData.getOrCreateEncryptionDataTo(selfId, 'Contact', [primitives.randomUuid()])
      expect(createdData.exchangeData.delegator).to.equal(selfId)
      expect(createdData.exchangeData.delegate).to.equal(selfId)
      expect(Object.keys(createdData.exchangeData.signature)).to.have.length(1)
      expect(Object.keys(createdData.exchangeData.exchangeKey)).to.have.length(1)
      expect(Object.keys(createdData.exchangeData.accessControlSecret)).to.have.length(1)
    }
    await doTest(true)
    await doTest(false)
  })

  it('should ignore unverified keys when creating new exchange data', async function () {
    async function doTest(allowFullExchangeDataLoad: boolean) {
      const delegateVerifiedKeys = await generateEncryptionKeys(5)
      const extraDelegateUnverifiedKeys = await generateEncryptionKeys(5)
      const extraDelegatorVerifiedKeys = await generateEncryptionKeys(5)
      const delegatorUnverifiedKeys = await generateEncryptionKeys(5)
      await initialiseComponents(allowFullExchangeDataLoad, { verifiedDelegateKeys: new Set(delegateVerifiedKeys.map((x) => x.hexPub)) })
      for (const keyData of [...delegateVerifiedKeys, ...extraDelegateUnverifiedKeys]) {
        await dataOwnerApi.addPublicKeyForOwner(delegateId, keyData.pair)
      }
      for (const keyData of extraDelegatorVerifiedKeys) {
        await dataOwnerApi.addPublicKeyForOwner(selfId, keyData.pair)
        await encryptionKeysManager.addOrUpdateKey(primitives, keyData.pair, true)
      }
      for (const keyData of delegatorUnverifiedKeys) {
        await dataOwnerApi.addPublicKeyForOwner(selfId, keyData.pair)
        await encryptionKeysManager.addOrUpdateKey(primitives, keyData.pair, false)
      }
      const created = await exchangeData.getOrCreateEncryptionDataTo(delegateId, 'Contact', [primitives.randomUuid()])
      expect(
        setEquals(new Set(Object.keys(created.exchangeData.exchangeKey)), new Set(Object.keys(created.exchangeData.accessControlSecret))),
        'Keys used for encryption of exchange key and access control secret must be the same.'
      ).to.be.true
      expect(
        setEquals(
          new Set(Object.keys(created.exchangeData.exchangeKey)),
          new Set([...delegateVerifiedKeys.map((x) => x.fingerprintV2), ...extraDelegatorVerifiedKeys.map((x) => x.fingerprintV2), selfKeyFpV2])
        ),
        'Only verified keys of delegate and delegator should be used for encryption of exchange key and access control secret.'
      ).to.be.true
      for (const keyData of [{ pair: selfKeypair, fingerprintV2: selfKeyFpV1 }, ...extraDelegatorVerifiedKeys, ...delegateVerifiedKeys]) {
        await checkAesKeysEquality(
          (
            await baseExchangeData.tryDecryptExchangeKeys([created.exchangeData], { [keyData.fingerprintV2]: keyData.pair })
          ).successfulDecryptions[0],
          created.exchangeKey
        )
        expect(
          (await baseExchangeData.tryDecryptAccessControlSecret([created.exchangeData], { [keyData.fingerprintV2]: keyData.pair }))
            .successfulDecryptions[0]
        ).to.equal(created.accessControlSecret)
      }
    }
    await doTest(true)
    await doTest(false)
  })

  it('should reuse existing exchange data for encryption when it can be verified', async function () {
    async function doTest(allowFullExchangeDataLoad: boolean) {
      await initialiseComponents(allowFullExchangeDataLoad)
      const createdData = await exchangeData.getOrCreateEncryptionDataTo(delegateId, 'Patient', [])
      await exchangeData.clearOrRepopulateCache()
      const countAfterCacheClear = exchangeDataApi.callCount
      const reloadedData = await exchangeData.getOrCreateEncryptionDataTo(delegateId, 'Patient', [])
      exchangeDataApi.compareCallCountFromBaseline(countAfterCacheClear, {
        createExchangeData: 0,
        getExchangeDataByDelegatorDelegate: allowFullExchangeDataLoad ? 0 : 1,
        modifyExchangeData: 0,
        getExchangeDataById: 0,
        getExchangeDataByParticipant: 0,
      })
      await checkDataEqual(reloadedData, createdData)
    }
    await doTest(true)
    await doTest(false)
  })

  it('should create new exchange data for encryption when the existing data can not be verified due to unavailable verification key', async function () {
    async function doTest(allowFullExchangeDataLoad: boolean) {
      await initialiseComponents(allowFullExchangeDataLoad)
      const sfk = primitives.randomUuid()
      const createdData = await exchangeData.getOrCreateEncryptionDataTo(delegateId, 'Contact', [sfk])
      signatureKeysManager.clearKeys()
      await exchangeData.clearOrRepopulateCache()
      const countAfterCacheClear = exchangeDataApi.callCount
      const newData = await exchangeData.getOrCreateEncryptionDataTo(delegateId, 'Contact', [sfk])
      exchangeDataApi.compareCallCountFromBaseline(countAfterCacheClear, {
        createExchangeData: 1,
        getExchangeDataByDelegatorDelegate: allowFullExchangeDataLoad ? 0 : 1,
        modifyExchangeData: 0,
        getExchangeDataById: 0,
        getExchangeDataByParticipant: 0,
      })
      expect(_.isEqual(_.omit(createdData.exchangeData, ['rev']), _.omit(newData.exchangeData, ['rev']))).to.equal(
        false,
        'Exchange data manager should have created new exchange data for encryption'
      )
      expect(ua2hex(await primitives.AES.exportKey(createdData.exchangeKey, 'raw'))).to.not.equal(
        ua2hex(await primitives.AES.exportKey(newData.exchangeKey, 'raw'))
      )
      expect(createdData.accessControlSecret).to.not.equal(newData.accessControlSecret)
    }
    await doTest(true)
    await doTest(false)
  })

  it('should create new exchange data for encryption when the existing data can not be verified due to tampering of the data', async function () {
    // Test tampering by adding new key or changing value corresponding to a key in encryption data, access control data or both.
    async function doTest(
      allowFullExchangeDataLoad: boolean,
      tamper: (exchangeData: ExchangeData, selfKeyPair: KeyPair<CryptoKey>, selfKeyFp: string) => Promise<ExchangeData>
    ) {
      await initialiseComponents(allowFullExchangeDataLoad)
      const sfk = primitives.randomUuid()
      const createdData = await exchangeData.getOrCreateEncryptionDataTo(delegateId, 'Contact', [sfk])
      // Tamper with exchange data
      await exchangeDataApi.modifyExchangeData(await tamper(createdData.exchangeData, selfKeypair, selfKeyFpV1))
      await exchangeData.clearOrRepopulateCache()
      const countAfterCacheClear = exchangeDataApi.callCount
      const newData = await exchangeData.getOrCreateEncryptionDataTo(delegateId, 'Contact', [sfk])
      exchangeDataApi.compareCallCountFromBaseline(countAfterCacheClear, {
        createExchangeData: 1,
        getExchangeDataByDelegatorDelegate: allowFullExchangeDataLoad ? 0 : 1,
        modifyExchangeData: 0,
        getExchangeDataById: 0,
        getExchangeDataByParticipant: 0,
      })
      expect(_.isEqual(_.omit(createdData.exchangeData, ['rev']), _.omit(newData.exchangeData, ['rev']))).to.equal(
        false,
        'Exchange data manager should have created new exchange data for encryption'
      )
      expect(ua2hex(await primitives.AES.exportKey(createdData.exchangeKey, 'raw'))).to.not.equal(
        ua2hex(await primitives.AES.exportKey(newData.exchangeKey, 'raw'))
      )
      expect(createdData.accessControlSecret).to.not.equal(newData.accessControlSecret)
    }
    const extraKeyPair = await primitives.RSA.generateKeyPair('sha-256')
    const extraKeyPairFp = ua2hex(await primitives.RSA.exportKey(extraKeyPair.publicKey, 'spki')).slice(-32)
    const fakeKey = primitives.randomBytes(16)
    const tamperByAddingEncryptionKey = async (exchangeData: ExchangeData) =>
      new ExchangeData({
        ...exchangeData,
        exchangeKey: {
          ...exchangeData.exchangeKey,
          [extraKeyPairFp]: ua2b64(await primitives.RSA.encrypt(extraKeyPair.publicKey, fakeKey)),
        },
      })
    const tamperByChangingEncryptionKey = async (exchangeData: ExchangeData, selfKeyPair: KeyPair<CryptoKey>, selfKeyFp: string) =>
      new ExchangeData({
        ...exchangeData,
        exchangeKey: {
          ...exchangeData.exchangeKey,
          [selfKeyFp]: ua2b64(await primitives.RSA.encrypt(selfKeyPair.publicKey, fakeKey)),
        },
      })
    const tamperByAddingAccessControlSecret = async (exchangeData: ExchangeData) =>
      new ExchangeData({
        ...exchangeData,
        accessControlSecret: {
          ...exchangeData.accessControlSecret,
          [extraKeyPairFp]: ua2b64(await primitives.RSA.encrypt(extraKeyPair.publicKey, fakeKey)),
        },
      })
    const tamperByChangingAccessControlSecret = async (exchangeData: ExchangeData, selfKeyPair: KeyPair<CryptoKey>, selfKeyFp: string) =>
      new ExchangeData({
        ...exchangeData,
        accessControlSecret: {
          ...exchangeData.accessControlSecret,
          [selfKeyFp]: ua2b64(await primitives.RSA.encrypt(selfKeyPair.publicKey, fakeKey)),
        },
      })
    await doTest(true, tamperByAddingEncryptionKey)
    await doTest(false, tamperByAddingEncryptionKey)
    await doTest(true, tamperByChangingEncryptionKey)
    await doTest(false, tamperByChangingEncryptionKey)
    await doTest(true, tamperByAddingAccessControlSecret)
    await doTest(false, tamperByAddingAccessControlSecret)
    await doTest(true, tamperByChangingAccessControlSecret)
    await doTest(false, tamperByChangingAccessControlSecret)
  })

  it('should return existing exchange data keys for decryption even if the data authenticity could not be verified', async function () {
    async function doTest(allowFullExchangeDataLoad: boolean) {
      await initialiseComponents(allowFullExchangeDataLoad)
      const sfk = primitives.randomUuid()
      const createdData1 = await exchangeData.getOrCreateEncryptionDataTo(delegateId, 'Contact', [sfk])
      const createdData2 = await createDataFromRandomToSelf()
      signatureKeysManager.clearKeys()
      await exchangeData.clearOrRepopulateCache()
      await checkDataEqual(
        await exchangeData.getDecryptionDataKeyById(createdData1.exchangeData.id!, 'Contact', [sfk], true),
        _.omit(createdData1, 'accessControlSecret')
      )
      await checkDataEqual(
        await exchangeData.getDecryptionDataKeyById(createdData2.exchangeData.id!, 'Contact', [sfk], true),
        _.omit(createdData2, 'accessControlSecret')
      )
    }
    await doTest(true)
    await doTest(false)
  })

  it('newly created data or data retrieved by id should be cached and retrievable by hash for the provided sfks and entity type', async function () {
    async function doTest(allowFullExchangeDataLoad: boolean) {
      await initialiseComponents(allowFullExchangeDataLoad)
      const sfk1 = primitives.randomUuid()
      const sfk2 = primitives.randomUuid()
      const createdData1 = await exchangeData.getOrCreateEncryptionDataTo(delegateId, 'Patient', [])
      const hashes1 = [await accessControlSecretUtils.secureDelegationKeyFor(createdData1.accessControlSecret, 'Patient', undefined)]
      const createdData2 = await createDataFromRandomToSelf()
      const hashes2 = await accessControlSecretUtils.secureDelegationKeysFor(createdData2.accessControlSecret, 'HealthElement', [sfk1, sfk2])
      await checkDataEqual(
        await exchangeData.getDecryptionDataKeyById(createdData2.exchangeData.id!, 'HealthElement', [sfk1, sfk2], true),
        _.omit(createdData2, 'accessControlSecret')
      )
      const retrievedKeys = await exchangeData.getCachedDecryptionDataKeyByAccessControlHash([...hashes1, ...hashes2], 'Message', []) // Entity type and entity sfk should be irrelevant in this case
      expect(Object.keys(retrievedKeys)).to.have.length(hashes1.length + hashes2.length)
      for (const hash of hashes1) {
        await checkDataEqual(retrievedKeys[hash], _.omit(createdData1, 'accessControlSecret'))
      }
      for (const hash of hashes2) {
        await checkDataEqual(retrievedKeys[hash], _.omit(createdData2, 'accessControlSecret'))
      }
      const unknownAccessControlSecret = primitives.randomUuid()
      const unknownHashes = [
        await accessControlSecretUtils.secureDelegationKeyFor(unknownAccessControlSecret, 'Patient', undefined),
        await accessControlSecretUtils.secureDelegationKeyFor(unknownAccessControlSecret, 'HealthElement', sfk1),
        await accessControlSecretUtils.secureDelegationKeyFor(unknownAccessControlSecret, 'HealthElement', sfk2),
      ]
      expect(Object.keys(await exchangeData.getCachedDecryptionDataKeyByAccessControlHash(unknownHashes, 'Patient', []))).to.have.length(0)
      const uncachedHash = await accessControlSecretUtils.secureDelegationKeyFor(createdData1.accessControlSecret, 'Document', sfk1)
      const retrievedByUncachedHash = await exchangeData.getCachedDecryptionDataKeyByAccessControlHash([uncachedHash], 'Document', [sfk1])
      expect(Object.keys(retrievedByUncachedHash)).to.have.length(allowFullExchangeDataLoad ? 1 : 0)
    }
    await doTest(true)
    await doTest(false)
  })

  it('if data can not be decrypted the retrieval method should return undefined', async function () {
    async function doTest(allowFullExchangeDataLoad: boolean) {
      await initialiseComponents(allowFullExchangeDataLoad)
      const createdBySelf = await exchangeData.getOrCreateEncryptionDataTo(selfId, 'Patient', [])
      const createdByOther = await createDataFromRandomToSelf()
      const newKey = await primitives.RSA.generateKeyPair('sha-256')
      await dataOwnerApi.addPublicKeyForOwner(selfId, newKey)
      // Simulate loss of key
      encryptionKeysManager.deleteKey(selfKeyFpV1)
      await encryptionKeysManager.addOrUpdateKey(primitives, newKey, true)
      await exchangeData.clearOrRepopulateCache()
      await checkDataEqual(await exchangeData.getDecryptionDataKeyById(createdBySelf.exchangeData.id!, 'Patient', [], true), {
        exchangeData: createdBySelf.exchangeData,
        exchangeKey: undefined,
      })
      await checkDataEqual(await exchangeData.getDecryptionDataKeyById(createdByOther.exchangeData.id!, 'Patient', [], true), {
        exchangeData: createdByOther.exchangeData,
        exchangeKey: undefined,
      })
    }
    await doTest(true)
    await doTest(false)
  })

  it('unverified keys should still be usable for decryption of data', async function () {
    async function doTest(allowFullExchangeDataLoad: boolean) {
      await initialiseComponents(allowFullExchangeDataLoad)
      const createdBySelf = await exchangeData.getOrCreateEncryptionDataTo(selfId, 'Patient', [])
      const createdByOther = await createDataFromRandomToSelf()
      await encryptionKeysManager.addOrUpdateKey(primitives, selfKeypair, false)
      await exchangeData.clearOrRepopulateCache()
      await checkDataEqual(
        await exchangeData.getDecryptionDataKeyById(createdBySelf.exchangeData.id!, 'Patient', [], true),
        _.omit(createdBySelf, 'accessControlSecret')
      )
      await checkDataEqual(
        await exchangeData.getDecryptionDataKeyById(createdByOther.exchangeData.id!, 'Patient', [], true),
        _.omit(createdByOther, 'accessControlSecret')
      )
    }
    await doTest(true)
    await doTest(false)
  })

  it('implementation with limited cache should trigger eviction of delegate and hash cache on eviction of data by id cache', async function () {
    await initialiseComponents(false, { lruCacheSize: 3 })
    const entityType = 'Contact'
    const sfks = [primitives.randomUuid(), primitives.randomUuid(), primitives.randomUuid()]

    async function verifyCached(data: { exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }) {
      const apiCallsBaseline = exchangeDataApi.callCount
      const hashes = await accessControlSecretUtils.secureDelegationKeysFor(data.accessControlSecret, entityType, sfks)
      for (const hash of hashes) {
        await checkDataEqual(
          (
            await exchangeData.getCachedDecryptionDataKeyByAccessControlHash([hash], entityType, sfks)
          )[hash],
          _.omit(data, 'accessControlSecret')
        )
      }
      if (data.exchangeData.delegator === selfId) {
        await checkDataEqual(await exchangeData.getOrCreateEncryptionDataTo(data.exchangeData.delegate, entityType, sfks), data)
      }
      await checkDataEqual(
        await exchangeData.getDecryptionDataKeyById(data.exchangeData.id!, entityType, sfks, true),
        _.omit(data, 'accessControlSecret')
      )
      exchangeDataApi.compareCallCountFromBaseline(apiCallsBaseline, {
        getExchangeDataById: 0,
        createExchangeData: 0,
        modifyExchangeData: 0,
        getExchangeDataByParticipant: 0,
        getExchangeDataByDelegatorDelegate: 0,
      })
    }

    async function verifyNotCachedThenCache(data: { exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }) {
      const apiCallsBaseline = exchangeDataApi.callCount
      const hashes = await accessControlSecretUtils.secureDelegationKeysFor(data.accessControlSecret, entityType, sfks)
      for (const hash of hashes) {
        expect(Object.keys(await exchangeData.getCachedDecryptionDataKeyByAccessControlHash([hash], entityType, sfks))).to.have.length(0)
      }
      if (data.exchangeData.delegator === selfId) {
        await checkDataEqual(await exchangeData.getOrCreateEncryptionDataTo(data.exchangeData.delegate, entityType, sfks), data)
        exchangeDataApi.compareCallCountFromBaseline(apiCallsBaseline, {
          getExchangeDataById: 0,
          createExchangeData: 0,
          modifyExchangeData: 0,
          getExchangeDataByParticipant: 0,
          getExchangeDataByDelegatorDelegate: 1,
        })
      } else {
        await checkDataEqual(
          await exchangeData.getDecryptionDataKeyById(data.exchangeData.id!, entityType, sfks, true),
          _.omit(data, 'accessControlSecret')
        )
        exchangeDataApi.compareCallCountFromBaseline(apiCallsBaseline, {
          getExchangeDataById: 1,
          createExchangeData: 0,
          modifyExchangeData: 0,
          getExchangeDataByParticipant: 0,
          getExchangeDataByDelegatorDelegate: 0,
        })
      }
    }

    const createdBySelf1 = await exchangeData.getOrCreateEncryptionDataTo(selfId, entityType, sfks)
    const createdBySelf2 = await exchangeData.getOrCreateEncryptionDataTo(delegateId, entityType, sfks)
    const createdByOther1 = await createDataFromRandomToSelf() // Not automatically cached: created by someone else
    const createdByOther2 = await createDataFromRandomToSelf() // Not automatically cached: created by someone else
    // noinspection DuplicatedCode
    await verifyCached(createdBySelf1)
    await verifyCached(createdBySelf2)
    await verifyNotCachedThenCache(createdByOther1)
    await verifyCached(createdBySelf1)
    await verifyCached(createdBySelf2)
    await verifyCached(createdByOther1)
    await verifyNotCachedThenCache(createdByOther2)
    await verifyCached(createdBySelf2)
    await verifyCached(createdByOther1)
    await verifyCached(createdByOther2)
    await verifyNotCachedThenCache(createdBySelf1)
    await verifyCached(createdByOther1)
    await verifyCached(createdByOther2)
    await verifyCached(createdBySelf1)
    await verifyNotCachedThenCache(createdBySelf2)
    await verifyCached(createdByOther2)
    // noinspection DuplicatedCode
    await verifyCached(createdBySelf1)
    await verifyCached(createdBySelf2)
    await verifyNotCachedThenCache(createdByOther1)
    await verifyCached(createdBySelf1)
    await verifyCached(createdBySelf2)
    await verifyCached(createdByOther1)
    await verifyNotCachedThenCache(createdByOther2)
    await verifyCached(createdBySelf2)
    await verifyCached(createdByOther1)
    await verifyCached(createdByOther2)
  })

  it('implementation with unlimited cache should preload all existing exchange data on creation', async function () {
    await initialiseComponents(true)
    const createdBySelf = await exchangeData.getOrCreateEncryptionDataTo(selfId, 'Patient', [])
    const createdByOther = await createDataFromRandomToSelf()
    const recreatedExchangeData = await initialiseExchangeDataManagerForCurrentDataOwner(
      baseExchangeData,
      encryptionKeysManager,
      signatureKeysManager,
      accessControlSecretUtils,
      new TestCryptoStrategies(),
      dataOwnerApi,
      primitives
    )
    const apiCallsAfterCreation = exchangeDataApi.callCount
    await checkDataEqual(
      await recreatedExchangeData.getDecryptionDataKeyById(createdBySelf.exchangeData.id!, 'Patient', [], false),
      _.omit(createdBySelf, 'accessControlSecret')
    )
    await checkDataEqual(
      await recreatedExchangeData.getDecryptionDataKeyById(createdByOther.exchangeData.id!, 'Patient', [], false),
      _.omit(createdByOther, 'accessControlSecret')
    )
    exchangeDataApi.compareCallCountFromBaseline(apiCallsAfterCreation, {
      getExchangeDataById: 0,
      createExchangeData: 0,
      modifyExchangeData: 0,
      getExchangeDataByParticipant: 0,
      getExchangeDataByDelegatorDelegate: 0,
    })
  })
})
