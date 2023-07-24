import 'mocha'
import 'isomorphic-fetch'

import {sleep} from '@icure/api'

import {assert} from 'chai'
import {getEnvVariables, TestVars} from '@icure/test-setup/types'
import {getEnvironmentInitializer, hcp1Username, hcp3Username, patUsername, setLocalStorage, TestUtils} from "../utils/test_utils"
import {IcureApi} from "../../icc-x-api"
import {User} from "../../icc-api/model/User"
import {Connection} from "../../icc-api/model/Connection"
import {Service} from "../../icc-api/model/Service"
import {Patient} from "../../icc-api/model/Patient"
import {Content} from "../../icc-api/model/Content"
import {CodeStub} from "../../icc-api/model/CodeStub"
import {Contact} from "../../icc-api/model/Contact"
import {ServiceByHcPartyFilter} from "../../icc-x-api/filters/ServiceByHcPartyFilter"
import {MaintenanceTaskByHcPartyAndTypeFilter} from "../../icc-x-api/filters/MaintenanceTaskByHcPartyAndTypeFilter"
import {MaintenanceTask} from "../../icc-api/model/MaintenanceTask"
import {v4 as uuid} from "uuid"
import {HealthElement} from "../../icc-api/model/HealthElement"
import {HealthElementByHcPartyTagCodeFilter} from "../../icc-x-api/filters/HealthElementByHcPartyTagCodeFilter"
import {PatientByHcPartyNameContainsFuzzyFilter} from "../../icc-x-api/filters/PatientByHcPartyNameContainsFuzzyFilter"
import {WebSocketWrapper} from "../../icc-x-api/utils/websocket"
import initApi = TestUtils.initApi
import {AllUsersFilter} from "../../icc-x-api/filters/AllUsersFilter"

setLocalStorage(fetch)

let env: TestVars
const testType = 'IC-TEST'
const testCode = 'TEST'

let api: IcureApi | undefined = undefined
let hcp1Api: IcureApi | undefined = undefined
let hcp1User: User | undefined = undefined

