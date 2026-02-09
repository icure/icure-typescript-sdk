import { createHcpHierarchyApis, getEnvironmentInitializer, setLocalStorage, TestUtils } from '../utils/test_utils'
import { CryptoPrimitives, CryptoStrategies, hex2ua, IcureApi, KeyPair, ShaVersion, ua2ab, ua2hex } from '../../icc-x-api'
import { expect, use as chaiUse } from 'chai'
import 'isomorphic-fetch'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import * as chaiAsPromised from 'chai-as-promised'
import { fingerprintV1, fingerprintV2 } from '../../icc-x-api/crypto/utils'
import { KeyPairRecoverer } from '../../icc-x-api/crypto/KeyPairRecoverer'
import { CryptoActorStubWithType } from '../../icc-api/model/CryptoActorStub'
import { DataOwnerWithType } from '../../icc-api/model/DataOwnerWithType'
import { DataOwnerTypeEnum } from '../../icc-api/model/DataOwnerTypeEnum'
import { webcrypto } from 'crypto'
import { TestKeyStorage, TestStorage } from '../utils/TestStorage'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import initMasterApi = TestUtils.initMasterApi

setLocalStorage(fetch)

chaiUse(chaiAsPromised)

let env: TestVars

const untrustedKeyPropId = 'untrustedKey'

class TrustedKeysStrategy implements CryptoStrategies {
  constructor(
    private readonly parentKeys: { pub: string; priv: string; trusted: boolean; shaVersion: ShaVersion }[],
    private readonly selfKeys: { pub: string; priv: string; trusted: boolean; shaVersion: ShaVersion }[],
    private readonly options: {
      failRecoverAndVerifySelfHierarchyKeys?: boolean
      overrideGenerateNewKeyForDataOwner?: () => Promise<KeyPair<CryptoKey> | boolean | 'keyless'>
    } = {}
  ) {}

  dataOwnerRequiresAnonymousDelegation(dataOwner: CryptoActorStubWithType): boolean {
    return dataOwner.type != DataOwnerTypeEnum.Hcp
  }

