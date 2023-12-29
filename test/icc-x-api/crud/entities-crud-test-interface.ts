import { IcureApi } from '../../../icc-x-api'
import { randomUUID } from 'crypto'
import { Patient } from '../../../icc-api/model/Patient'
import { IdWithRev } from '../../../icc-api/model/IdWithRev'
import { AccessLog } from '../../../icc-api/model/AccessLog'
import { ListOfIds } from '../../../icc-api/model/ListOfIds'
import { DocIdentifier } from '../../../icc-api/model/DocIdentifier'
import { Agenda } from '../../../icc-api/model/Agenda'
import { Article } from '../../../icc-api/model/Article'
import { CalendarItem } from '../../../icc-api/model/CalendarItem'
import { CalendarItemType } from '../../../icc-api/model/CalendarItemType'
import { Classification } from '../../../icc-api/model/Classification'
import { ClassificationTemplate } from '../../../icc-api/model/ClassificationTemplate'
import { Contact } from '../../../icc-api/model/Contact'
import { Device } from '../../../icc-api/model/Device'
import { Document } from '../../../icc-api/model/Document'
import { Form } from '../../../icc-api/model/Form'
import { HealthcareParty } from '../../../icc-api/model/HealthcareParty'
import { HealthElement } from '../../../icc-api/model/HealthElement'
import { Insurance } from '../../../icc-api/model/Insurance'
import { Invoice } from '../../../icc-api/model/Invoice'
import { Keyword } from '../../../icc-api/model/Keyword'
import { MaintenanceTask } from '../../../icc-api/model/MaintenanceTask'
import { MedicalLocation } from '../../../icc-api/model/MedicalLocation'
import { Message } from '../../../icc-api/model/Message'
import { Place } from '../../../icc-api/model/Place'
import { Receipt } from '../../../icc-api/model/Receipt'
import { TimeTable } from '../../../icc-api/model/TimeTable'
import { Topic } from '../../../icc-api/model/Topic'

export interface CRUDInterface {
  encryptable: boolean
  skipDenied?: boolean
  cloudOnly?: boolean
  create(api: IcureApi, patient: Patient): Promise<IdWithRev>
  share(delegatorApi: IcureApi, delegateApi: IcureApi, entity: any): Promise<IdWithRev>
  deleteMany(api: IcureApi, ids: IdWithRev[]): Promise<Array<DocIdentifier>>
  delete(api: IcureApi, id: IdWithRev): Promise<DocIdentifier>
}

