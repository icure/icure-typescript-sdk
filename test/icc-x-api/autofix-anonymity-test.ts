import { before } from 'mocha'
import { createNewHcpApi, createNewPatientApi, getEnvironmentInitializer, setLocalStorage } from '../utils/test_utils'
import { getEnvVariables, TestVars, UserDetails } from '@icure/test-setup/types'
import { DataOwnerTypeEnum } from '../../icc-api/model/DataOwnerTypeEnum'
import { CryptoPrimitives, CryptoStrategies, IcureApi, KeyPair } from '../../icc-x-api'
import { expect } from 'chai'
import { CryptoActorStubWithType } from '../../icc-api/model/CryptoActorStub'
import { DataOwnerWithType } from '../../icc-api/model/DataOwnerWithType'
import { testStorageWithKeys } from '../utils/TestStorage'
import { webcrypto } from 'crypto'

import 'isomorphic-fetch'

setLocalStorage(fetch)

let env: TestVars

describe('Autofix anonymity tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  async function initApi(dataOwnerType: DataOwnerTypeEnum, isAnonymous: boolean): Promise<IcureApi> {
    const cryptoStrats: CryptoStrategies = {
      dataOwnerRequiresAnonymousDelegation(dataOwner: CryptoActorStubWithType): boolean {
        if (isAnonymous) return dataOwner.type == dataOwnerType
        else return false
      },
      generateNewKeyForDataOwner(self: DataOwnerWithType, cryptoPrimitives: CryptoPrimitives): Promise<KeyPair<CryptoKey> | boolean> {
        throw new Error('This method should not be necessary for this test')
      },
      recoverAndVerifySelfHierarchyKeys(
        keysData: {
          dataOwner: DataOwnerWithType
          unknownKeys: string[]
          unavailableKeys: string[]
        }[],
        cryptoPrimitives: CryptoPrimitives
      ): Promise<{
        [p: string]: { recoveredKeys: { [p: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [p: string]: boolean } }
      }> {
        throw new Error('This method should not be necessary for this test')
      },
      verifyDelegatePublicKeys(delegate: CryptoActorStubWithType, publicKeys: string[], cryptoPrimitives: CryptoPrimitives): Promise<string[]> {
        return Promise.resolve(publicKeys)
      },
    }
    let userDetails: UserDetails
    if (dataOwnerType == DataOwnerTypeEnum.Patient) {
      userDetails = (await createNewPatientApi(env)).credentials
    } else if (dataOwnerType == DataOwnerTypeEnum.Hcp) {
      userDetails = (await createNewHcpApi(env)).credentials
    } else throw new Error('Unsupported data owner type')
    const storage = await testStorageWithKeys([
      {
        dataOwnerId: userDetails.dataOwnerId,
        pairs: [{ keyPair: { publicKey: userDetails.publicKey, privateKey: userDetails.privateKey }, shaVersion: 'sha-1' }],
      },
    ])
    const api = await IcureApi.initialise(
      env.iCureUrl,
      { username: userDetails.user, password: userDetails.password },
      cryptoStrats,
      webcrypto as any,
      fetch,
      {
        keyStorage: storage.keyStorage,
        entryKeysFactory: storage.keyFactory,
        storage: storage.storage,
      }
    )
    expect((await api.dataOwnerApi.getCurrentDataOwnerStub()).type).to.eq(dataOwnerType)
    return api
  }

  async function doTest(dataOwnerType: DataOwnerTypeEnum, isAnonymous: boolean) {
    const api = await initApi(dataOwnerType, isAnonymous)
    const user = await api.userApi.getCurrentUser()
    const createdWithNewInstance = await api.patientApi.createPatientWithUser(
      user,
      await api.patientApi.newInstance(user, { firstName: 'q', lastName: 'q' })
    )
    const createdByBackend = await api.agendaApi.createAgenda({ id: api.cryptoApi.primitives.randomUuid(), name: 'whatever' })
    if (isAnonymous) {
      expect(createdWithNewInstance.author).to.eq('*')
      expect(createdWithNewInstance.responsible).to.eq('*')
      expect(createdByBackend.author).to.eq('*')
      expect(createdByBackend.responsible).to.eq('*')
    } else {
      const doId = api.dataOwnerApi.getDataOwnerIdOf(user)
      expect(createdWithNewInstance.author).to.eq(user.id)
      expect(createdWithNewInstance.responsible).to.eq(doId)
      expect(createdByBackend.author).to.eq(user.id)
      expect(createdByBackend.responsible).to.eq(doId)
    }
  }

  it('Entity created by a patient should omit author and responsible if crypto strategies require anonymous delegations for the user', async () => {
    await doTest(DataOwnerTypeEnum.Patient, true)
  })

  it('Entity created by a patient should autofix author and responsible if crypto strategies does not require anonymous delegations for the user', async () => {
    await doTest(DataOwnerTypeEnum.Patient, false)
  })

  it('Entity created by a HCP should omit author and responsible if crypto strategies require anonymous delegations for the user', async () => {
    await doTest(DataOwnerTypeEnum.Hcp, true)
  })

  it('Entity created by a HCP should autofix author and responsible if crypto strategies does not require anonymous delegations for the user', async () => {
    await doTest(DataOwnerTypeEnum.Hcp, false)
  })
})
