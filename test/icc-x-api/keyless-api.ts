import 'isomorphic-fetch'

import { before } from 'mocha'
import { createNewHcpApi, createNewKeylessApi, getEnvironmentInitializer, setLocalStorage, TestUtils } from '../utils/test_utils'
import { IcureApi, SecretIdUseOption, ShaVersion } from '../../icc-x-api'
import { webcrypto } from 'crypto'
import { expect } from 'chai'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { Patient } from '../../icc-api/model/Patient'
import { CalendarItem } from '../../icc-api/model/CalendarItem'
import { TestKeyStorage } from '../utils/TestStorage'
import { TestCryptoStrategies } from '../utils/TestCryptoStrategies'
import { KeylessCryptoStrategies } from '../utils/KeylessCryptoStrategies'

setLocalStorage(fetch)
let env: TestVars

describe('Keyless api Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  const calendarItemTitle = 'Encrypted title'

  async function initializeTestData() {
    const { api: patientApi, credentials: patientCredentials } = await createNewKeylessApi(env)
    const patientUser = await patientApi.userApi.getCurrentUser()
    const patient = (await patientApi.dataOwnerApi.getCurrentDataOwner()).dataOwner as Patient
    const { api: hcpApi, credentials: hcpDetails, user: hcpUser } = await createNewHcpApi(env)
    const exchangeData = await patientApi.cryptoApi.keylessCreateExchangeDataTo(hcpDetails.dataOwnerId)
    const createdCalendarItem = await patientApi.calendarItemApi.createCalendarItemWithHcParty(
      patientUser,
      await patientApi.calendarItemApi.newInstancePatient(
        patientUser,
        patient,
        { title: calendarItemTitle },
        {
          sfkOption: SecretIdUseOption.UseNone,
          alternateRootDelegation: hcpDetails.dataOwnerId,
        }
      )
    )
    expect(createdCalendarItem.title).to.equal(calendarItemTitle)
    return {
      patientApi,
      patientCredentials,
      patientUser,
      patient,
      hcpApi,
      hcpDetails,
      hcpUser,
      exchangeData,
      createdCalendarItem,
    }
  }

  it('Keyless api should allow creation of data and retrieval by delegator and delegate', async () => {
    const { patientApi, patientUser, patient, hcpApi, hcpUser, createdCalendarItem } = await initializeTestData()

    const retrievedByPatient: CalendarItem = await patientApi.calendarItemApi.getCalendarItemWithUser(patientUser, createdCalendarItem.id)
    expect(retrievedByPatient.title).to.equal(calendarItemTitle)
    expect(await patientApi.calendarItemApi.decryptPatientIdOf(retrievedByPatient)).to.have.members([patient.id])
    const retrievedByHcp: CalendarItem = await hcpApi.calendarItemApi.getCalendarItemWithUser(hcpUser, createdCalendarItem.id)
    expect(retrievedByHcp.title).to.equal(calendarItemTitle)
    expect(await hcpApi.calendarItemApi.decryptPatientIdOf(retrievedByHcp)).to.have.members([patient.id])
  })

  it('Keyless api should allow retrieval in new instance after exchange data injection', async () => {
    const { patientCredentials, patientUser, patient, exchangeData, createdCalendarItem } = await initializeTestData()

    const newPatientApi = await IcureApi.initialise(env.iCureUrl, patientCredentials, new KeylessCryptoStrategies(), webcrypto as any, fetch, {})
    await newPatientApi.calendarItemApi.getCalendarItemWithUser(patientUser, createdCalendarItem.id).then(
      () => {
        throw new Error('Get before injection for anonymous user should not work')
      },
      () => {
        /* ok, expected */
      }
    )
    await newPatientApi.cryptoApi.injectExchangeData([{ ...exchangeData, verified: false }], false)
    const retrievedByNewApi: CalendarItem = await newPatientApi.calendarItemApi.getCalendarItemWithUser(patientUser, createdCalendarItem.id)
    expect(retrievedByNewApi.title).to.equal(calendarItemTitle)
    expect(await newPatientApi.calendarItemApi.decryptPatientIdOf(retrievedByNewApi)).to.have.members([patient.id])
  })

  it('Should allow re-encryption of exchange data as unverified on injection', async () => {
    const { patientApi, patientCredentials, patientUser, patient, hcpDetails, exchangeData, createdCalendarItem } = await initializeTestData()

    const keyStorage = new TestKeyStorage()
    const newKey = await patientApi.cryptoApi.primitives.RSA.generateKeyPair(ShaVersion.Sha256)
    const newPatientApiWithKeyAndInjected = await IcureApi.initialise(
      env.iCureUrl,
      patientCredentials,
      new TestCryptoStrategies(newKey),
      webcrypto as any,
      fetch,
      {
        keyStorage,
        injectExchangeData: {
          details: [{ ...exchangeData, verified: false }],
          reEncryptWithOwnKeys: true,
        },
      }
    )
    expect(
      (await newPatientApiWithKeyAndInjected.cryptoApi.exchangeData.getOrCreateEncryptionDataTo(hcpDetails.dataOwnerId)).exchangeData.id ==
        exchangeData.exchangeDataId
    ).to.be.false
    const newPatientApiWithKey = await IcureApi.initialise(env.iCureUrl, patientCredentials, new TestCryptoStrategies(), webcrypto as any, fetch, {
      keyStorage,
    })
    const retrievedByNewApi: CalendarItem = await newPatientApiWithKey.calendarItemApi.getCalendarItemWithUser(patientUser, createdCalendarItem.id)
    expect(retrievedByNewApi.title).to.equal(calendarItemTitle)
    expect(await newPatientApiWithKey.calendarItemApi.decryptPatientIdOf(retrievedByNewApi)).to.have.members([patient.id])
    expect(
      (await newPatientApiWithKey.cryptoApi.exchangeData.getOrCreateEncryptionDataTo(hcpDetails.dataOwnerId)).exchangeData.id ==
        exchangeData.exchangeDataId
    ).to.be.false
  })

  it('Should allow re-encryption of exchange data as verified on injection', async () => {
    const { patientApi, patientCredentials, patientUser, patient, hcpDetails, exchangeData, createdCalendarItem } = await initializeTestData()

    const keyStorage = new TestKeyStorage()
    const newKey = await patientApi.cryptoApi.primitives.RSA.generateKeyPair(ShaVersion.Sha256)
    const newPatientApiWithKeyAndInjected = await IcureApi.initialise(
      env.iCureUrl,
      patientCredentials,
      new TestCryptoStrategies(newKey),
      webcrypto as any,
      fetch,
      {
        keyStorage,
        injectExchangeData: {
          details: [{ ...exchangeData, verified: true }],
          reEncryptWithOwnKeys: true,
        },
      }
    )
    expect(
      (await newPatientApiWithKeyAndInjected.cryptoApi.exchangeData.getOrCreateEncryptionDataTo(hcpDetails.dataOwnerId)).exchangeData.id ==
        exchangeData.exchangeDataId
    ).to.be.true
    const newPatientApiWithKey = await IcureApi.initialise(env.iCureUrl, patientCredentials, new TestCryptoStrategies(), webcrypto as any, fetch, {
      keyStorage,
    })
    expect(
      (await newPatientApiWithKey.cryptoApi.exchangeData.getOrCreateEncryptionDataTo(hcpDetails.dataOwnerId)).exchangeData.id ==
        exchangeData.exchangeDataId
    ).to.be.true
    const retrievedByNewApi: CalendarItem = await newPatientApiWithKey.calendarItemApi.getCalendarItemWithUser(patientUser, createdCalendarItem.id)
    expect(retrievedByNewApi.title).to.equal(calendarItemTitle)
    expect(await newPatientApiWithKey.calendarItemApi.decryptPatientIdOf(retrievedByNewApi)).to.have.members([patient.id])
  })
})
