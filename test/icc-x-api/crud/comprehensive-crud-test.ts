import 'isomorphic-fetch'
import { before } from 'mocha'
import {
  createNewHcpApi,
  getEnvironmentInitializer,
  hcp1Username,
  isLiteTest,
  itNoLite,
  patUsername,
  setLocalStorage,
  TestUtils,
} from '../../utils/test_utils'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import initMasterApi = TestUtils.initMasterApi
import { hex2ua, IcureApi, RSAUtils } from '../../../icc-x-api'
import initApi = TestUtils.initApi
import * as chaiAsPromised from 'chai-as-promised'
import { expect, use as chaiUse } from 'chai'
import { entities } from './entities-crud-test-interface'
import { Patient } from '../../../icc-api/model/Patient'
import { IdWithRev } from '../../../icc-api/model/IdWithRev'
import { randomUUID, webcrypto } from 'crypto'
import { TestCryptoStrategies } from '../../utils/TestCryptoStrategies'
chaiUse(chaiAsPromised)

setLocalStorage(fetch)

type OpType = 'create' | 'delete'
type ApisWithRole = { allowed: IcureApi; denied?: IcureApi }

let masterApi: IcureApi
let hcpApi: IcureApi
let patientApi: IcureApi
let noPermissionsApi: IcureApi
let patient: Patient
let entitiesPermissions: { [key: string]: { [key in OpType]: ApisWithRole } }

let env: TestVars

