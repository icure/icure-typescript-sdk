import { getEnvironmentInitializer, hcp1Username, patUsername, setLocalStorage, TestUtils } from '../utils/test_utils'
import { IcureApi, sleep } from '../../icc-x-api'
import { webcrypto } from 'crypto'
import { expect } from 'chai'
import 'isomorphic-fetch'
import { MaintenanceTask } from '../../icc-api/model/MaintenanceTask'
import { Service } from '../../icc-api/model/Service'
import { Contact } from '../../icc-api/model/Contact'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import initApi = TestUtils.initApi
import { TestCryptoStrategies } from '../utils/TestCryptoStrategies'
import { TestKeyStorage, TestStorage } from '../utils/TestStorage'
import { MaintenanceTaskByHcPartyAndTypeFilter } from '../../icc-x-api/filters/MaintenanceTaskByHcPartyAndTypeFilter'
setLocalStorage(fetch)

let env: TestVars

describe('CSM-185', async function () {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('An HCP should be able to listen to MaintenanceTask from a patient that lost their keys', async function () {
    const hcpApis = await initApi(env, hcp1Username)
    const hcpUser = await hcpApis.userApi.getCurrentUser()
    const patApis = await initApi(env, patUsername)
    const patUser = await patApis.userApi.getCurrentUser()
    const patientNote = 'Some secret note'
    const p2 = await hcpApis.patientApi.createPatientWithUser(
      hcpUser,
      await hcpApis.patientApi.newInstance(
        hcpUser,
        {
          firstName: 'John',
          lastName: 'Doe',
          note: patientNote,
        },
        { additionalDelegates: { [patUser.patientId!]: 'WRITE' } }
      )
    )
    const heNote = 'Another secret note'
    await patApis.cryptoApi.forceReload()
    const he = await patApis.healthcareElementApi.createHealthElementWithUser(
      patUser,
      await patApis.healthcareElementApi.newInstance(
        patUser,
        p2,
        { note: heNote },
        { additionalDelegates: { [hcpUser.healthcarePartyId!]: 'WRITE' } }
      )
    )
    const ctcData = 'Some data'
    const ctcDescr = 'Some description'
    const ctc = await hcpApis.contactApi.createContactWithUser(
      hcpUser,
      await hcpApis.contactApi.newInstance(
        hcpUser,
        p2,
        {
          services: [new Service({ label: 'svc', content: { fr: { stringValue: ctcData } } })],
          descr: ctcDescr,
        },
        { additionalDelegates: { [patUser.patientId!]: 'WRITE' } }
      )
    )
    function checkContactDecrypted(ctc: Contact) {
      expect(ctc.services?.[0]?.content?.fr?.stringValue).to.equal(ctcData)
      expect(ctc.descr).to.equal(ctcDescr)
    }
    function checkContactEncrypted(ctc: Contact) {
      expect(ctc.services?.[0]).to.not.be.undefined
      expect(Object.keys(ctc.services![0].content ?? {})).to.be.empty
      expect(ctc.descr).to.be.undefined
    }
    expect((await hcpApis.patientApi.getPatientWithUser(hcpUser, p2.id!)).note).to.equal(patientNote)
    expect((await patApis.patientApi.getPatientWithUser(patUser, p2.id!)).note).to.equal(patientNote)
    expect((await hcpApis.healthcareElementApi.getHealthElementWithUser(hcpUser, he.id!)).note).to.equal(heNote)
    expect((await patApis.healthcareElementApi.getHealthElementWithUser(patUser, he.id!)).note).to.equal(heNote)
    checkContactDecrypted(await hcpApis.contactApi.getContactWithUser(hcpUser, ctc!.id!))
    checkContactDecrypted(await patApis.contactApi.getContactWithUser(patUser, ctc!.id!))

    const events: MaintenanceTask[] = []
    const statuses: string[] = []

    let eventReceivedPromiseResolve!: (value: void | PromiseLike<void>) => void
    let eventReceivedPromiseReject!: (reason?: any) => void
    const eventReceivedPromise = new Promise<void>((res, rej) => {
      eventReceivedPromiseResolve = res
      eventReceivedPromiseReject = rej
    })

    const connection = await hcpApis.maintenanceTaskApi.subscribeToMaintenanceTaskEvents(
      ['CREATE'],
      new MaintenanceTaskByHcPartyAndTypeFilter({
        healthcarePartyId: hcpUser!.healthcarePartyId!,
        type: MaintenanceTask.TaskTypeEnum.KeyPairUpdate,
      }),
      async (task) => {
        events.push(task)
        eventReceivedPromiseResolve()
      },
      {
        debug: true,
      }
    )

    connection
      .onConnected(async () => {
        statuses.push('connected')
        await sleep(2_000)

        const newPair = await patApis.cryptoApi.primitives.RSA.generateKeyPair('sha-256')
        const patApisLost = await IcureApi.initialise(
          env.iCureUrl,
          { username: env.dataOwnerDetails[patUsername].user, password: env.dataOwnerDetails[patUsername].password },
          new TestCryptoStrategies(newPair),
          webcrypto as any,
          fetch,
          {
            createMaintenanceTasksOnNewKey: true,
            storage: new TestStorage(),
            keyStorage: new TestKeyStorage(),
          }
        )
        const retrievedPatientLost = await patApisLost.patientApi.getPatientWithUser(patUser, p2.id!)
        const retrievedHeLost = await patApisLost.healthcareElementApi.getHealthElementWithUser(patUser, he.id!)
        expect(retrievedPatientLost).to.not.be.undefined
        expect(retrievedHeLost).to.not.be.undefined
        expect(retrievedPatientLost.note).to.be.undefined
        expect(retrievedHeLost.note).to.be.undefined

        await sleep(2_000)
      })
      .onClosed(async () => {
        statuses.push('closed')
        await sleep(2_000)
      })

    const timeout = setTimeout(eventReceivedPromiseReject, 20_000)
    await eventReceivedPromise.then(() => clearTimeout(timeout)).catch(() => {})

    connection.close()

    await sleep(3_000)

    expect(statuses).to.deep.equal(['connected', 'closed'])
    expect(events.length).to.be.equal(1)
    expect(events[0].taskType).to.equal(MaintenanceTask.TaskTypeEnum.KeyPairUpdate)
  }).timeout(60_000)
})
