import { getEnvironmentInitializer, setLocalStorage } from '../utils/test_utils'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { webcrypto } from 'crypto'
import 'isomorphic-fetch'
import {IcureApi, IcureBasicApi, retry, ua2hex} from '../../icc-x-api'
import { CryptoPrimitives } from '../../icc-x-api/crypto/CryptoPrimitives'
import { IccUserApi } from '../../icc-api'
import { BasicAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { expect, use as chaiUse } from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import { KeyPair } from '../../icc-x-api/crypto/RSA'
import { TestCryptoStrategies } from '../utils/TestCryptoStrategies'
import { TestKeyStorage, TestStorage } from '../utils/TestStorage'
chaiUse(chaiAsPromised)

setLocalStorage(fetch)

describe('Icure api', function () {
  let env: TestVars
  const primitives = new CryptoPrimitives(webcrypto as any)
  const userGroup1Id: string = primitives.randomUuid() // Same username-pw as group 2
  const userGroup2Id: string = primitives.randomUuid() // Same username-pw as group 1
  const userGroup3Id: string = primitives.randomUuid() // Same username as group 1/2, different pw
  const userLogin: string = `maria-${primitives.randomUuid()}@pompei.it`
  const userPw12: string = `geppetto-${primitives.randomUuid()}`
  const userPw3: string = `pinocchio-${primitives.randomUuid()}`
  let user1Id: string
  let user2Id: string
  let user3Id: string
  const hcp1Id: string = primitives.randomUuid()
  const hcp2Id: string = primitives.randomUuid()
  const hcp3Id: string = primitives.randomUuid()
  let dataOwner1Pair: KeyPair<CryptoKey>
  let dataOwner2Pair: KeyPair<CryptoKey>
  let dataOwner3Pair: KeyPair<CryptoKey>
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    const api = await IcureBasicApi.initialise(env.iCureUrl, { username: 'john', password: 'LetMeIn'}, fetch)
    async function newGroupWithHcpUser(groupId: string, groupPrefix: string, userLogin: string, userPw: string, hcpId: string): Promise<string> {
      await api.groupApi.createGroup(
        groupId,
        `${groupPrefix}-${primitives.randomUuid()}`,
        primitives.randomUuid(),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {}
      )
      const res = await api.healthcarePartyApi.registerHealthcareParty(groupId, undefined, userPw, false, {
        id: hcpId,
        name: `${groupPrefix}-hcp-${primitives.randomUuid()}`,
        addresses: [
          {
            telecoms: [
              {
                telecomType: 'email',
                telecomNumber: userLogin,
              },
            ],
          },
        ],
      })
      expect(res.userId).to.not.be.undefined
      return res.userId!
    }
    user1Id = await newGroupWithHcpUser(userGroup1Id, 'group1', userLogin, userPw12, hcp1Id)
    user2Id = await newGroupWithHcpUser(userGroup2Id, 'group2', userLogin, userPw12, hcp2Id)
    user3Id = await newGroupWithHcpUser(userGroup3Id, 'group3', userLogin, userPw3, hcp3Id)
    dataOwner1Pair = await primitives.RSA.generateKeyPair()
    dataOwner2Pair = await primitives.RSA.generateKeyPair()
    dataOwner3Pair = await primitives.RSA.generateKeyPair()
    console.log(`Waiting for user to be replicated - ${userLogin}`)
    await retry(
      async () => {
        await new IccUserApi(env.iCureUrl, {}, new BasicAuthenticationProvider(`${userGroup1Id}/${user1Id}`, userPw12), fetch).getCurrentUser()
        await new IccUserApi(env.iCureUrl, {}, new BasicAuthenticationProvider(`${userGroup2Id}/${user2Id}`, userPw12), fetch).getCurrentUser()
        await new IccUserApi(env.iCureUrl, {}, new BasicAuthenticationProvider(`${userGroup3Id}/${user3Id}`, userPw3), fetch).getCurrentUser()
      },
      10,
      5_000,
      1
    )
    console.log('Users created')
  })

  it('if a user has only one group should be initialised on that group', async () => {
    const api = await IcureApi.initialise(
      env.iCureUrl,
      { username: userLogin, password: userPw3 },
      new TestCryptoStrategies(dataOwner3Pair),
      webcrypto as any,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    )
    expect((await api.userApi.getCurrentUser()).id).to.equal(user3Id)
  })

  it('if a user has more than one group should be initialised on different groups depending on the parameters passed values, and the api should be switchable to the other group after initialisation', async () => {
    const storage = new TestStorage()
    const keyStorage = new TestKeyStorage()
    const api1 = await IcureApi.initialise(
      env.iCureUrl,
      { username: userLogin, password: userPw12 },
      new TestCryptoStrategies(dataOwner1Pair),
      webcrypto as any,
      fetch,
      {
        storage,
        keyStorage,
        groupSelector: async (groups) => {
          expect(groups.map((x) => x.groupId)).to.have.members([userGroup1Id, userGroup2Id])
          return userGroup1Id
        },
      }
    )
    expect((await api1.userApi.getCurrentUser()).id).to.equal(user1Id)
    const key1PubHex = ua2hex(await primitives.RSA.exportKey(dataOwner1Pair.publicKey, 'spki'))
    expect(Object.keys(api1.cryptoApi.userKeysManager.getDecryptionKeys())).to.have.members([key1PubHex.slice(-32)])
    const api2 = await IcureApi.initialise(
      env.iCureUrl,
      { username: userLogin, password: userPw12 },
      new TestCryptoStrategies(dataOwner2Pair),
      webcrypto as any,
      fetch,
      {
        storage,
        keyStorage,
        groupSelector: async (groups) => {
          expect(groups.map((x) => x.groupId)).to.have.members([userGroup1Id, userGroup2Id])
          return userGroup2Id
        },
      }
    )
    expect((await api2.userApi.getCurrentUser()).id).to.equal(user2Id)
    const key2PubHex = ua2hex(await primitives.RSA.exportKey(dataOwner2Pair.publicKey, 'spki'))
    expect(Object.keys(api2.cryptoApi.userKeysManager.getDecryptionKeys())).to.have.members([key2PubHex.slice(-32)])
    const api1GroupsInfo = await api1.getGroupsInfo()
    expect(api1GroupsInfo.availableGroups.map((x) => x.groupId)).to.have.members([userGroup1Id, userGroup2Id])
    expect(api1GroupsInfo.currentGroup?.groupId).to.equal(userGroup1Id)
    const api1SwitchedTo2 = await api1.switchGroup(userGroup2Id)
    expect((await api1SwitchedTo2.userApi.getCurrentUser()).id).to.equal(user2Id)
    expect(Object.keys(api1SwitchedTo2.cryptoApi.userKeysManager.getDecryptionKeys())).to.have.members([key2PubHex.slice(-32)])
    const api1switchedTo2GroupsInfo = await api1SwitchedTo2.getGroupsInfo()
    expect(api1switchedTo2GroupsInfo.availableGroups.map((x) => x.groupId)).to.have.members([userGroup1Id, userGroup2Id])
    expect(api1switchedTo2GroupsInfo.currentGroup?.groupId).to.equal(userGroup2Id)
  })
})
