import { createNewHcpApi, getEnvironmentInitializer, getTempEmail, isLiteTest, setLocalStorage, TestUtils } from '../utils/test_utils'
import { before } from 'mocha'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { CryptoPrimitives, IcureApi, KeyPair, sleep } from '../../icc-x-api'
import { randomUUID, webcrypto } from 'crypto'
import { User } from '../../icc-api/model/User'
import { assert, expect, use as chaiUse } from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import { TestKeyStorage, TestStorage } from '../utils/TestStorage'
import { CryptoActorStubWithType } from '../../icc-api/model/CryptoActorStub'
import { DataOwnerTypeEnum } from '../../icc-api/model/DataOwnerTypeEnum'
import { DataOwnerWithType } from '../../icc-api/model/DataOwnerWithType'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { RecoveryDataUseFailureReason } from '../../icc-x-api/icc-recovery-x-api'
import { KeyPairRecoverer } from '../../icc-x-api/crypto/KeyPairRecoverer'
import { delay } from 'lodash'
import { FilterChainHealthElement } from '../../icc-api/model/FilterChainHealthElement'
import { HealthElementByHcPartyFilter } from '../../icc-x-api/filters/HealthElementByHcPartyFilter'

chaiUse(chaiAsPromised)
setLocalStorage(fetch)
let env: TestVars

