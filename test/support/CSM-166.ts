import { getEnvironmentInitializer, getEnvVariables, getTempEmail, hcp1Username, patUsername, setLocalStorage, TestVars } from '../utils/test_utils'
import { Api, hex2ua, pkcs8ToJwk, ua2hex } from '../../icc-x-api'
import { webcrypto } from 'crypto'
import { expect } from 'chai'
import 'isomorphic-fetch'
import { FilterChainMaintenanceTask } from '../../icc-api/model/FilterChainMaintenanceTask'
import { MaintenanceTask } from '../../icc-api/model/MaintenanceTask'
import { MaintenanceTaskAfterDateFilter } from '../../icc-x-api/filters/MaintenanceTaskAfterDateFilter'
import { Service } from '../../icc-api/model/Service'
import { Contact } from '../../icc-api/model/Contact'
import { FilterChainHealthElement } from '../../icc-api/model/FilterChainHealthElement'
import { UnionFilter } from '../../icc-x-api/filters/UnionFilter'
import { HealthElementByHcPartyTagCodeFilter } from '../../icc-x-api/filters/HealthElementByHcPartyTagCodeFilter'
setLocalStorage(fetch)

let env: TestVars

describe('CSM-166', async function () {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('A user should be able to filter HealthElements for the parent', async function () {
    const hcpCredentials = env.dataOwnerDetails[hcp1Username]
    const hcpApis = await Api(env.iCureUrl, hcpCredentials.user, hcpCredentials.password, webcrypto as any, fetch)
    const hcpUser = await hcpApis.userApi.getCurrentUser()
    await hcpApis.cryptoApi.loadKeyPairsAsJwkInBrowserLocalStorage(hcpUser.healthcarePartyId!, pkcs8ToJwk(hex2ua(hcpCredentials.privateKey)))
    const childKeypair = await hcpApis.cryptoApi.RSA.generateKeyPair()
    const childHcp = await hcpApis.healthcarePartyApi.createHealthcareParty({
      id: hcpApis.cryptoApi.randomUuid(),
      name: 'Child HCP',
      parentId: hcpUser.healthcarePartyId!,
      publicKey: ua2hex(await hcpApis.cryptoApi.RSA.exportKey(childKeypair.publicKey, 'spki')),
    })
    const childLogin = getTempEmail()
    const childPw = 'FakePassword'
    await hcpApis.userApi.createUser({
      id: hcpApis.cryptoApi.randomUuid(),
      login: childLogin,
      passwordHash: childPw,
      healthcarePartyId: childHcp.id,
    })
    const childApis = await Api(env.iCureUrl, childLogin, childPw, webcrypto as any, fetch)
    const childUser = await childApis.userApi.getCurrentUser()
    await childApis.cryptoApi.loadKeyPairsAsJwkInBrowserLocalStorage(
      childUser.healthcarePartyId!,
      await hcpApis.cryptoApi.RSA.exportKey(childKeypair.privateKey, 'jwk')
    )
    await childApis.cryptoApi.loadKeyPairsAsJwkInBrowserLocalStorage(hcpUser.healthcarePartyId!, pkcs8ToJwk(hex2ua(hcpCredentials.privateKey)))
    const patient = await hcpApis.patientApi.createPatientWithUser(
      hcpUser,
      await hcpApis.patientApi.newInstance(hcpUser, { firstName: 'Patient', lastName: '0' })
    )
    const he = await hcpApis.healthcareElementApi.createHealthElementWithUser(
      hcpUser,
      await hcpApis.healthcareElementApi.newInstance(hcpUser, patient, {
        descr: 'bronchite chronique obstructive',
        codes: [
          {
            type: 'ICPC',
            version: '2',
            code: 'R95',
            id: 'ICPC|R95|2',
          },
        ],
      })
    )
    const heRetrievedByChild = await childApis.healthcareElementApi.getHealthElementWithUser(childUser, he.id)
    expect(heRetrievedByChild.descr).to.not.be.undefined
    expect(heRetrievedByChild.codes).to.not.be.undefined
    expect(heRetrievedByChild.descr).to.equal(he.descr)
    expect(heRetrievedByChild.codes![0].id).to.equal(he.codes![0].id)
    const filteredHes = await childApis.healthcareElementApi.filterByWithUser(
      childUser,
      undefined,
      undefined,
      new FilterChainHealthElement({
        filter: new UnionFilter([
          new HealthElementByHcPartyTagCodeFilter({
            healthCarePartyId: hcpUser.healthcarePartyId!,
            tagType: null,
            tagCode: null,
            codeType: 'ICPC',
            codeCode: 'R95',
            status: null,
          }),
        ]),
      })
    )
    expect(filteredHes.rows!.length).to.equal(1)
    expect(filteredHes.rows![0].id).to.equal(he.id)
    expect(filteredHes.rows![0].descr).to.equal(he.descr)
    expect(filteredHes.rows![0].codes![0].id).to.equal(he.codes![0].id)
  })
})