export const entities: { [key: string]: CRUDInterface } = {
  AccessLog: {
    encryptable: true,
    create: async (api: IcureApi, patient: Patient) => {
      const currentUser = await api.userApi.getCurrentUser()
      const accessLog = await api.accessLogApi.newInstance(currentUser, patient, { detail: randomUUID() })
      return api.accessLogApi.createAccessLogWithUser(currentUser, accessLog)
    },
    share: async (delegatorApi: IcureApi, delegateApi: IcureApi, entity: any) => {
      const delegateUser = await delegateApi.userApi.getCurrentUser()
      const delegateId = delegateUser.healthcarePartyId ?? delegateUser.patientId ?? delegateUser.deviceId
      if (!delegateId) {
        throw new Error('Cannot share with non data owner user')
      }
      return delegatorApi.accessLogApi.shareWith(delegateId, entity as AccessLog)
    },
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => api.accessLogApi.deleteAccessLogs(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.accessLogApi.deleteAccessLog(id.id!),
  },
  Agenda: {
    skipDenied: true,
    encryptable: false,
    create: async (api: IcureApi, _: Patient) => api.agendaApi.createAgenda(new Agenda({ id: randomUUID(), name: randomUUID() })),
    share: async (_: IcureApi, __: IcureApi, entity: any) => entity,
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => api.agendaApi.deleteAgendas(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.agendaApi.deleteAgenda(id.id!),
  },
  Article: {
    encryptable: false,
    create: async (api: IcureApi, _: Patient) => api.articleApi.createArticle(new Article({ id: randomUUID(), name: randomUUID() })),
    share: async (_: IcureApi, __: IcureApi, entity: any) => entity,
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => api.articleApi.deleteArticles(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.articleApi.deleteArticle(id.id!),
  },
  CalendarItem: {
    encryptable: true,
    create: async (api: IcureApi, _: Patient) => {
      const currentUser = await api.userApi.getCurrentUser()
      const item = await api.calendarItemApi.newInstance(currentUser, { title: randomUUID() })
      return api.calendarItemApi.createCalendarItemWithHcParty(currentUser, item)
    },
    share: async (delegatorApi: IcureApi, delegateApi: IcureApi, entity: any) => {
      const delegateUser = await delegateApi.userApi.getCurrentUser()
      const delegateId = delegateUser.healthcarePartyId ?? delegateUser.patientId ?? delegateUser.deviceId
      if (!delegateId) {
        throw new Error('Cannot share with non data owner user')
      }
      return delegatorApi.calendarItemApi.shareWith(delegateId, entity as CalendarItem)
    },
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => api.calendarItemApi.deleteCalendarItems(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.calendarItemApi.deleteCalendarItem(id.id!),
  },
  CalendarItemType: {
    skipDenied: true,
    encryptable: false,
    create: async (api: IcureApi, _: Patient) =>
      api.calendarItemTypeApi.createCalendarItemType(new CalendarItemType({ id: randomUUID(), color: randomUUID() })),
    share: async (_: IcureApi, __: IcureApi, entity: any) => entity,
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) =>
      api.calendarItemTypeApi.deleteCalendarItemTypes(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) =>
      api.calendarItemTypeApi.deleteCalendarItemTypes(new ListOfIds({ ids: [id.id!] })).then((r) => {
        if (r.length === 0) throw Error('No element deleted')
        else return r[0]
      }),
  },
  Classification: {
    encryptable: true,
    create: async (api: IcureApi, patient: Patient) => {
      const currentUser = await api.userApi.getCurrentUser()
      const item = await api.classificationApi.newInstance(currentUser, patient, { label: randomUUID() })
      return api.classificationApi.createClassification(item)
    },
    share: async (delegatorApi: IcureApi, delegateApi: IcureApi, entity: any) => {
      const delegateUser = await delegateApi.userApi.getCurrentUser()
      const delegateId = delegateUser.healthcarePartyId ?? delegateUser.patientId ?? delegateUser.deviceId
      if (!delegateId) {
        throw new Error('Cannot share with non data owner user')
      }
      return delegatorApi.classificationApi.shareWith(delegateId, entity as Classification)
    },
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) =>
      api.classificationApi.deleteClassifications(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.classificationApi.deleteClassification(id.id!),
  },
  ClassificationTemplate: {
    encryptable: false,
    create: async (api: IcureApi, _: Patient) =>
      api.classificationTemplateApi.createClassificationTemplate(new ClassificationTemplate({ id: randomUUID(), label: randomUUID() })),
    share: async (_: IcureApi, __: IcureApi, entity: any) => entity,
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) =>
      api.classificationTemplateApi.deleteClassificationTemplates(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.classificationTemplateApi.deleteClassificationTemplate(id.id!),
  },
  Contact: {
    encryptable: true,
    create: async (api: IcureApi, patient: Patient) => {
      const currentUser = await api.userApi.getCurrentUser()
      const item = await api.contactApi.newInstance(currentUser, patient, { descr: randomUUID() })
      return (await api.contactApi.createContactWithUser(currentUser, item))!
    },
    share: async (delegatorApi: IcureApi, delegateApi: IcureApi, entity: any) => {
      const delegateUser = await delegateApi.userApi.getCurrentUser()
      const delegateId = delegateUser.healthcarePartyId ?? delegateUser.patientId ?? delegateUser.deviceId
      if (!delegateId) {
        throw new Error('Cannot share with non data owner user')
      }
      return delegatorApi.contactApi.shareWith(delegateId, entity as Contact)
    },
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => api.contactApi.deleteContacts(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.contactApi.deleteContact(id.id!),
  },
  Device: {
    encryptable: false,
    create: async (api: IcureApi, _: Patient) => api.deviceApi.createDevice(new Device({ id: randomUUID(), name: randomUUID() })),
    share: async (_: IcureApi, __: IcureApi, entity: any) => entity,
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => api.deviceApi.deleteDevices(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.deviceApi.deleteDevice(id.id!),
  },
  Document: {
    encryptable: true,
    create: async (api: IcureApi, patient: Patient) => {
      const currentUser = await api.userApi.getCurrentUser()
      const item = await api.documentApi.newInstance(currentUser, patient, { name: randomUUID() })
      return api.documentApi.createDocument(item)
    },
    share: async (delegatorApi: IcureApi, delegateApi: IcureApi, entity: any) => {
      const delegateUser = await delegateApi.userApi.getCurrentUser()
      const delegateId = delegateUser.healthcarePartyId ?? delegateUser.patientId ?? delegateUser.deviceId
      if (!delegateId) {
        throw new Error('Cannot share with non data owner user')
      }
      return delegatorApi.documentApi.shareWith(delegateId, entity as Document)
    },
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => api.documentApi.deleteDocuments(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.documentApi.deleteDocument(id.id!),
  },
  Form: {
    encryptable: true,
    create: async (api: IcureApi, patient: Patient) => {
      const currentUser = await api.userApi.getCurrentUser()
      const item = await api.formApi.newInstance(currentUser, patient, { uniqueId: randomUUID() })
      return api.formApi.createForm(item)
    },
    share: async (delegatorApi: IcureApi, delegateApi: IcureApi, entity: any) => {
      const delegateUser = await delegateApi.userApi.getCurrentUser()
      const delegateId = delegateUser.healthcarePartyId ?? delegateUser.patientId ?? delegateUser.deviceId
      if (!delegateId) {
        throw new Error('Cannot share with non data owner user')
      }
      return delegatorApi.formApi.shareWith(delegateId, entity as Form)
    },
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => api.formApi.deleteForms(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.formApi.deleteForm(id.id!),
  },
  HealthcareParty: {
    encryptable: false,
    create: async (api: IcureApi, _: Patient) =>
      api.healthcarePartyApi.createHealthcareParty(new HealthcareParty({ id: randomUUID(), name: randomUUID() })),
    share: async (_: IcureApi, __: IcureApi, entity: any) => entity,
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) =>
      api.healthcarePartyApi.deleteHealthcareParties(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.healthcarePartyApi.deleteHealthcareParty(id.id!),
  },
  HealthcarePartyInGroup: {
    encryptable: false,
    cloudOnly: true,
    create: async (api: IcureApi, _: Patient) =>
      api.healthcarePartyApi.createHealthcareParty(new HealthcareParty({ id: randomUUID(), name: randomUUID() })),
    share: async (_: IcureApi, __: IcureApi, entity: any) => entity,
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => {
      const currentUser = await api.userApi.getCurrentUser()
      return api.healthcarePartyApi.deleteHealthcarePartiesInGroup(currentUser.groupId!, new ListOfIds({ ids: ids.map((it) => it.id!) }))
    },
    delete: async (api: IcureApi, id: IdWithRev) => {
      const currentUser = await api.userApi.getCurrentUser()
      return api.healthcarePartyApi.deleteHealthcarePartyInGroup(currentUser.groupId!, id.id!)
    },
  },
  HealthcareElement: {
    encryptable: true,
    create: async (api: IcureApi, patient: Patient) => {
      const currentUser = await api.userApi.getCurrentUser()
      const item = await api.healthcareElementApi.newInstance(currentUser, patient, { descr: randomUUID() })
      return api.healthcareElementApi.createHealthElementWithUser(currentUser, item)
    },
    share: async (delegatorApi: IcureApi, delegateApi: IcureApi, entity: any) => {
      const delegateUser = await delegateApi.userApi.getCurrentUser()
      const delegateId = delegateUser.healthcarePartyId ?? delegateUser.patientId ?? delegateUser.deviceId
      if (!delegateId) {
        throw new Error('Cannot share with non data owner user')
      }
      return delegatorApi.healthcareElementApi.shareWith(delegateId, entity as HealthElement)
    },
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) =>
      api.healthcareElementApi.deleteHealthElements(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.healthcareElementApi.deleteHealthElement(id.id!),
  },
  Insurance: {
    encryptable: false,
    skipDenied: true,
    create: async (api: IcureApi, _: Patient) => api.insuranceApi.createInsurance(new Insurance({ id: randomUUID(), code: randomUUID() })),
    share: async (_: IcureApi, __: IcureApi, entity: any) => entity,
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => {
      const ret: DocIdentifier[] = []
      for (const id of ids) {
        const result = await api.insuranceApi.deleteInsurance(id.id!)
        ret.push(result)
      }
      return ret
    },
    delete: async (api: IcureApi, id: IdWithRev) => api.insuranceApi.deleteInsurance(id.id!),
  },
  Invoice: {
    encryptable: false,
    skipDenied: true,
    create: async (api: IcureApi, _: Patient) => api.invoiceApi.createInvoice(new Invoice({ id: randomUUID(), recipientId: randomUUID() })),
    share: async (_: IcureApi, __: IcureApi, entity: any) => entity,
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => {
      const ret: DocIdentifier[] = []
      for (const id of ids) {
        const result = await api.invoiceApi.deleteInvoice(id.id!)
        ret.push(result)
      }
      return ret
    },
    delete: async (api: IcureApi, id: IdWithRev) => api.invoiceApi.deleteInvoice(id.id!),
  },
  Keyword: {
    encryptable: false,
    skipDenied: true,
    create: async (api: IcureApi, _: Patient) => api.keywordApi.createKeyword(new Keyword({ id: randomUUID(), value: randomUUID() })),
    share: async (_: IcureApi, __: IcureApi, entity: any) => entity,
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => api.keywordApi.deleteKeywords(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) =>
      api.keywordApi.deleteKeywords(new ListOfIds({ ids: [id.id!] })).then((r) => {
        if (r.length === 0) throw new Error('No keyword deleted')
        else return r[0]
      }),
  },
  MaintenanceTask: {
    encryptable: true,
    create: async (api: IcureApi, _: Patient) => {
      const currentUser = await api.userApi.getCurrentUser()
      const item = await api.maintenanceTaskApi.newInstance(currentUser, {})
      return (await api.maintenanceTaskApi.createMaintenanceTaskWithUser(currentUser, item))!
    },
    share: async (delegatorApi: IcureApi, delegateApi: IcureApi, entity: any) => {
      const delegateUser = await delegateApi.userApi.getCurrentUser()
      const delegateId = delegateUser.healthcarePartyId ?? delegateUser.patientId ?? delegateUser.deviceId
      if (!delegateId) {
        throw new Error('Cannot share with non data owner user')
      }
      return delegatorApi.maintenanceTaskApi.shareWith(delegateId, entity as MaintenanceTask)
    },
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => {
      const currentUser = await api.userApi.getCurrentUser()
      return api.maintenanceTaskApi.deleteMaintenanceTasksWithUser(currentUser, new ListOfIds({ ids: ids.map((it) => it.id!) }))
    },
    delete: async (api: IcureApi, id: IdWithRev) => {
      const currentUser = await api.userApi.getCurrentUser()
      return api.maintenanceTaskApi.deleteMaintenanceTaskWithUser(currentUser, id.id!)
    },
  },
  MedicalLocation: {
    encryptable: false,
    skipDenied: true,
    create: async (api: IcureApi, _: Patient) =>
      api.medicalLocationApi.createMedicalLocation(new MedicalLocation({ id: randomUUID(), nihii: randomUUID() })),
    share: async (_: IcureApi, __: IcureApi, entity: any) => entity,
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) =>
      api.medicalLocationApi.deleteMedicalLocations(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) =>
      api.medicalLocationApi.deleteMedicalLocations(new ListOfIds({ ids: [id.id!] })).then((r) => {
        if (r.length === 0) throw new Error('No medical location deleted')
        else return r[0]
      }),
  },
  Message: {
    encryptable: true,
    create: async (api: IcureApi, _: Patient) => {
      const currentUser = await api.userApi.getCurrentUser()
      const item = await api.messageApi.newInstance(currentUser, {})
      return api.messageApi.createMessage(item)
    },
    share: async (delegatorApi: IcureApi, delegateApi: IcureApi, entity: any) => {
      const delegateUser = await delegateApi.userApi.getCurrentUser()
      const delegateId = delegateUser.healthcarePartyId ?? delegateUser.patientId ?? delegateUser.deviceId
      if (!delegateId) {
        throw new Error('Cannot share with non data owner user')
      }
      return delegatorApi.messageApi.shareWith(delegateId, entity as Message, [])
    },
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => api.messageApi.deleteMessages(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.messageApi.deleteMessage(id.id!),
  },
  Patient: {
    encryptable: true,
    create: async (api: IcureApi, _: Patient) => {
      const currentUser = await api.userApi.getCurrentUser()
      const item = await api.patientApi.newInstance(currentUser, {})
      return api.patientApi.createPatientWithUser(currentUser, item)
    },
    share: async (delegatorApi: IcureApi, delegateApi: IcureApi, entity: any) => {
      const delegateUser = await delegateApi.userApi.getCurrentUser()
      const delegateId = delegateUser.healthcarePartyId ?? delegateUser.patientId ?? delegateUser.deviceId
      if (!delegateId) {
        throw new Error('Cannot share with non data owner user')
      }
      return delegatorApi.patientApi.shareWith(delegateId, entity as Patient, [])
    },
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => api.patientApi.deletePatients(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.patientApi.deletePatient(id.id!),
  },
  Place: {
    encryptable: false,
    skipDenied: true,
    create: async (api: IcureApi, _: Patient) => api.placeApi.createPlace(new Place({ id: randomUUID(), name: randomUUID() })),
    share: async (_: IcureApi, __: IcureApi, entity: any) => entity,
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => api.placeApi.deletePlaces(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) =>
      api.placeApi.deletePlaces(new ListOfIds({ ids: [id.id!] })).then((r) => {
        if (r.length === 0) throw new Error('No place deleted')
        else return r[0]
      }),
  },
  Receipt: {
    encryptable: true,
    create: async (api: IcureApi, _: Patient) => {
      const currentUser = await api.userApi.getCurrentUser()
      const item = await api.receiptApi.newInstance(currentUser, {})
      return api.receiptApi.createReceipt(item)
    },
    share: async (delegatorApi: IcureApi, delegateApi: IcureApi, entity: any) => {
      const delegateUser = await delegateApi.userApi.getCurrentUser()
      const delegateId = delegateUser.healthcarePartyId ?? delegateUser.patientId ?? delegateUser.deviceId
      if (!delegateId) {
        throw new Error('Cannot share with non data owner user')
      }
      return delegatorApi.receiptApi.shareWith(delegateId, entity as Receipt)
    },
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => api.receiptApi.deleteReceipts(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.receiptApi.deleteReceipt(id.id!),
  },
  TimeTable: {
    encryptable: true,
    create: async (api: IcureApi, _: Patient) => {
      const currentUser = await api.userApi.getCurrentUser()
      const item = await api.timetableApi.newInstance(currentUser, {})
      return api.timetableApi.createTimeTable(item)
    },
    share: async (delegatorApi: IcureApi, delegateApi: IcureApi, entity: any) => {
      const delegateUser = await delegateApi.userApi.getCurrentUser()
      const delegateId = delegateUser.healthcarePartyId ?? delegateUser.patientId ?? delegateUser.deviceId
      if (!delegateId) {
        throw new Error('Cannot share with non data owner user')
      }
      return delegatorApi.timetableApi.shareWith(delegateId, entity as TimeTable)
    },
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => api.timetableApi.deleteTimeTables(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.timetableApi.deleteTimeTable(id.id!),
  },
  Topic: {
    encryptable: true,
    cloudOnly: true,
    create: async (api: IcureApi, patient: Patient) => {
      const currentUser = await api.userApi.getCurrentUser()
      const item = await api.topicApi.newInstance(currentUser, patient)
      return api.topicApi.createTopic(item)
    },
    share: async (delegatorApi: IcureApi, delegateApi: IcureApi, entity: any) => {
      const delegateUser = await delegateApi.userApi.getCurrentUser()
      const delegateId = delegateUser.healthcarePartyId ?? delegateUser.patientId ?? delegateUser.deviceId
      if (!delegateId) {
        throw new Error('Cannot share with non data owner user')
      }
      return delegatorApi.topicApi.shareWith(delegateId, entity as Topic)
    },
    deleteMany: async (api: IcureApi, ids: IdWithRev[]) => api.topicApi.deleteTopics(new ListOfIds({ ids: ids.map((it) => it.id!) })),
    delete: async (api: IcureApi, id: IdWithRev) => api.topicApi.deleteTopic(id.id!),
  },
}
