import { getEnvironmentInitializer, getEnvVariables, hcp1Username, hcp2Username, setLocalStorage, TestVars } from '../utils/test_utils'
import { Api, hex2ua, pkcs8ToJwk, ua2hex } from '../../icc-x-api'
import { webcrypto } from 'crypto'
import { expect } from 'chai'
import 'isomorphic-fetch'
setLocalStorage(fetch)

let env: TestVars

describe('CSM-87', async function () {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('An hcp should be able to load his key with `loadKeyPairsAsJwkInBrowserLocalStorage` and then create shamir partitions for himself', async function () {
    const hcp1Credentials = env.dataOwnerDetails[hcp1Username]
    const apis = await Api(env.iCureUrl, hcp1Credentials.user, hcp1Credentials.password, webcrypto as any, fetch)
    const hcp1Id = (await apis.userApi.getCurrentUser()).healthcarePartyId!
    const hcp2Credentials = env.dataOwnerDetails[hcp2Username]
    const apis2 = await Api(env.iCureUrl, hcp2Credentials.user, hcp2Credentials.password, webcrypto as any, fetch)
    const hcp2Id = (await apis2.userApi.getCurrentUser()).healthcarePartyId!
    await apis.cryptoApi.loadKeyPairsAsJwkInBrowserLocalStorage(hcp1Id, pkcs8ToJwk(hex2ua(hcp1Credentials.privateKey)))
    const hcp1 = await apis.healthcarePartyApi.getHealthcareParty(hcp1Id)
    const hcp2 = await apis.healthcarePartyApi.getHealthcareParty(hcp2Id)
    const updatedHcp = await apis.cryptoApi.encryptShamirRSAKey(hcp1, [hcp2])
    expect(Object.keys(updatedHcp.privateKeyShamirPartitions ?? {})).to.have.members([hcp2Id])
  })
})