describe('Recovery api use scenarios', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('An hcp should be able to share data with an uninitialized patient data owner and the patient should be able to recover the exchange data with the provided recovery key.', async function () {
    const hcp = await createNewHcpApi(env)
    const patientId = randomUUID()
    const patientMail = getTempEmail()
    const patientPassword = randomUUID()
    const patient = await hcp.api.patientApi.createPatientWithUser(
      hcp.user,
      await hcp.api.patientApi.newInstance(hcp.user, {
        id: patientId,
        firstName: 'John',
        lastName: 'Doe',
      })
    )
    const patientUser = await hcp.api.userApi.createUser(
      new User({
        id: randomUUID(),
        login: patientMail,
        passwordHash: patientPassword,
        patientId: patientId,
      })
    )
    const healthData = await hcp.api.healthcareElementApi.createHealthElementWithUser(
      hcp.user,
      await hcp.api.healthcareElementApi.newInstance(hcp.user, patient, {
        descr: 'Health data',
      })
    )
    await expect(hcp.api.healthcareElementApi.shareWith(patientId, healthData)).to.be.rejected
    expect(await hcp.api.patientApi.forceInitialiseExchangeDataToNewlyInvitedPatient(patientId)).to.be.true
    const recoveryKey = await hcp.api.recoveryApi.createExchangeDataRecoveryInfo(patientId)
    const sharedHealthData = await hcp.api.healthcareElementApi.shareWith(patientId, healthData)
    const patientApi = await IcureApi.initialise(
      env.iCureUrl,
      { username: patientMail, password: patientPassword },
      {
        dataOwnerRequiresAnonymousDelegation(dataOwner: CryptoActorStubWithType): boolean {
          return dataOwner.type == DataOwnerTypeEnum.Patient
        },
        generateNewKeyForDataOwner(): Promise<boolean> {
          return Promise.resolve(true)
        },
        recoverAndVerifySelfHierarchyKeys(
          keysData: {
            dataOwner: DataOwnerWithType
            unknownKeys: string[]
            unavailableKeys: string[]
          }[]
        ): Promise<{
          [p: string]: { recoveredKeys: { [p: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [p: string]: boolean } }
        }> {
          return Promise.resolve(Object.fromEntries(keysData.map((x) => [x.dataOwner.dataOwner.id, { recoveredKeys: {}, keyAuthenticity: {} }])))
        },
        verifyDelegatePublicKeys(_: any, publicKeys: string[]): Promise<string[]> {
          return Promise.resolve(publicKeys)
        },
      },
      webcrypto as any,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    )
    if (!isLiteTest()) await expect(patientApi.healthcareElementApi.getHealthElementWithUser(patientUser, sharedHealthData.id!)).to.be.rejected
    expect(await patientApi.recoveryApi.recoverExchangeData(recoveryKey + 'aa')).to.equal(RecoveryDataUseFailureReason.Missing) // User put in the wrong key
    expect(await patientApi.recoveryApi.recoverExchangeData(recoveryKey)).to.be.null
    expect(await patientApi.recoveryApi.recoverExchangeData(recoveryKey)).to.equal(RecoveryDataUseFailureReason.Missing) // After use it is automatically deleted
    expect(
      (
        await patientApi.healthcareElementApi.filterByWithUser(
          patientUser,
          undefined,
          10000,
          new FilterChainHealthElement({
            filter: new HealthElementByHcPartyFilter({ hcpId: patientUser.patientId }),
          })
        )
      ).rows![0]
    ).to.be.deep.equal(sharedHealthData)
    expect(await patientApi.healthcareElementApi.getHealthElementWithUser(patientUser, sharedHealthData.id!)).to.be.deep.equal(sharedHealthData)
    await hcp.api.cryptoApi.forceReload()
    const healthData2 = await hcp.api.healthcareElementApi.createHealthElementWithUser(
      hcp.user,
      await hcp.api.healthcareElementApi.newInstance(
        hcp.user,
        patient,
        {
          descr: 'Health data 2',
        },
        {
          additionalDelegates: { [patientId]: AccessLevelEnum.WRITE },
        }
      )
    )
    expect(await patientApi.healthcareElementApi.getHealthElementWithUser(patientUser, healthData2.id!)).to.be.deep.equal(healthData2)
    expect(await hcp.api.cryptoApi.exchangeData.base.getExchangeDataByDelegatorDelegatePair(hcp.credentials.dataOwnerId, patientId)).to.have.length(1)
  })

  it('A user should be able to create keypair recovery data and use the recovery key to get back the keys.', async function () {
    const hcp = await createNewHcpApi(env)
    const patient = await hcp.api.patientApi.createPatientWithUser(
      hcp.user,
      await hcp.api.patientApi.newInstance(hcp.user, {
        firstName: 'John',
        lastName: 'Doe',
        note: 'Encrypted content',
      })
    )
    expect(patient.note).to.equal('Encrypted content')
    const recoveryKey = await hcp.api.recoveryApi.createRecoveryInfoForAvailableKeyPairs()
    let recoverAndVerifiedCalled = false
    const recoveredApi = await IcureApi.initialise(
      env.iCureUrl,
      { username: hcp.credentials.user, password: hcp.credentials.password },
      {
        dataOwnerRequiresAnonymousDelegation(dataOwner: CryptoActorStubWithType): boolean {
          return dataOwner.type == DataOwnerTypeEnum.Patient
        },
        generateNewKeyForDataOwner(): Promise<boolean> {
          return Promise.resolve(false)
        },
        async recoverAndVerifySelfHierarchyKeys(
          keysData: {
            dataOwner: DataOwnerWithType
            unknownKeys: string[]
            unavailableKeys: string[]
          }[],
          _: any,
          keyRecoverer: KeyPairRecoverer
        ): Promise<{
          [p: string]: { recoveredKeys: { [p: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [p: string]: boolean } }
        }> {
          recoverAndVerifiedCalled = true
          const recovered = await keyRecoverer.recoverWithRecoveryKey(recoveryKey, true)
          if ('success' in recovered) {
            expect(Object.entries(recovered.success)).to.have.length(1)
            const recoveredForSelf = recovered.success[hcp.credentials.dataOwnerId]
            expect(Object.entries(recoveredForSelf)).to.have.length(1)
            expect(await keyRecoverer.recoverWithRecoveryKey(recoveryKey, true)).to.deep.equal({ failure: RecoveryDataUseFailureReason.Missing })
            const res: {
              [p: string]: { recoveredKeys: { [p: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [p: string]: boolean } }
            } = {}
            for (const keyData of keysData) {
              if (keyData.dataOwner.dataOwner.id == hcp.credentials.dataOwnerId) {
                res[keyData.dataOwner.dataOwner.id] = {
                  recoveredKeys: recoveredForSelf,
                  keyAuthenticity: {},
                }
              } else {
                res[keyData.dataOwner.dataOwner.id!] = {
                  recoveredKeys: {},
                  keyAuthenticity: {},
                }
              }
            }
            return res
          } else {
            assert.fail('Could not recover keys with recovery key')
          }
        },
        verifyDelegatePublicKeys(_: any, publicKeys: string[]): Promise<string[]> {
          return Promise.resolve(publicKeys)
        },
      },
      webcrypto as any,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    )
    expect(recoverAndVerifiedCalled).to.be.true
    expect(recoveredApi.dataOwnerApi.getHexPublicKeysOf(await recoveredApi.healthcarePartyApi.getCurrentHealthcareParty())).to.have.length(1)
    expect(await recoveredApi.patientApi.getPatientWithUser(hcp.user, patient.id!)).to.be.deep.equal(patient)
  })

  it('Recovery data should expire after the lifetime has elapsed', async function () {
    const hcp = await createNewHcpApi(env)
    const recoveryKey = await hcp.api.recoveryApi.createRecoveryInfoForAvailableKeyPairs({ lifetimeSeconds: 5 })
    await sleep(1000)
    const recovered1 = await hcp.api.recoveryApi.recoverKeyPairs(recoveryKey, false)
    expect(recovered1).to.have.keys('success')
    await sleep(1000)
    const recovered2 = await hcp.api.recoveryApi.recoverKeyPairs(recoveryKey, false)
    expect(recovered2).to.have.keys('success')
    await sleep(3000)
    const recovered3 = await hcp.api.recoveryApi.recoverKeyPairs(recoveryKey, false)
    expect(recovered3).to.deep.equal({ failure: RecoveryDataUseFailureReason.Missing })
  })
})
