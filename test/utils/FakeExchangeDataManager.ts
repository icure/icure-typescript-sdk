import { ExchangeDataManager } from '../../icc-x-api/crypto/ExchangeDataManager'
import { EntityWithDelegationTypeName } from '../../icc-x-api/utils/EntityWithDelegationTypeName'
import { ExchangeData } from '../../icc-api/model/internal/ExchangeData'
import { expect } from 'chai'
import { BaseExchangeDataManager } from '../../icc-x-api/crypto/BaseExchangeDataManager'
import { CryptoPrimitives } from '../../icc-x-api'

export class FakeDecryptionExchangeDataManager implements ExchangeDataManager {
  constructor(
    private readonly expectedEntityType: EntityWithDelegationTypeName,
    private readonly expectedSecretForeignKeys: string[],
    private readonly cryptoPrimitives: CryptoPrimitives
  ) {}

  private readonly dataByHash: { [hash: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey; accessControlSecret: string } } = {}
  private readonly dataById: {
    [id: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey | undefined; accessControlSecret: string | undefined; fakeNonCached: boolean }
  } = {}

  clearOrRepopulateCache(): Promise<void> {
    throw new Error('This method is not supported by fake exchange data manager and should not be used.')
  }

  getAccessControlKeysValue(entityType: EntityWithDelegationTypeName): Promise<string | undefined> {
    throw new Error('This method is not supported by fake exchange data manager and should not be used.')
  }

  async getCachedDecryptionDataKeyByAccessControlHash(
    hashes: string[],
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[]
  ): Promise<{ [p: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey; accessControlSecret: string } }> {
    expect(entityType).to.equal(this.expectedEntityType)
    expect(entitySecretForeignKeys).to.equal(this.expectedSecretForeignKeys)
    const res: { [p: string]: { exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey } } = {}
    for (const hash of hashes) {
      const retrieved = this.dataByHash[hash]
      if (retrieved) res[hash] = retrieved
    }
    return res
  }

  async getDecryptionDataKeyById(
    id: string,
    entityType: EntityWithDelegationTypeName | undefined,
    entitySecretForeignKeys: string[] | undefined,
    retrieveIfNotCached: boolean
  ): Promise<{ exchangeKey: CryptoKey | undefined; exchangeData: ExchangeData; accessControlSecret: string | undefined } | undefined> {
    expect(entityType).to.equal(this.expectedEntityType)
    expect(entitySecretForeignKeys).to.equal(this.expectedSecretForeignKeys)
    const retrieved = this.dataById[id]
    if (retrieved) {
      if (retrieveIfNotCached || !retrieved.fakeNonCached) {
        return retrieved
      } else return undefined
    } else if (!retrieveIfNotCached) {
      return undefined
    } else throw new Error('Exchange data does not exist.')
  }

  getOrCreateEncryptionDataTo(
    delegateId: string,
    entityType: EntityWithDelegationTypeName | undefined,
    entitySecretForeignKeys: string[] | undefined
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }> {
    throw new Error('This method should not be used with this fake exchange data manager: only retrieval decryption data is supported')
  }

  cacheFakeData(
    exchangeData: ExchangeData,
    keyAndHashesFromSecret:
      | {
          exchangeKey: CryptoKey
          accessControlSecret?: string
          hashes: string[]
        }
      | undefined,
    fakeNonCached?: boolean
  ) {
    const acSecret = !!keyAndHashesFromSecret ? keyAndHashesFromSecret.accessControlSecret ?? this.cryptoPrimitives.randomUuid() : undefined
    this.dataById[exchangeData.id!] = {
      exchangeData,
      exchangeKey: keyAndHashesFromSecret?.exchangeKey,
      fakeNonCached: fakeNonCached ?? false,
      accessControlSecret: acSecret,
    }
    if (keyAndHashesFromSecret) {
      for (const hash of keyAndHashesFromSecret.hashes) {
        this.dataByHash[hash] = { exchangeData, exchangeKey: keyAndHashesFromSecret.exchangeKey, accessControlSecret: acSecret! }
      }
    }
  }

  giveAccessBackTo(otherDataOwner: string, newDataOwnerPublicKey: string): Promise<void> {
    throw new Error('This method should not be used with this fake exchange data manager: only retrieval decryption data is supported')
  }

  getAllDelegationKeys(entityType: EntityWithDelegationTypeName): Promise<string[] | undefined> {
    throw new Error('This method should not be used with this fake exchange data manager: only retrieval decryption data is supported')
  }

  get base(): BaseExchangeDataManager {
    throw new Error('This method should not be used with this fake exchange data manager: only retrieval decryption data is supported')
  }
}