  async recoverAndVerifySelfHierarchyKeys(
    keysData: {
      dataOwner: DataOwnerWithType
      unknownKeys: string[]
      unavailableKeys: string[]
    }[],
    cryptoPrimitives: CryptoPrimitives,
    keyPairRecoverer: KeyPairRecoverer
  ): Promise<{
    [p: string]: { recoveredKeys: { [p: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [p: string]: boolean } }
  }> {
    if (this.options.failRecoverAndVerifySelfHierarchyKeys) {
      throw new Error("Shouldn't call this method now")
    }
    expect(keysData).to.have.length(2)
    const parentKeysWithFp = await Promise.all(
      this.parentKeys.map(async (k) => ({
        trusted: k.trusted,
        fp: fingerprintV1(k.pub),
        keypair: await cryptoPrimitives.RSA.importKeyPair('pkcs8', ua2ab(hex2ua(k.priv)), 'spki', ua2ab(hex2ua(k.pub)), k.shaVersion),
      }))
    )
    const selfKeysWithFp = await Promise.all(
      this.selfKeys.map(async (k) => ({
        trusted: k.trusted,
        fp: fingerprintV1(k.pub),
        keypair: await cryptoPrimitives.RSA.importKeyPair('pkcs8', ua2ab(hex2ua(k.priv)), 'spki', ua2ab(hex2ua(k.pub)), k.shaVersion),
      }))
    )
    return {
      [keysData[0].dataOwner.dataOwner.id!]: {
        recoveredKeys: Object.fromEntries(parentKeysWithFp.map((k) => [k.fp, k.keypair])),
        keyAuthenticity: Object.fromEntries(parentKeysWithFp.map((k) => [k.fp, k.trusted])),
      },
      [keysData[1].dataOwner.dataOwner.id!]: {
        recoveredKeys: Object.fromEntries(selfKeysWithFp.map((k) => [k.fp, k.keypair])),
        keyAuthenticity: Object.fromEntries(selfKeysWithFp.map((k) => [k.fp, k.trusted])),
      },
    }
  }

  verifyDelegatePublicKeys(delegate: CryptoActorStubWithType, publicKeys: string[], cryptoPrimitives: CryptoPrimitives): Promise<string[]> {
    const untrusted = new Set(
      delegate.stub.cryptoActorProperties?.flatMap((p) => {
        if (p.id == untrustedKeyPropId && p.typedValue?.stringValue != undefined) {
          return [p.typedValue.stringValue]
        } else {
          return []
        }
      })
    )
    return Promise.resolve(publicKeys.filter((k) => !untrusted.has(fingerprintV2(k))))
  }

  generateNewKeyForDataOwner(self: DataOwnerWithType, cryptoPrimitives: CryptoPrimitives): Promise<KeyPair<CryptoKey> | boolean | 'keyless'> {
    if (this.options.overrideGenerateNewKeyForDataOwner) {
      return this.options.overrideGenerateNewKeyForDataOwner()
    }
    return Promise.reject(new Error('Should not be called now'))
  }
}

describe('CSM-729', async function () {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('User with untrusted key', async function () {
    const { grandCredentials: parent, parentCredentials: hcp } = await createHcpHierarchyApis(env)
    // Create some data to use the original keys
    const initialApi = await IcureApi.initialise(
      env.iCureUrl,
      { username: hcp.user, password: hcp.password },
      new TrustedKeysStrategy(
        [{ priv: parent.privateKey, pub: parent.publicKey, trusted: true, shaVersion: ShaVersion.Sha1 }],
        [{ priv: hcp.privateKey, pub: hcp.publicKey, trusted: true, shaVersion: ShaVersion.Sha1 }]
      ),
      webcrypto as any,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    )
    const user = await initialApi.userApi.getCurrentUser()
    const pat1 = await initialApi.patientApi.createPatientWithUser(
      user,
      await initialApi.patientApi.newInstance(
        user,
        {
          firstName: 'John',
          lastName: 'Doe',
          note: 'Secret note',
        },
        {
          additionalDelegates: { [parent.dataOwnerId]: AccessLevelEnum.WRITE },
        }
      )
    )
    // Check exchange data was created as expected
    const selfSelfXdata = await initialApi.cryptoApi.exchangeData.base.getExchangeDataByDelegatorDelegatePair(hcp.dataOwnerId, hcp.dataOwnerId)
    const selfParentXdata = await initialApi.cryptoApi.exchangeData.base.getExchangeDataByDelegatorDelegatePair(hcp.dataOwnerId, parent.dataOwnerId)
    expect(selfSelfXdata).to.not.be.undefined
    expect(selfParentXdata).to.not.be.undefined
    expect(selfSelfXdata).to.have.length(1)
    expect(selfParentXdata).to.have.length(1)
    // Prepare for new api with untrusted key
    //// Mark self hcp keys as untrusted
    let selfHcp = await initialApi.healthcarePartyApi.getCurrentHealthcareParty()
    selfHcp = await initialApi.healthcarePartyApi.modifyHealthcareParty({
      ...selfHcp,
      cryptoActorProperties: [
        ...(selfHcp.cryptoActorProperties || []),
        {
          id: untrustedKeyPropId,
          typedValue: { stringValue: fingerprintV2(hcp.publicKey) },
        },
      ],
    })
    //// Mark parent hcp keys as untrusted and add new key (currently can't be done through crypto strategies)
    const newParentKey = await initialApi.cryptoApi.primitives.RSA.generateKeyPair(ShaVersion.Sha256)
    const newParentKeySpki = ua2hex(await initialApi.cryptoApi.primitives.RSA.exportKey(newParentKey.publicKey, 'spki'))
    const newParentKeyPkcs8 = ua2hex(await initialApi.cryptoApi.primitives.RSA.exportKey(newParentKey.privateKey, 'pkcs8'))
    const adminApi = await initMasterApi(env)
    let parentHcp = await adminApi.healthcarePartyApi.getHealthcareParty(parent.dataOwnerId)
    parentHcp = await adminApi.healthcarePartyApi.modifyHealthcareParty({
      // Hcp normally doesn't have right to modify parent, depends on permissions
      ...parentHcp,
      cryptoActorProperties: [
        ...(parentHcp.cryptoActorProperties || []),
        {
          id: untrustedKeyPropId,
          typedValue: { stringValue: fingerprintV2(parent.publicKey) },
        },
      ],
      publicKeysForOaepWithSha256: [...(parentHcp.publicKeysForOaepWithSha256 || []), newParentKeySpki],
    })
    //// No need to invalidate exchange data, as untrusted keys are not used to validate it
    // Setup new api
    let didCreateNewKey = false
    const newHcpKey = await initialApi.cryptoApi.primitives.RSA.generateKeyPair(ShaVersion.Sha256)
    const newHcpKeySpki = ua2hex(await initialApi.cryptoApi.primitives.RSA.exportKey(newHcpKey.publicKey, 'spki'))
    const newHcpKeyPkcs8 = ua2hex(await initialApi.cryptoApi.primitives.RSA.exportKey(newHcpKey.privateKey, 'pkcs8'))
    const apiWithUntrustedKeysStorages = {
      // Using a new storage, simulates wiping the local storage
      storage: new TestStorage(),
      keyStorage: new TestKeyStorage(),
    }
    const apiWithUntrustedKey = await IcureApi.initialise(
      env.iCureUrl,
      { username: hcp.user, password: hcp.password },
      new TrustedKeysStrategy(
        [
          { priv: parent.privateKey, pub: parent.publicKey, trusted: false, shaVersion: ShaVersion.Sha1 },
          { priv: newParentKeyPkcs8, pub: newParentKeySpki, trusted: true, shaVersion: ShaVersion.Sha256 },
        ],
        [{ priv: hcp.privateKey, pub: hcp.publicKey, trusted: false, shaVersion: ShaVersion.Sha1 }],
        {
          overrideGenerateNewKeyForDataOwner: () => {
            didCreateNewKey = true
            return Promise.resolve(newHcpKey)
          },
        }
      ),
      webcrypto as any,
      fetch,
      apiWithUntrustedKeysStorages
    )
    expect(didCreateNewKey).to.eq(true)
    // Check all keys are available but only new keys are trusted
    expect(
      await apiWithUntrustedKey.cryptoApi.userKeysManager.getVerifiedPublicKeysFor(
        await apiWithUntrustedKey.healthcarePartyApi.getHealthcareParty(hcp.dataOwnerId)
      )
    ).to.have.members([newHcpKeySpki])
    expect(
      await apiWithUntrustedKey.cryptoApi.userKeysManager.getVerifiedPublicKeysFor(
        await apiWithUntrustedKey.healthcarePartyApi.getHealthcareParty(parent.dataOwnerId)
      )
    ).to.have.members([newParentKeySpki])
    expect(await apiWithUntrustedKey.cryptoApi.userKeysManager.getCurrentUserHierarchyAvailablePublicKeysHex()).to.have.members([
      newHcpKeySpki,
      hcp.publicKey,
      parent.publicKey,
      newParentKeySpki,
    ])
    expect(await apiWithUntrustedKey.cryptoApi.userKeysManager.getCurrentUserAvailablePublicKeysHex(false)).to.have.members([
      newHcpKeySpki,
      hcp.publicKey,
    ])
    // Check can still read old data
    const pat1Recovered = await apiWithUntrustedKey.patientApi.getPatientWithUser(user, pat1.id!)
    expect(pat1Recovered.note).to.eq('Secret note')
    // Check can create new data
    const pat2 = await initialApi.patientApi.createPatientWithUser(
      user,
      await initialApi.patientApi.newInstance(
        user,
        {
          firstName: 'Joe',
          lastName: 'Doe',
          note: 'Secret note',
        },
        {
          additionalDelegates: { [parent.dataOwnerId]: AccessLevelEnum.WRITE },
        }
      )
    )
    // Check created new exchange data and only used the new trusted keys for it
    const selfSelfXdata2 = await initialApi.cryptoApi.exchangeData.base.getExchangeDataByDelegatorDelegatePair(hcp.dataOwnerId, hcp.dataOwnerId)
    const selfParentXdata2 = await initialApi.cryptoApi.exchangeData.base.getExchangeDataByDelegatorDelegatePair(hcp.dataOwnerId, parent.dataOwnerId)
    expect(selfSelfXdata2).to.not.be.undefined
    expect(selfParentXdata2).to.not.be.undefined
    expect(selfSelfXdata2).to.have.length(2)
    expect(selfParentXdata2).to.have.length(2)
    const newSelfSelfXdata = selfSelfXdata2.filter((xd) => xd.id !== selfSelfXdata[0].id)!
    expect(newSelfSelfXdata).to.have.length(1)
    const newSelfSelfXDataUsedFps = Object.keys(newSelfSelfXdata[0].exchangeKey)
    expect(newSelfSelfXDataUsedFps).to.have.length(1)
    expect(newSelfSelfXDataUsedFps[0]).to.eq(fingerprintV2(newHcpKeySpki))
    const newSelfParentXdata = selfParentXdata2.filter((xd) => xd.id !== selfParentXdata[0].id)!
    expect(newSelfParentXdata).to.have.length(1)
    const newSelfParentXDataUsedFps = Object.keys(newSelfParentXdata[0].exchangeKey)
    expect(newSelfParentXDataUsedFps).to.have.length(2)
    expect(newSelfParentXDataUsedFps).to.have.members([fingerprintV2(newHcpKeySpki), fingerprintV2(newParentKeySpki)])
    // Check after reinitialization with keys already in storage the "verified" situation is unchanged.
    const apiWithUntrustedKey2 = await IcureApi.initialise(
      env.iCureUrl,
      { username: hcp.user, password: hcp.password },
      new TrustedKeysStrategy([], [], { failRecoverAndVerifySelfHierarchyKeys: true }),
      webcrypto as any,
      fetch,
      apiWithUntrustedKeysStorages
    )
    expect(
      await apiWithUntrustedKey2.cryptoApi.userKeysManager.getVerifiedPublicKeysFor(
        await apiWithUntrustedKey2.healthcarePartyApi.getHealthcareParty(hcp.dataOwnerId)
      )
    ).to.have.members([newHcpKeySpki])
    expect(
      await apiWithUntrustedKey2.cryptoApi.userKeysManager.getVerifiedPublicKeysFor(
        await apiWithUntrustedKey2.healthcarePartyApi.getHealthcareParty(parent.dataOwnerId)
      )
    ).to.have.members([newParentKeySpki])
    expect(await apiWithUntrustedKey2.cryptoApi.userKeysManager.getCurrentUserHierarchyAvailablePublicKeysHex()).to.have.members([
      newHcpKeySpki,
      hcp.publicKey,
      parent.publicKey,
      newParentKeySpki,
    ])
    expect(await apiWithUntrustedKey2.cryptoApi.userKeysManager.getCurrentUserAvailablePublicKeysHex(false)).to.have.members([
      newHcpKeySpki,
      hcp.publicKey,
    ])
  })
})
