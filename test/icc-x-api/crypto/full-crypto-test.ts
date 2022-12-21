// import { Api, Apis, hex2ua, IccCryptoXApi, pkcs8ToJwk, spkiToJwk, ua2hex } from '../../../icc-x-api'
// import { v4 as uuid } from 'uuid'
// import { Patient } from '../../../icc-api/model/Patient'
// import { Contact } from '../../../icc-api/model/Contact'
// import { HealthElement } from '../../../icc-api/model/HealthElement'
// import { CalendarItem } from '../../../icc-api/model/CalendarItem'
// import { EncryptedEntity, EncryptedParentEntity, HealthcareParty, Service, User } from '../../../icc-api/model/models'
// import { before, describe, it } from 'mocha'
//
// import { webcrypto } from 'crypto'
// import 'isomorphic-fetch'
//
// import { expect } from 'chai'
// import { getEnvironmentInitializer, getEnvVariables, getTempEmail, hcp1Username, setLocalStorage, TestVars } from '../../utils/test_utils'
//
// setLocalStorage(fetch)
//
// type TestedEntity = 'Patient' | 'Contact' | 'HealthElement' | 'CalendarItem'
//
// interface EntityFacade<T extends EncryptedEntity> {
//   create: (api: Apis, record: Omit<T, 'rev'>) => Promise<T>
//   get: (api: Apis, id: string) => Promise<T>
//   share: (api: Apis, parent: EncryptedParentEntity | null, record: T, dataOwnerId: string) => Promise<T>
//   isDecrypted: (entityToCheck: T) => Promise<boolean>
// }
//
// type EntityCreator<T> = (api: Apis, id: string, user: User, patient?: Patient, delegateIds?: string[]) => Promise<T>
//
// interface EntityFacades {
//   Patient: EntityFacade<Patient>
//   Contact: EntityFacade<Contact>
//   HealthElement: EntityFacade<HealthElement>
//   CalendarItem: EntityFacade<CalendarItem>
// }
//
// interface EntityCreators {
//   Patient: EntityCreator<Patient>
//   Contact: EntityCreator<Contact>
//   HealthElement: EntityCreator<HealthElement>
//   CalendarItem: EntityCreator<CalendarItem>
// }
//
// const facades: EntityFacades = {
//   Patient: {
//     create: async (api, r) => api.patientApi.createPatientWithUser(await api.userApi.getCurrentUser(), r),
//     get: async (api, id) => api.patientApi.getPatientWithUser(await api.userApi.getCurrentUser(), id),
//     share: async (api, p, r, doId) => {
//       const user = await api.userApi.getCurrentUser()
//       const ownerId = api.dataOwnerApi.getDataOwnerOf(user)
//       const [dels, eks] = await api.cryptoApi.extractDelegationsSFKsAndEncryptionSKs(r, ownerId)
//       return api.patientApi.modifyPatientWithUser(
//         await api.userApi.getCurrentUser(),
//         await api.cryptoApi.addDelegationsAndEncryptionKeys(p, r, ownerId, doId, dels[0], eks[0])
//       )
//     },
//     isDecrypted: async (entityToCheck) => {
//       return entityToCheck.note != undefined
//     },
//   } as EntityFacade<Patient>,
//   Contact: {
//     create: async (api, r) => api.contactApi.createContactWithUser(await api.userApi.getCurrentUser(), r),
//     get: async (api, id) => api.contactApi.getContactWithUser(await api.userApi.getCurrentUser(), id),
//     share: async (api, p, r, doId) => {
//       const user = await api.userApi.getCurrentUser()
//       const ownerId = api.dataOwnerApi.getDataOwnerOf(user)
//       const [dels, eks] = await api.cryptoApi.extractDelegationsSFKsAndEncryptionSKs(r, ownerId)
//       return api.contactApi.modifyContactWithUser(
//         await api.userApi.getCurrentUser(),
//         await api.cryptoApi.addDelegationsAndEncryptionKeys(p, r, ownerId, doId, dels[0], eks[0])
//       )
//     },
//     isDecrypted: async (entityToCheck) => {
//       return entityToCheck.services?.[0].content != undefined && Object.entries(entityToCheck.services?.[0].content).length > 0
//     },
//   } as EntityFacade<Contact>,
//   HealthElement: {
//     create: async (api, r) => api.healthcareElementApi.createHealthElementWithUser(await api.userApi.getCurrentUser(), r),
//     get: async (api, id) => api.healthcareElementApi.getHealthElementWithUser(await api.userApi.getCurrentUser(), id),
//     share: async (api, p, r, doId) => {
//       const user = await api.userApi.getCurrentUser()
//       const ownerId = api.dataOwnerApi.getDataOwnerOf(user)
//       const [dels, eks] = await api.cryptoApi.extractDelegationsSFKsAndEncryptionSKs(r, ownerId)
//       return api.healthcareElementApi.modifyHealthElementWithUser(
//         await api.userApi.getCurrentUser(),
//         await api.cryptoApi.addDelegationsAndEncryptionKeys(p, r, ownerId, doId, dels[0], eks[0])
//       )
//     },
//     isDecrypted: async (entityToCheck) => {
//       return entityToCheck.descr != undefined
//     },
//   } as EntityFacade<HealthElement>,
//   CalendarItem: {
//     create: async (api, r) => api.calendarItemApi.createCalendarItemWithHcParty(await api.userApi.getCurrentUser(), r),
//     get: async (api, id) => api.calendarItemApi.getCalendarItemWithUser(await api.userApi.getCurrentUser(), id),
//     share: async (api, p, r, doId) => {
//       const user = await api.userApi.getCurrentUser()
//       const ownerId = api.dataOwnerApi.getDataOwnerOf(user)
//       const [dels, eks] = await api.cryptoApi.extractDelegationsSFKsAndEncryptionSKs(r, ownerId)
//       return api.calendarItemApi.modifyCalendarItemWithHcParty(
//         await api.userApi.getCurrentUser(),
//         await api.cryptoApi.addDelegationsAndEncryptionKeys(p, r, ownerId, doId, dels[0], eks[0])
//       )
//     },
//     isDecrypted: async (entityToCheck) => {
//       return entityToCheck.title != undefined
//     },
//   } as EntityFacade<CalendarItem>,
// }
// const patientFacades = Object.entries(facades)
//   .filter((f) => f[0] !== 'Patient')
//   .reduce((prev, curr) => ({ ...prev, [curr[0]]: curr[1] }), {})
//
// const privateKeys = {} as Record<string, Record<string, string>>
// const users: { user: User; password: string }[] = []
// let delegateUser: User | undefined = undefined
// let delegateHcp: HealthcareParty | undefined = undefined
// let delegateHcpPassword: string | undefined = undefined
//
// let userGivingAccessBack: User | undefined = undefined
// let userGivingAccessBackPassword: string | undefined = undefined
// let hcpGivingAccessBack: HealthcareParty | undefined = undefined
//
// const entities: EntityCreators = {
//   Patient: ({ patientApi }, id, user, _, delegateIds) => {
//     return patientApi.newInstance(user, new Patient({ id, firstName: 'test', lastName: 'test', note: 'data', dateOfBirth: 20000101 }), delegateIds)
//   },
//   Contact: ({ contactApi }, id, user, patient, delegateIds) => {
//     return contactApi.newInstance(
//       user,
//       patient!,
//       new Contact({ id, services: [new Service({ label: 'svc', content: { fr: { stringValue: 'data' } } })] }),
//       false,
//       delegateIds
//     )
//   },
//   HealthElement: ({ healthcareElementApi }, id, user, patient, delegateIds) => {
//     return healthcareElementApi.newInstance(user, patient!, new HealthElement({ id, descr: 'HE' }), false, delegateIds)
//   },
//   CalendarItem: ({ calendarItemApi }, id, user, patient, delegateIds) => {
//     return calendarItemApi.newInstancePatient(user, patient!, new CalendarItem({ id, title: 'CI' }), delegateIds)
//   },
// }
//
// const userDefinitions: Record<string, (user: User, api: Apis) => Promise<User>> = {
//   'one available key and one lost key recoverable through transfer keys': async (user: User, { cryptoApi, maintenanceTaskApi }) => {
//     const { publicKey } = await cryptoApi.addNewKeyPairForOwnerId(maintenanceTaskApi, user, (user.healthcarePartyId ?? user.patientId)!, true, false)
//     delete privateKeys[user.login!][publicKey]
//     return user
//   },
//   'two available keys': async (user: User, { cryptoApi, maintenanceTaskApi }) => {
//     const { publicKey: newPubKey, privateKey: newPrivKey } = await cryptoApi.RSA.generateKeyPair()
//     const newPublicKeyHex = ua2hex(await cryptoApi.RSA.exportKey(newPubKey, 'spki'))
//     const newPrivateKeyHex = ua2hex(await cryptoApi.RSA.exportKey(newPrivKey, 'pkcs8'))
//
//     const { privateKey, publicKey } = await cryptoApi.addRawKeyPairForOwnerId(maintenanceTaskApi, user, (user.healthcarePartyId ?? user.patientId)!, {
//       publicKey: newPublicKeyHex,
//       privateKey: newPrivateKeyHex,
//     })
//     privateKeys[user.login!] = { ...(privateKeys[user.login!] ?? {}), [publicKey]: privateKey }
//     return user
//   },
//   'a single available key in old format': async (user: User) => user,
//   'one lost key and one available key': async (user: User, { cryptoApi, maintenanceTaskApi }) => {
//     const { privateKey, publicKey } = await cryptoApi.addNewKeyPairForOwnerId(
//       maintenanceTaskApi,
//       user,
//       (user.healthcarePartyId ?? user.patientId)!,
//       false,
//       false
//     )
//     privateKeys[user.login!] = { [publicKey]: privateKey }
//     return user
//   },
//   'one lost key and one upgraded available key thanks to delegate who gave access back to previous data': async (user: User, api) => {
//     const userDataOwnerId = api.dataOwnerApi.getDataOwnerOf(user)
//     const { privateKey, publicKey } = await api.cryptoApi.addNewKeyPairForOwnerId(
//       api.maintenanceTaskApi,
//       user,
//       api.dataOwnerApi.getDataOwnerOf(user),
//       true,
//       false
//     )
//     privateKeys[user.login!] = { [publicKey]: privateKey }
//
//     const delegateApi = await getApiAndAddPrivateKeysForUser(env!.iCureUrl, userGivingAccessBack!, userGivingAccessBackPassword!)
//     await delegateApi.cryptoApi.giveAccessBackTo(userGivingAccessBack!, userDataOwnerId, publicKey)
//
//     return user
//   },
// }
//
// async function makeKeyPair(cryptoApi: IccCryptoXApi, login: string) {
//   const { publicKey, privateKey } = await cryptoApi.RSA.generateKeyPair()
//   const publicKeyHex = ua2hex(await cryptoApi.RSA.exportKey(publicKey!, 'spki'))
//   privateKeys[login] = { [publicKeyHex]: ua2hex((await cryptoApi.RSA.exportKey(privateKey!, 'pkcs8')) as ArrayBuffer) }
//   return publicKeyHex
// }
//
// async function getApiAndAddPrivateKeysForUser(iCureUrl: string, u: User, password: string, forceBasic = false, autoLogin = true) {
//   const api = await Api(iCureUrl, u.login!, password, webcrypto as unknown as Crypto, fetch, forceBasic, autoLogin)
//   await Object.entries(privateKeys[u.login!]).reduce(async (p, [pubKey, privKey]) => {
//     await p
//     await api.cryptoApi.cacheKeyPair({ publicKey: spkiToJwk(hex2ua(pubKey)), privateKey: pkcs8ToJwk(hex2ua(privKey)) })
//   }, Promise.resolve())
//   return api
// }
//
// async function createPartialsForHcp(entityFacades: EntityFacades, entityCreators: EntityCreators, user: User, password: string) {
//   await Object.entries(entityFacades).reduce(async (p, f) => {
//     const prev = await p
//
//     const type = f[0]
//     const facade = f[1]
//     const api1 = await getApiAndAddPrivateKeysForUser(env!.iCureUrl, user, password, true, false)
//
//     const parent = type !== 'Patient' ? await api1.patientApi.getPatientWithUser(user, `partial-${user.id}-Patient`) : undefined
//
//     const record = await entityCreators[type as TestedEntity](api1, `partial-${user.id}-${type}`, user, parent, [hcpGivingAccessBack!.id!])
//
//     prev.push(await facade.create(api1, record))
//
//     return prev
//   }, Promise.resolve([] as EncryptedEntity[]))
// }
//
// async function createPartialsForPatient(entityFacades: EntityFacades, entityCreators: EntityCreators, user: User, password: string) {
//   await Object.entries(entityFacades)
//     .filter((it) => it[0] !== 'Patient')
//     .reduce(async (p, f) => {
//       const prev = await p
//
//       const type = f[0]
//       const facade = f[1]
//       const api1 = await getApiAndAddPrivateKeysForUser(env!.iCureUrl, user, password, true, false)
//
//       const parent = await api1.patientApi.getPatientWithUser(user, user.patientId!)
//
//       const record = await entityCreators[type as TestedEntity](api1, `partial-${user.id}-${type}`, user, parent, [hcpGivingAccessBack!.id!])
//
//       prev.push(await facade.create(api1, record))
//
//       return prev
//     }, Promise.resolve([] as EncryptedEntity[]))
// }
//
// let env: TestVars
// let apis: { [key: string]: Apis }
//
// describe('Full battery of tests on crypto and keys', async function () {
//   before(async function () {
//     this.timeout(6000000)
//     const initializer = await getEnvironmentInitializer()
//     env = await initializer.execute(getEnvVariables())
//
//     const api = await Api(
//       env!.iCureUrl,
//       env!.dataOwnerDetails[hcp1Username].user,
//       env!.dataOwnerDetails[hcp1Username].password,
//       webcrypto as unknown as Crypto
//     )
//     const user = await api.userApi.getCurrentUser()
//     const dataOwnerId = api.dataOwnerApi.getDataOwnerOf(user)
//     const jwk = {
//       publicKey: spkiToJwk(hex2ua(env!.dataOwnerDetails[hcp1Username].publicKey)),
//       privateKey: pkcs8ToJwk(hex2ua(env!.dataOwnerDetails[hcp1Username].privateKey)),
//     }
//     await api.cryptoApi.cacheKeyPair(jwk)
//     await api.cryptoApi.keyStorage.storeKeyPair(`${dataOwnerId}.${env!.dataOwnerDetails[hcp1Username].publicKey.slice(-32)}`, jwk)
//
//     const { userApi, patientApi, healthcarePartyApi, cryptoApi } = api
//
//     const publicKeyDelegate = await makeKeyPair(cryptoApi, `hcp-delegate`)
//     delegateHcp = await healthcarePartyApi.createHealthcareParty(
//       new HealthcareParty({ id: uuid(), publicKey: publicKeyDelegate, firstName: 'test', lastName: 'test' }) //FIXME Shouldn't we call addNewKeyPair directly, instead of initialising like before ?
//     )
//     delegateUser = await userApi.createUser(
//       new User({
//         id: `user-${uuid()}-hcp`,
//         login: `hcp-delegate`,
//         status: 'ACTIVE',
//         healthcarePartyId: delegateHcp.id,
//       })
//     )
//     delegateHcpPassword = await userApi.getToken(delegateUser!.id!, uuid())
//
//     const publicKeyHcpGivingAccessBack = await makeKeyPair(cryptoApi, `hcp-giving-access-back`)
//     hcpGivingAccessBack = await healthcarePartyApi.createHealthcareParty(
//       new HealthcareParty({ id: uuid(), publicKey: publicKeyHcpGivingAccessBack, firstName: 'test', lastName: 'test' })
//     )
//     userGivingAccessBack = await userApi.createUser(
//       new User({
//         id: `user-${uuid()}-hcp`,
//         login: `hcp-giving-access-back`,
//         status: 'ACTIVE',
//         healthcarePartyId: hcpGivingAccessBack.id,
//       })
//     )
//     userGivingAccessBackPassword = await userApi.getToken(userGivingAccessBack!.id!, uuid())
//
//     await Object.entries(userDefinitions).reduce(async (p, [login, creationProcess]) => {
//       await p
//       const newPatientEmail = getTempEmail()
//       const publicKeyPatient = await makeKeyPair(cryptoApi, newPatientEmail)
//       const patientToCreate = await patientApi.newInstance(
//         user,
//         new Patient({ id: uuid(), publicKey: publicKeyPatient, firstName: 'test', lastName: 'test' }),
//         [dataOwnerId]
//       )
//       const patient = await patientApi.createPatientWithUser(user, patientToCreate)
//
//       const newHcpEmail = getTempEmail()
//       const publicKeyHcp = await makeKeyPair(cryptoApi, newHcpEmail)
//       const hcp = await healthcarePartyApi.createHealthcareParty(
//         new HealthcareParty({ id: uuid(), publicKey: publicKeyHcp, firstName: 'test', lastName: 'test' })
//       )
//
//       const newPatientUser = await userApi.createUser(
//         new User({
//           id: `user-${uuid()}-patient`,
//           name: `patient-${login}`,
//           login: newPatientEmail,
//           email: newPatientEmail,
//           status: 'ACTIVE',
//           patientId: patient.id,
//         })
//       )
//       const newPatientUserPassword = await userApi.getToken(newPatientUser!.id!, uuid())
//
//       const newHcpUser = await userApi.createUser(
//         new User({
//           id: `user-${uuid()}-hcp`,
//           login: newHcpEmail,
//           email: newHcpEmail,
//           name: `hcp-${login}`,
//           status: 'ACTIVE',
//           healthcarePartyId: hcp.id,
//         })
//       )
//       const newHcpUserPassword = await userApi.getToken(newHcpUser!.id!, uuid())
//
//       await createPartialsForHcp(facades, entities, newHcpUser, newHcpUserPassword)
//       await createPartialsForPatient(facades, entities, newPatientUser, newPatientUserPassword)
//
//       users.push({ user: await creationProcess(newPatientUser, api), password: newPatientUserPassword })
//       users.push({ user: await creationProcess(newHcpUser, api), password: newHcpUserPassword })
//     }, Promise.resolve())
//
//     const delegateApi = await getApiAndAddPrivateKeysForUser(env!.iCureUrl, delegateUser!, delegateHcpPassword!)
//
//     apis = await Promise.all(
//       users.map(async ({ user, password }) => {
//         return { [user.name!]: await getApiAndAddPrivateKeysForUser(env!.iCureUrl, user, password, false, false) }
//       })
//     ).then((apiDictList) =>
//       apiDictList.reduce(
//         (prev, curr) => {
//           return { ...prev, ...curr }
//         },
//         { delegate: delegateApi }
//       )
//     )
//
//     await users
//       .filter((it) => it.user.id!.endsWith('patient'))
//       .map((it) => it.user)
//       .reduce(async (prev, it) => {
//         await prev
//         const otherUsers = users.filter((u) => u.user.id!.endsWith('patient') && u.user.id !== it.id).map((u) => u.user)
//
//         await otherUsers.reduce(async (p, u) => {
//           await p
//           const patientToShare = await facades.Patient.get(api, it.patientId!)
//           const sharedPatient = await facades.Patient.share(api, null, patientToShare, u.patientId!)
//           expect(Object.keys(sharedPatient.delegations ?? {})).to.contain(u.patientId!)
//           return Promise.resolve([])
//         }, Promise.resolve([]))
//
//         return Promise.resolve([])
//       }, Promise.resolve([]))
//   })
//   ;['hcp'].forEach((uType) => {
//     Object.keys(userDefinitions).forEach((uId) => {
//       it(`Import from local storage and check key validity ${uId}`, async () => {
//         const { user } = users.find((it) => it.user.name === `${uType}-${uId}`)!
//         const api = apis[`${uType}-${uId}`]
//         const dataOwnerId = api.dataOwnerApi.getDataOwnerOf(user)
//         const { dataOwner } = (await api.cryptoApi.getDataOwner(dataOwnerId))!
//         Object.entries(privateKeys[user.login!]).reduce(async (p, [pubKey, privKey]) => {
//           await p
//           await api.cryptoApi.loadKeyPairsAsTextInBrowserLocalStorage(dataOwnerId, hex2ua(privKey))
//         }, Promise.resolve())
//         const validity = await api.cryptoApi.checkPrivateKeyValidity(dataOwner)
//         expect(validity).to.be.true
//       })
//     })
//   })
// })
//
// describe('Full crypto test - Creation scenarios', async function () {
//   ;['patient', 'hcp'].forEach((uType) => {
//     Object.keys(userDefinitions).forEach((uId) => {
//       Object.entries(facades).forEach((f) => {
//         it(`Create ${f[0]} as a ${uType} with ${uId}`, async function () {
//           if (f[0] === 'Patient' && uType === 'patient') {
//             this.skip()
//           }
//           const { user } = users.find((it) => it.user.name === `${uType}-${uId}`)!
//           const facade: EntityFacade<any> = f[1]
//           const api = apis[`${uType}-${uId}`]
//
//           const parent =
//             f[0] !== 'Patient'
//               ? uType === 'patient'
//                 ? await api.patientApi.getPatientWithUser(user, user.patientId!)
//                 : await api.patientApi.getPatientWithUser(user, `${user.id}-Patient`)
//               : undefined
//           const record = await entities[f[0] as TestedEntity](api, `${user.id}-${f[0]}`, user, parent)
//           const entity = await facade.create(api, record)
//           const retrieved = await facade.get(api, entity.id)
//
//           expect(entity.id).to.be.not.null
//           expect(entity.rev).to.equal(retrieved.rev)
//           expect(await facade.isDecrypted(entity)).to.equal(true)
//         })
//         it(`Create ${f[0]} as delegate with delegation for ${uType} with ${uId}`, async function () {
//           const { user } = users.find((it) => it.user.name === `${uType}-${uId}`)!
//           const facade: EntityFacade<any> = f[1]
//
//           const api = apis['delegate']
//           const patApi = apis[`${uType}-${uId}`]
//           const dataOwnerId = api.dataOwnerApi.getDataOwnerOf(user)
//           const dataOwner = (await patApi.cryptoApi.getDataOwner(dataOwnerId))!.dataOwner
//
//           const parent = f[0] !== 'Patient' ? await api.patientApi.getPatientWithUser(delegateUser!, `delegate-${user.id}-Patient`) : undefined
//
//           api.cryptoApi.emptyHcpCache(delegateUser!.healthcarePartyId!)
//
//           const record = await entities[f[0] as TestedEntity](api, `delegate-${user.id}-${f[0]}`, delegateUser!, parent, [
//             (user.patientId ?? user.healthcarePartyId ?? user.deviceId)!,
//           ])
//           const entity = await facade.create(api, record)
//           const retrieved = await facade.get(api, entity.id)
//           const hcp = await api.healthcarePartyApi.getCurrentHealthcareParty()
//
//           const shareKeys = hcp.aesExchangeKeys[hcp.publicKey][dataOwnerId]
//           if (Object.keys(shareKeys).length > 2) {
//             delete shareKeys[dataOwner.publicKey!.slice(-32)]
//           }
//           hcp.aesExchangeKeys = { ...hcp.aesExchangeKeys, [hcp.publicKey!]: { ...hcp.aesExchangeKeys[hcp.publicKey], [dataOwnerId]: shareKeys } }
//           await api.healthcarePartyApi.modifyHealthcareParty(hcp)
//
//           expect(entity.id).to.be.not.null
//           expect(entity.rev).to.equal(retrieved.rev)
//           expect(await facade.isDecrypted(entity)).to.equal(true)
//         })
//       })
//     })
//   })
// })
//
// describe('Full crypto test - Read/Share scenarios', async function () {
//   ;['patient', 'hcp'].forEach((uType) => {
//     Object.keys(userDefinitions).forEach((uId) => {
//       Object.entries(facades).forEach((f) => {
//         it(`Read ${f[0]} as the initial ${uType} with ${uId}`, async function () {
//           if (f[0] === 'Patient' && uType === 'patient') {
//             this.skip()
//           }
//           const { user } = users.find((it) => it.user.name === `${uType}-${uId}`)!
//           const facade = f[1]
//           const api = apis[`${uType}-${uId}`]
//
//           const entity = await facade.get(api, `partial-${user.id}-${f[0]}`)
//           expect(entity.id).to.equal(`partial-${user.id}-${f[0]}`)
//           expect(await facade.isDecrypted(entity)).to.equal(
//             !uId.includes('one lost key and one available key') /* data shared only with lost key... So false */
//           )
//         })
//         it(`Read ${f[0]} as a ${uType} with ${uId}`, async function () {
//           if (f[0] === 'Patient' && uType === 'patient') {
//             this.skip()
//           }
//           const { user } = users.find((it) => it.user.name === `${uType}-${uId}`)!
//           const facade = f[1]
//           const api = apis[`${uType}-${uId}`]
//
//           const entity = await facade.get(api, `${user.id}-${f[0]}`)
//           expect(entity.id).to.equal(`${user.id}-${f[0]}`)
//           expect(await facade.isDecrypted(entity)).to.equal(true)
//         })
//         it(`Read ${f[0]} shared by delegate as a ${uType} with ${uId}`, async () => {
//           const { user } = users.find((it) => it.user.name === `${uType}-${uId}`)!
//           const facade = f[1]
//           const api = apis[`${uType}-${uId}`]
//
//           const entity = await facade.get(api, `delegate-${user.id}-${f[0]}`)
//           expect(entity.id).to.equal(`delegate-${user.id}-${f[0]}`)
//           expect(await facade.isDecrypted(entity)).to.equal(true)
//         })
//         ;['patient', 'hcp'].forEach((duType) => {
//           Object.keys(userDefinitions).forEach((duId) => {
//             it(`Share ${f[0]} as a ${uType} with ${uId} to a ${duType} with ${duId}`, async function () {
//               if (f[0] === 'Patient' && uType === 'patient') {
//                 this.skip()
//               }
//               const { user } = users.find((it) => it.user.name === `${uType}-${uId}`)!
//               const { user: delUser } = users.find((it) => it.user.name === `${duType}-${duId}`)!
//               const delegateDoId = delUser.healthcarePartyId ?? delUser.patientId
//               const facade = f[1]
//               const api = apis[`${uType}-${uId}`]
//               const delApi = apis[`${duType}-${duId}`]
//
//               const parent =
//                 f[0] !== 'Patient'
//                   ? uType === 'patient'
//                     ? await api.patientApi.getPatientWithUser(user, user.patientId!)
//                     : await api.patientApi.getPatientWithUser(user, `${user.id}-Patient`)
//                   : undefined
//               const entity = await facade.share(api, parent, await facade.get(api, `${user.id}-${f[0]}`), delegateDoId)
//               const retrieved = await facade.get(api, entity.id)
//               expect(entity.rev).to.equal(retrieved.rev)
//               expect(Object.keys(entity.delegations)).to.contain(delegateDoId)
//
//               delApi.cryptoApi.emptyHcpCache(delegateDoId!)
//               const obj = await facade.get(delApi, `${user.id}-${f[0]}`)
//               expect(Object.keys(obj.delegations)).to.contain(delegateDoId)
//               expect(await facade.isDecrypted(obj)).to.equal(true)
//             })
//           })
//         })
//       })
//     })
//   })
// })