describe('CRUD Test', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    masterApi = await initMasterApi(env)
    hcpApi = await initApi(env, hcp1Username)
    patientApi = await initApi(env, patUsername)
    const patientUser = await patientApi.userApi.getCurrentUser()
    patient = await patientApi.patientApi.getPatientWithUser(patientUser, patientUser.patientId!)
    const { api, credentials, user } = await createNewHcpApi(env)
    if (!isLiteTest()) await masterApi.userApi.addRoles(user.id!, ['BASIC_USER'])

    const RSA = new RSAUtils(webcrypto as any)
    const keys = {
      publicKey: await RSA.importKey('spki', hex2ua(credentials.publicKey), ['encrypt'], 'sha-1'),
      privateKey: await RSA.importKey('pkcs8', hex2ua(credentials.privateKey), ['decrypt'], 'sha-1'),
    }

    noPermissionsApi = await IcureApi.initialise(
      env.iCureUrl,
      { username: credentials.user, password: credentials.password },
      new TestCryptoStrategies(keys),
      webcrypto as any,
      fetch
    )

    entitiesPermissions = {
      AccessLog: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: hcpApi, denied: hcpApi },
      },
      Agenda: {
        create: { allowed: masterApi },
        delete: { allowed: hcpApi, denied: patientApi },
      },
      Article: {
        create: { allowed: masterApi, denied: patientApi },
        delete: { allowed: masterApi, denied: hcpApi },
      },
      CalendarItem: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: hcpApi, denied: hcpApi },
      },
      CalendarItemType: {
        create: { allowed: masterApi },
        delete: { allowed: hcpApi, denied: patientApi },
      },
      Classification: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: hcpApi, denied: hcpApi },
      },
      ClassificationTemplate: {
        create: { allowed: masterApi, denied: patientApi },
        delete: { allowed: masterApi, denied: hcpApi },
      },
      Contact: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: hcpApi, denied: hcpApi },
      },
      Device: {
        create: { allowed: masterApi },
        delete: { allowed: hcpApi, denied: patientApi },
      },
      Document: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: hcpApi, denied: hcpApi },
      },
      Form: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: hcpApi, denied: hcpApi },
      },
      HealthcarePartyInGroup: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: masterApi, denied: patientApi },
      },
      HealthcareParty: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: masterApi, denied: patientApi },
      },
      HealthcareElement: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: hcpApi, denied: hcpApi },
      },
      Insurance: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: masterApi, denied: patientApi },
      },
      Invoice: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: masterApi, denied: patientApi },
      },
      Keyword: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: masterApi, denied: patientApi },
      },
      MaintenanceTask: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: hcpApi, denied: hcpApi },
      },
      MedicalLocation: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: masterApi, denied: patientApi },
      },
      Message: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: hcpApi, denied: hcpApi },
      },
      Patient: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: hcpApi, denied: hcpApi },
      },
      Place: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: masterApi, denied: patientApi },
      },
      Receipt: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: hcpApi, denied: hcpApi },
      },
      TimeTable: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: hcpApi, denied: hcpApi },
      },
      Topic: {
        create: { allowed: masterApi, denied: noPermissionsApi },
        delete: { allowed: hcpApi, denied: hcpApi },
      },
    }
  })

  Object.entries(entities)
    .filter(([, operations]) => {
      return !isLiteTest() || !operations.cloudOnly
    })
    .forEach(([entityType, operations]) => {
      it(`A user with create permissions can create a ${entityType}`, async () => {
        const api = entitiesPermissions[entityType].create.allowed
        const entity = await operations.create(api, patient)
        expect(entity.rev).not.to.be.undefined
      })

      itNoLite(`A user without create permissions cannot create a ${entityType}`, async function () {
        if (!!operations.skipDenied) this.skip()
        const api = entitiesPermissions[entityType].create.denied
        if (!api) this.skip()
        await expect(operations.create(api, patient)).to.be.rejected
      })

      it(`A user can delete many ${entityType} if they have access to them`, async function () {
        if (!operations.encryptable) {
          this.skip()
        }
        const creationApi = entitiesPermissions[entityType].create.allowed
        const api = entitiesPermissions[entityType].delete.allowed
        const notAccessibleEntities: IdWithRev[] = []
        for (let i = 0; i <= 5; i++) {
          const entity = await operations.create(creationApi, patient)
          notAccessibleEntities.push(entity)
        }
        const accessibleEntities: IdWithRev[] = []
        for (let i = 0; i <= 5; i++) {
          const entity = await operations.create(creationApi, patient).then((e) => {
            return operations.share(creationApi, api, e)
          })
          accessibleEntities.push(entity)
        }
        const result = await operations.deleteMany(api, isLiteTest() ? accessibleEntities : notAccessibleEntities.concat(accessibleEntities))
        expect(result.length).to.be.equal(accessibleEntities.length)
        result.forEach((el) => {
          expect(accessibleEntities.find((it) => it.id === el.id)).not.to.be.undefined
        })
      })

      itNoLite(`A user can delete many ${entityType} if they have the correct role`, async function () {
        if (!!operations.encryptable) this.skip()
        const creationApi = entitiesPermissions[entityType].create.allowed
        const api = entitiesPermissions[entityType].delete.allowed
        const entities: IdWithRev[] = []
        for (let i = 0; i <= 5; i++) {
          const entity = await operations.create(creationApi, patient)
          entities.push(entity)
        }
        const result = await operations.deleteMany(api, entities)
        expect(result.length).to.be.equal(entities.length)
        result.forEach((el) => {
          expect(entities.find((it) => it.id === el.id)).not.to.be.undefined
        })
      })

      itNoLite(`A user cannot delete many ${entityType} if they do not have the correct role`, async function () {
        if (!!operations.skipDenied) this.skip()
        const creationApi = entitiesPermissions[entityType].create.allowed
        const api = entitiesPermissions[entityType].delete.denied
        if (!api) {
          throw new Error('An API is required to perform this test')
        }
        const entities: IdWithRev[] = []
        for (let i = 0; i <= 5; i++) {
          const entity = await operations.create(creationApi, patient)
          entities.push(entity)
        }
        await operations.deleteMany(api, entities).then(
          (result) => {
            expect(result).to.be.empty
          },
          () => {
            expect(true).to.be.eq(true, 'Response should be empty or promise rejected')
          }
        )
      })

      it(`A user can delete a single ${entityType} if they have access to it`, async function () {
        const creationApi = entitiesPermissions[entityType].create.allowed
        const api = entitiesPermissions[entityType].delete.allowed
        const entity = await operations.create(creationApi, patient).then((e) => {
          return operations.share(creationApi, api, e)
        })
        const result = await operations.delete(api, entity)
        expect(result.id).to.be.equal(entity.id)
      })

      itNoLite(`A user cannot delete a single ${entityType} if they do not have access to it`, async function () {
        if (!!operations.skipDenied) {
          this.skip()
        }
        const creationApi = entitiesPermissions[entityType].create.allowed
        const api = entitiesPermissions[entityType].delete.denied
        if (!api) {
          throw new Error('An API is required to perform this test')
        }
        const entity = await operations.create(creationApi, patient)
        await expect(operations.delete(api, entity)).to.be.rejected
      })

      it(`A user cannot delete a single ${entityType} that does not exist`, async function () {
        const api = entitiesPermissions[entityType].delete.allowed
        await expect(operations.delete(api, new IdWithRev({ id: randomUUID() }))).to.be.rejected
      })
    })
})
