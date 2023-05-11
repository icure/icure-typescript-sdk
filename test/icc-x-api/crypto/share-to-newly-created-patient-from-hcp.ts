import { Api } from '../../../icc-x-api'
import { v4 as uuid } from 'uuid'
import { User } from '../../../icc-api/model/User'
import { before, describe, it } from 'mocha'

import { webcrypto } from 'crypto'
import 'isomorphic-fetch'

import { IccPatientApi } from '../../../icc-api'
import { expect } from 'chai'

import { BasicAuthenticationProvider } from '../../../icc-x-api/auth/AuthenticationProvider'
import { createHcpHierarchyApis, getEnvironmentInitializer, setLocalStorage } from '../../utils/test_utils'
import { TestKeyStorage, TestStorage } from '../../utils/TestStorage'
import { TestCryptoStrategies } from '../../utils/TestCryptoStrategies'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'

setLocalStorage(fetch)

let env: TestVars

describe('Full battery of tests on crypto and keys', async function () {
  this.timeout(600000)

  before(async function () {
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it(`Share patient from hcp to patient`, async () => {
    const { childApi: api, childUser: u } = await createHcpHierarchyApis(env!)

    const patient = await api.patientApi.createPatientWithUser(
      u,
      await api.patientApi.newInstance(u, { id: uuid(), firstName: 'test', lastName: 'test', note: 'secure' })
    )
    const heNote = 'Some encrypted note'
    const he = await api.healthcareElementApi.createHealthElementWithUser(u, await api.healthcareElementApi.newInstance(u, patient, { note: heNote }))
    const check = await api.patientApi.getPatientWithUser(u, patient.id)

    expect(check.note).to.equal('secure')

    const newPatientUser = await api.userApi.createUser(
      new User({
        id: `user-${patient.id}-patient`,
        login: `patient-${patient.id}`,
        status: 'ACTIVE',
        passwordHash: 'LetMeInForReal',
        patientId: patient.id,
      })
    )

    const apiAsPatient = await Api(
      env!.iCureUrl,
      { username: newPatientUser.login!, password: 'LetMeInForReal', forceBasic: true },
      new TestCryptoStrategies(await api.cryptoApi.primitives.RSA.generateKeyPair()),
      webcrypto as unknown as Crypto,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    )

    const patientBaseApi = new IccPatientApi(env!.iCureUrl, {}, new BasicAuthenticationProvider(newPatientUser.login!, 'LetMeInForReal'))

    const pat = await patientBaseApi.getPatient(patient.id)

    expect(pat.note ?? undefined).to.be.undefined

    await api.patientApi.shareAllDataOfPatient(u, patient.id, u.healthcarePartyId!, [patient.id], { [patient.id]: ['all'] })
    await apiAsPatient.cryptoApi.forceReload()
    const patUser = await apiAsPatient.userApi.getCurrentUser()
    const entity = await apiAsPatient.patientApi.getPatientWithUser(patUser, patient.id)
    const retrievedHe = await apiAsPatient.healthcareElementApi.getHealthElementWithUser(patUser, he.id!)

    expect(entity.id).to.be.not.null
    expect(entity.rev).to.be.not.null
    expect(entity.note).to.equal('secure')
    expect(retrievedHe.id).to.equal(he.id)
    expect(retrievedHe.note).to.equal(heNote)
  })
})