describe( 'Subscription API', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())

    if (env.backendType === 'oss') this.skip()

    api = await initApi(env, hcp3Username)

    hcp1Api = await initApi(env, hcp1Username)
    hcp1User = await hcp1Api.userApi.getCurrentUser()
  })

  async function doXOnYAndSubscribe<Y>(
    api: IcureApi,
    options: {},
    connectionPromise: Promise<Connection>,
    x: () => Promise<Y>,
    statusListener: (status: string) => void,
    eventReceivedPromiseReject: (reason?: any) => void,
    eventReceivedPromise: Promise<void>
  ) {
    const connection = (await connectionPromise)
      .onClosed(async () => {
        statusListener('CLOSED')
        await sleep(3_000)
      })
      .onConnected(async () => {
        statusListener('CONNECTED')
        await sleep(2_000)
        await x()
      })

    const timeout = setTimeout(eventReceivedPromiseReject, 20_000)
    await eventReceivedPromise.then(() => clearTimeout(timeout)).catch(() => {
    })

    connection.close()

    await sleep(3_000)
  }

  describe('Can subscribe to Data Samples', async () => {
    const subscribeAndCreateService = async (
      options: { connectionMaxRetry?: number; connectionRetryIntervalMs?: number },
      eventTypes: ('CREATE' | 'DELETE' | 'UPDATE')[],
      creationApi: IcureApi,
      subscriptionApi: IcureApi,
      supplier: () => Promise<void>
    ) => {
      const connectionPromise = async (
        options: { connectionMaxRetry?: number; connectionRetryIntervalMs?: number },
        dataOwnerId: string,
        eventListener: (ds: Service) => Promise<void>
      ) =>
        subscriptionApi!.contactApi.subscribeToServiceEvents(
          eventTypes,
          new ServiceByHcPartyFilter({
            hcpId: dataOwnerId,
          }),
          eventListener,
          options
        )

      const loggedUser = await creationApi!!.userApi.getCurrentUser()
      const events: Service[] = []
      const statuses: string[] = []

      let eventReceivedPromiseResolve!: (value: void | PromiseLike<void>) => void
      let eventReceivedPromiseReject!: (reason?: any) => void
      const eventReceivedPromise = new Promise<void>((res, rej) => {
        eventReceivedPromiseResolve = res
        eventReceivedPromiseReject = rej
      })

      await doXOnYAndSubscribe(
        creationApi!!,
        options,
        connectionPromise({}, loggedUser.healthcarePartyId!, async (ds) => {
          events.push(ds)
          eventReceivedPromiseResolve()
        }),
        supplier,
        (status) => {
          statuses.push(status)
        },
        eventReceivedPromiseReject,
        eventReceivedPromise
      )

      events?.forEach((event) => console.log(`Event : ${event}`))
      statuses?.forEach((status) => console.log(`Status : ${status}`))

      assert(events.length === 1, 'The events have not been recorded')
      assert(statuses.length === 2, 'The statuses have not been recorded')
    }

    const createService = async () => {
      const user = await api!!.userApi.getCurrentUser()

      const newPatient = new Patient({
        firstName: 'John',
        lastName: 'Snow',
        note: 'Winter is coming',
      })

      const newInstanceOfPatient = await api!!.patientApi.newInstance(
        user,
        newPatient
      )

      const patient = await api!!.patientApi.createPatientWithUser(
        user,
        newInstanceOfPatient
      )

      const newContact = new Contact({
        id: uuid(),
        services: [
          new Service({
            id: uuid(),
            labels: new Set([new CodeStub({type: testType, code: testCode})]),
            content: {en: new Content({stringValue: 'Hello world'})},
          })
        ]
      })

      const newInstanceOfContact = await api!!.contactApi.newInstance(
        user,
        patient,
        newContact
      )

      const createdContact = await api!!.contactApi.createContactWithUser(
        user,
        newInstanceOfContact
      )

      return {
        contact: createdContact,
        service: createdContact!!.services!![0],
        patient: patient,
      }
    }

    const deleteService = async () => {
      const { service, patient } = await createService()
      const user = await api!!.userApi.getCurrentUser()

      const contactToDeleteServices = await api!.contactApi
        .newInstance(
          user,
          patient,
          new Contact({
            id: uuid(),
            services: [new Service({
              id: service.id,
              created: service.created,
              modified: +new Date(),
              endOfLife: +new Date(),
            })]
          })
        )

      const contactToDelete = await api!.contactApi.createContactWithUser(
        user,
        contactToDeleteServices
      )
    }

    it('CREATE Service without options', async () => {
      await subscribeAndCreateService({}, ['CREATE'], api!!, api!!, async () => {
        await createService()
      })
    }).timeout(60000)

    it('CREATE Service with options', async () => {
      await subscribeAndCreateService(
        {
          connectionRetryIntervalMs: 10_000,
          connectionMaxRetry: 5,
        },
        ['CREATE'],
        api!!,
        api!!,
        async () => {
          await createService()
        }
      )
    }).timeout(60000)

    it('CREATE Service without options with another instance of api', async () => {
      const subscriptionApi = await initApi(env, hcp3Username)

      await subscribeAndCreateService({}, ['CREATE'], api!!, subscriptionApi!!, async () => {
        await createService()
      })
    }).timeout(60000)

    it('CREATE Service with options with another instance of api', async () => {
      const subscriptionApi = await initApi(env, hcp3Username)

      await subscribeAndCreateService(
        {
          connectionRetryIntervalMs: 10_000,
          connectionMaxRetry: 5,
        },
        ['CREATE'],
        api!!,
        subscriptionApi!!,
        async () => {
          await createService()
        }
      )
    }).timeout(60000)

    it('DELETE Service without options', async () => {
      await subscribeAndCreateService({}, ['DELETE'], api!!, api!!, async () => deleteService())
    }).timeout(60000)

    it('DELETE Service with options', async () => {
      await subscribeAndCreateService(
        {
          connectionRetryIntervalMs: 10_000,
          connectionMaxRetry: 5,
        },
        ['DELETE'],
        api!!,
        api!!,
        async () => deleteService()
      )
    }).timeout(60000)
  })

  describe('Can subscribe to MaintenanceTasks', async () => {
    const subscribeAndCreateMaintenanceTask = async (options: {}, eventTypes: ('CREATE' | 'DELETE' | 'UPDATE')[]) => {

      const loggedUser = await api!.userApi.getCurrentUser()

      const connectionPromise = async (options: {}, dataOwnerId: string, eventListener: (notification: MaintenanceTask) => Promise<void>) =>
        api!.maintenanceTaskApi.subscribeToMaintenanceTaskEvents(
          eventTypes,
          new MaintenanceTaskByHcPartyAndTypeFilter({
            healthcarePartyId: loggedUser!.healthcarePartyId!,
            type: MaintenanceTask.TaskTypeEnum.KEY_PAIR_UPDATE,
          }),
          eventListener,
          options
        )

      const events: MaintenanceTask[] = []
      const statuses: string[] = []

      let eventReceivedPromiseResolve!: (value: void | PromiseLike<void>) => void
      let eventReceivedPromiseReject!: (reason?: any) => void
      const eventReceivedPromise = new Promise<void>((res, rej) => {
        eventReceivedPromiseResolve = res
        eventReceivedPromiseReject = rej
      })
      await doXOnYAndSubscribe(
        api!!,
        options,
        connectionPromise({}, loggedUser.healthcarePartyId!, async (notification) => {
          events.push(notification)
          eventReceivedPromiseResolve()
        }),
        async () => {
          const notificationId = uuid()
          const notification = await api!.maintenanceTaskApi.newInstance(
            loggedUser,
            new MaintenanceTask({
              id: notificationId,
              status: 'pending',
              taskType: MaintenanceTask.TaskTypeEnum.KeyPairUpdate,
            })
          )
          const createdMaintenanceTask = await api!.maintenanceTaskApi.createMaintenanceTaskWithUser(loggedUser!!, notification)
          assert(!!createdMaintenanceTask)
          return createdMaintenanceTask
        },
        (status) => {
          statuses.push(status)
        },
        eventReceivedPromiseReject,
        eventReceivedPromise
      )

      events?.forEach((event) => console.log(`Event : ${event}`))
      statuses?.forEach((status) => console.log(`Status : ${status}`))

      assert(statuses.length < 2, 'The statuses have not been recorded')
      assert(statuses.length > 2, 'Connection has been reconnected')
      assert(statuses.length === 2, 'The statuses have not been recorded')
      assert(events.length === 1, 'The events have not been recorded')
    }

    it('CREATE MaintenanceTask without options', async () => {
      await subscribeAndCreateMaintenanceTask({}, ['CREATE'])
    }).timeout(60000)

    it('CREATE MaintenanceTask with options', async () => {
      await subscribeAndCreateMaintenanceTask(
        {
          connectionRetryIntervalMs: 10_000,
          connectionMaxRetry: 5,
        },
        ['CREATE']
      )
    }).timeout(60000)
  })

  describe('Can subscribe to HealthElements', async () => {
    const subscribeAndCreateHealthElement = async (options: {}, eventTypes: ('CREATE' | 'DELETE' | 'UPDATE')[]) => {
      const connectionPromise = async (options: {}, dataOwnerId: string, eventListener: (healthcareElement: HealthElement) => Promise<void>) =>
        api!.healthcareElementApi.subscribeToHealthElementEvents(
          eventTypes,
          new HealthElementByHcPartyTagCodeFilter({
            hcpId: hcp1User!.healthcarePartyId!,
            tagCode: testCode,
            tagType: testType,
          }),
          eventListener,
          options
        )

      const loggedUser = await api!!.userApi.getCurrentUser()
      const events: HealthElement[] = []
      const statuses: string[] = []

      let eventReceivedPromiseResolve!: (value: void | PromiseLike<void>) => void
      let eventReceivedPromiseReject!: (reason?: any) => void
      const eventReceivedPromise = new Promise<void>((res, rej) => {
        eventReceivedPromiseResolve = res
        eventReceivedPromiseReject = rej
      })

      await doXOnYAndSubscribe(
        api!!,
        options,
        connectionPromise({}, loggedUser.healthcarePartyId!, async (healthcareElement) => {
          events.push(healthcareElement)
          eventReceivedPromiseResolve()
        }),
        async () => {
          const user = await api!!.userApi.getCurrentUser()

          const patient = await api!!.patientApi.createPatientWithUser(
            user,
            await api!!.patientApi.newInstance(
              user,
              new Patient({
                firstName: 'John',
                lastName: 'Snow',
                note: 'Winter is coming',
              })
            )
          )

          await api!!.healthcareElementApi.createHealthElementWithUser(
            user,
            await api!!.healthcareElementApi.newInstance(
              user,
              patient,
              new HealthElement({
                note: 'Hero Syndrome',
                tags: [new CodeStub({id: 'id', code: testCode, type: testType})],
              })
            )
          )
        },
        (status) => {
          statuses.push(status)
        },
        eventReceivedPromiseReject,
        eventReceivedPromise
      )

      events?.forEach((event) => console.log(`Event : ${event}`))
      statuses?.forEach((status) => console.log(`Status : ${status}`))

      assert(events.length === 1, 'The events have not been recorded')
      assert(statuses.length === 2, 'The statuses have not been recorded')
    }

    it('CREATE HealthElement without options', async () => {
      await subscribeAndCreateHealthElement({}, ['CREATE'])
    }).timeout(60000)

    it('CREATE HealthElement with options', async () => {
      await subscribeAndCreateHealthElement(
        {
          connectionRetryIntervalMs: 10_000,
          connectionMaxRetry: 5,
        },
        ['CREATE']
      )
    }).timeout(60000)
  })

  describe('Can subscribe to Patients', async () => {
    const subscribeAndCreatePatient = async (options: {}, eventTypes: ('CREATE' | 'DELETE' | 'UPDATE')[]) => {
      const connectionPromise = async (options: {}, dataOwnerId: string, eventListener: (patient: Patient) => Promise<void>) => {
        await sleep(2000)
        return api!.patientApi.subscribeToPatientEvents(
          eventTypes,
          new PatientByHcPartyNameContainsFuzzyFilter({
            healthcarePartyId: loggedUser.healthcarePartyId!,
            searchString: 'John',
          }),
          eventListener,
          options
        )
      }

      const loggedUser = await api!!.userApi.getCurrentUser()

      const events: Patient[] = []
      const statuses: string[] = []

      let eventReceivedPromiseResolve!: (value: void | PromiseLike<void>) => void
      let eventReceivedPromiseReject!: (reason?: any) => void
      const eventReceivedPromise = new Promise<void>((res, rej) => {
        eventReceivedPromiseResolve = res
        eventReceivedPromiseReject = rej
      })

      await doXOnYAndSubscribe(
        api!!,
        options,
        connectionPromise(options, loggedUser.healthcarePartyId!, async (patient) => {
          events.push(patient)
          eventReceivedPromiseResolve()
        }),
        async () => {
          const user = await api!!.userApi.getCurrentUser()
          await api!!.patientApi.createPatientWithUser(
            user,
            await api!!.patientApi.newInstance(
              user,
              new Patient({
                firstName: 'John',
                lastName: 'Snow',
                note: 'Winter is coming',
              })
            )
          )
        },
        (status) => {
          statuses.push(status)
        },
        eventReceivedPromiseReject,
        eventReceivedPromise
      )

      events?.forEach((event) => console.log(`Event : ${event}`))
      statuses?.forEach((status) => console.log(`Status : ${status}`))

      assert(events.length === 1, 'The events have not been recorded')
      assert(statuses.length === 2, 'The statuses have not been recorded')
    }

    it('CREATE Patient without option', async () => {
      await subscribeAndCreatePatient({}, ['CREATE'])
    }).timeout(60000)

    it('CREATE Patient with options', async () => {
      await subscribeAndCreatePatient(
        {
          connectionRetryIntervalMs: 10_000,
          connectionMaxRetry: 5,
        },
        ['CREATE']
      )
    }).timeout(60000)
  })

  describe('Can subscribe to User', async () => {
    const subscribeAndCreateUser = async (options: {}, eventTypes: ('CREATE' | 'DELETE' | 'UPDATE')[]) => {
      const connectionPromise = async (options: {}, dataOwnerId: string, eventListener: (user: User) => Promise<void>) => {
        await sleep(2000)
        return api!.userApi.subscribeToUserEvents(eventTypes, new AllUsersFilter({}), eventListener, options)
      }

      const loggedUser = await api!!.userApi.getCurrentUser()

      await sleep(2000)

      const events: User[] = []
      const statuses: string[] = []

      let eventReceivedPromiseResolve!: (value: void | PromiseLike<void>) => void
      let eventReceivedPromiseReject!: (reason?: any) => void
      const eventReceivedPromise = new Promise<void>((res, rej) => {
        eventReceivedPromiseResolve = res
        eventReceivedPromiseReject = rej
      })

      await doXOnYAndSubscribe(
        api!!,
        options,
        connectionPromise(options, loggedUser.healthcarePartyId!, async (user) => {
          events.push(user)
          eventReceivedPromiseResolve()
        }),
        async () => {

          const patApi = await initApi(env, patUsername)

          const currentUser = await patApi.userApi.getCurrentUser()
          assert(currentUser)
        },
        (status) => {
          statuses.push(status)
        },
        eventReceivedPromiseReject,
        eventReceivedPromise
      )

      events?.forEach((event) => console.log(`Event : ${event}`))
      statuses?.forEach((status) => console.log(`Status : ${status}`))

      assert(events.length === 1, 'The events have not been recorded')
      assert(statuses.length === 2, 'The statuses have not been recorded')
    }

    it('CREATE User without options', async () => {
      await subscribeAndCreateUser({}, ['CREATE'])
    }).timeout(60000)

    it('CREATE User with options', async () => {
      await subscribeAndCreateUser(
        {
          connectionRetryIntervalMs: 10_000,
          connectionMaxRetry: 5,
        },
        ['CREATE']
      )
    }).timeout(60000)
  })

  describe('Retry mechanism', async () => {
    it('Should fails 10 times and then cut', async () => {
      const statuses: string[] = []

      const ws = await WebSocketWrapper.create(
        env!.iCureUrl.replace('http', 'ws').replace('rest', 'ws') + '/notification/subscribe',
        {
          getBearerToken: () => Promise.resolve(undefined),
          getIcureOtt: () => Promise.resolve('fake-token'),
        },
        10,
        500,
        {
          CONNECTED: [() => statuses.push('CONNECTED')],
          CLOSED: [() => statuses.push('CLOSED')],
          ERROR: [(ws, error) => statuses.push('ERROR')],
        },
        (data) => {
          throw new Error('Test')
        }
      )

      await sleep(20000)

      assert(statuses.length === 20, 'The statuses have not been recorded')
      assert(statuses.filter((status) => status === 'ERROR').length === 10, 'There should be 10 errors status')
      assert(statuses.filter((status) => status === 'CLOSED').length === 10, 'There should be 10 closed status')
    }).timeout(60000)
  })
})
