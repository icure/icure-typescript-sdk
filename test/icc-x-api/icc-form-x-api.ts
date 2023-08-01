import 'isomorphic-fetch'
import { getEnvironmentInitializer, hcp1Username, hcp2Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { before } from 'mocha'
import { IccFormXApi, IccPatientXApi, IccUserXApi, IcureApi, ua2ab, ua2hex, utf8_2ua } from '../../icc-x-api'
import { BasicAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { IccFormApi } from '../../icc-api'
import { Patient } from '../../icc-api/model/Patient'
import { User } from '../../icc-api/model/User'
import { randomUUID } from 'crypto'
import { Form } from '../../icc-api/model/Form'
import { assert, expect } from 'chai'
import initApi = TestUtils.initApi
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { crypto } from '../../node-compat'
import { Code } from '../../icc-api/model/Code'
import { FormTemplate } from '../../icc-api/model/FormTemplate'
import { read } from 'fs'

setLocalStorage(fetch)
let env: TestVars

async function createPatient(patientApiForHcp: IccPatientXApi, hcpUser: User) {
  return patientApiForHcp.createPatientWithUser(
    hcpUser,
    await patientApiForHcp.newInstance(
      hcpUser,
      new Patient({
        id: randomUUID(),
        firstName: 'John',
        lastName: 'Snow',
        note: 'Winter is coming',
      })
    )
  )
}

function createForm(hFormApiForHcp: IccFormXApi, hcpUser: User, patient: Patient) {
  return hFormApiForHcp.newInstance(
    hcpUser,
    patient,
    new Form({
      id: randomUUID(),
      codes: [new Code({ system: 'LOINC', code: '95209', version: '3' })],
      descr: 'SARS-V2',
    })
  )
}

function createFormTemplate() {
  return new FormTemplate({
    id: randomUUID(),
    codes: [new Code({ system: 'LOINC', code: '95209', version: '3' })],
    descr: 'SARS-V2',
  })
}

describe('icc-calendar-item-x-api Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  async function createPatient(patientApiForHcp: IccPatientXApi, hcpUser: User) {
    return patientApiForHcp.createPatientWithUser(
      hcpUser,
      await patientApiForHcp.newInstance(
        hcpUser,
        new Patient({
          id: randomUUID(),
          firstName: 'John',
          lastName: 'Snow',
          note: 'Winter is coming',
        })
      )
    )
  }

  it('Test', async () => {
    // Given
    const username = env.dataOwnerDetails[hcp1Username].user
    const password = env.dataOwnerDetails[hcp1Username].password

    const authProvider = new BasicAuthenticationProvider(username, password)

    const userApi = new IccUserXApi(env.iCureUrl, {}, authProvider, null as any, fetch)
    const formApi = new IccFormApi(env.iCureUrl, {}, authProvider, fetch)

    const currentUser = await userApi.getCurrentUser()
  })

  it('Test findBy', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      cryptoApi: cryptoApiForHcp,
      dataOwnerApi: dateOwnerApiForHcp,
    } = await initApi(env!, hcp1Username)
    const hcpUser = await userApiForHcp.getCurrentUser()

    const username = env.dataOwnerDetails[hcp1Username].user
    const password = env.dataOwnerDetails[hcp1Username].password

    const authProvider = new BasicAuthenticationProvider(username, password)
    const formXApi = new IccFormXApi(env.iCureUrl, {}, cryptoApiForHcp, dateOwnerApiForHcp, authProvider, fetch)
    const patient = (await createPatient(patientApiForHcp, hcpUser)) as Patient

    const form = new Form({
      id: randomUUID(),
      created: new Date().getTime(),
      modified: new Date().getTime(),
      responsible: hcpUser.healthcarePartyId!,
      author: hcpUser.id,
      codes: [],
      tags: [],
      user: hcpUser.id,
      patient: patient.id,
    })
    const formToCreate = await formXApi.newInstance(hcpUser, patient, form)
    const createdForm = await formXApi.createForm(formToCreate)

    const foundItems: Form[] = (await formXApi.findBy(hcpUser.healthcarePartyId!, patient, false)) as Form[]
    const foundItemsUsingPost: Form[] = (await formXApi.findBy(hcpUser.healthcarePartyId!, patient, true)) as Form[]

    assert(foundItems.length == 1, 'Found items should be 1')
    assert(foundItems[0].id == createdForm.id, 'Found item should be the created one')

    assert(foundItemsUsingPost.length == 1, 'Found items using post should be 1')
    assert(foundItemsUsingPost[0].id == createdForm.id, 'Found item using post should be the created one')
  })

  it('Share with should work as expected', async () => {
    const api1 = await initApi(env!, hcp1Username)
    const user1 = await api1.userApi.getCurrentUser()
    const api2 = await initApi(env!, hcp2Username)
    const user2 = await api2.userApi.getCurrentUser()
    const samplePatient = await api1.patientApi.createPatientWithUser(
      user1,
      await api1.patientApi.newInstance(user1, { firstName: 'Gigio', lastName: 'Bagigio' })
    )
    const entity = await api1.formApi.createForm(await api1.formApi.newInstance(user1, samplePatient))
    await api2.formApi
      .getForm(entity.id!)
      .then(() => {
        throw new Error('Should not be able to get the entity')
      })
      .catch(() => {
        /* expected */
      })
    await api1.formApi.shareWith(user2.healthcarePartyId!, entity)
    const retrieved = await api2.formApi.getForm(entity.id!)
    expect((await api2.formApi.decryptPatientIdOf(retrieved))[0]).to.equal(samplePatient.id)
  })

  it('CreateForm Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      formApi: hFormApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = await initApi(env!, hcp1Username)

    const hcpUser = await userApiForHcp.getCurrentUser()

    const patient = await createPatient(patientApiForHcp, hcpUser)
    const formToCreate = await createForm(hFormApiForHcp, hcpUser, patient)

    // When
    const createdForm = await hFormApiForHcp.createForm(formToCreate)

    // Then
    const readForm = await hFormApiForHcp.getForm(createdForm.id!)
    assert(readForm != null)
    assert(readForm.id != null)
    assert(readForm.descr == formToCreate.descr)
    assert(readForm.delegations![hcpUser.healthcarePartyId!].length > 0)
    assert(readForm.encryptionKeys![hcpUser.healthcarePartyId!].length > 0)
    assert(readForm.cryptedForeignKeys![hcpUser.healthcarePartyId!].length > 0)
  })

  it('CreateFormTemplate Success for HCP', async () => {
    // Given
    const { formApi: hFormApiForHcp } = await initApi(env!, hcp1Username)

    // When
    const createdFormTemplate = await hFormApiForHcp.createFormTemplate(createFormTemplate())

    const YamlFile: string =
      'form: Entretien préliminaire Psycho Social\n' +
      'description: Entretien préliminaire Psycho Social\n' +
      'sections:\n' +
      '  - section:\n' +
      '    fields:\n' +
      '      - field: Type de consultation\n' +
      '        type: dropdown\n' +
      '        labels:\n' +
      '          above : Type de consultation\n' +
      '        shortLabel: contactType\n' +
      '        options:\n' +
      '          home: Sur place\n' +
      '          visio: Visioconférence\n' +
      '          call: Téléphone\n' +
      '        rows: 1\n' +
      '        columns: 1\n' +
      '        required: true\n' +
      '        codifications :\n' +
      '          - MS-IVG-CONTACT-TYPE\n' +
      '        tags:\n' +
      '          - MS-IVG|CONTACT-TYPE|1\n' +
      '      - field : waitingRoomFollowersNumber\n' +
      '        type: number-field\n' +
      '        shortLabel: waitingRoomFollowersNumber\n' +
      '        value: 0\n' +
      '        labels:\n' +
      '          above: Accompagné de\n' +
      "          right: personne(s) (salle d'attente)\n" +
      '        rows: 2\n' +
      '        columns: 1\n' +
      '        required: true\n' +
      '        tags :\n' +
      '          - CD-CUSTOM-IVG|WAITING-ROOM-FOLLOWERS-NUMBER|1\n' +
      '      - field : consultationFollowersNumber\n' +
      '        type: number-field\n' +
      '        shortLabel: consultationFollowersNumber\n' +
      '        value: 0\n' +
      '        labels:\n' +
      '          above: Accompagné de\n' +
      '          right: personne(s) (entretien préliminaire)\n' +
      '        rows: 2\n' +
      '        columns: 1\n' +
      '        required: true\n' +
      '        tags :\n' +
      '          - CD-CUSTOM-IVG|CONSULTATION-FOLLOWERS-NUMBER|1\n' +
      '      - field : Personnes Accompagnants\n' +
      '        type: checkbox\n' +
      '        shortLabel: PersonFollowerType\n' +
      '        options:\n' +
      '          option1: Partenaire\n' +
      '          option2: Mère\n' +
      '          option3: Amie\n' +
      '          option4: Éducateur\n' +
      '          option5: Père\n' +
      '        rows: 3\n' +
      '        columns: 1\n' +
      '        required: false\n' +
      '        tags:\n' +
      '          - CD-CUSTOM-IVG|PERSON-FOLLOWER-TYPE|1\n' +
      '      - field : Profession de la patiente\n' +
      '        type: radio-button\n' +
      '        shortLabel: PatientProfession\n' +
      '        options:\n' +
      '          option1: Employé\n' +
      '          option2: Ouvrier\n' +
      '          option3: Indépendant\n' +
      '          option4: Sans travail\n' +
      '          option5: Ne veut pas dire\n' +
      '        rows: 4\n' +
      '        columns: 1\n' +
      '        required: false\n' +
      '        tags:\n' +
      '          - CD-CUSTOM-IVG|PATIENT-PROFESSION|1\n' +
      '      - field : Nombre d’enfants\n' +
      '        type: number-field\n' +
      '        shortLabel: ChildNumber\n' +
      '        value: 0\n' +
      '        rows: 5\n' +
      '        columns: 1\n' +
      '        required: true\n' +
      '        tags:\n' +
      '          - CD-CUSTOM-IVG|CHILD-NUMBER|1\n' +
      '      - field : Nombre d’enfants à charge\n' +
      '        type: number-field\n' +
      '        shortLabel: ChildInChargeNumber\n' +
      '        value: 0\n' +
      '        rows: 5\n' +
      '        columns: 1\n' +
      '        required: true\n' +
      '        tags:\n' +
      '          - CD-CUSTOM-IVG|CHILD-IN-CHARGE-NUMBER|1\n' +
      '      - field : Nombre de minutes de suivi\n' +
      '        type: measure-field\n' +
      '        shortLabel: minutesTrackingNumber\n' +
      '        rows: 6\n' +
      '        columns: 1\n' +
      '        value: 50\n' +
      '        unit: min\n' +
      '        required: true\n' +
      '        tags:\n' +
      '          - CD-CUSTOM-IVG|MINUTES-TRACKING-NUMBER|1\n' +
      '      - field : Nombre de minutes de contraception\n' +
      '        type: measure-field\n' +
      '        shortLabel: minutesContraceptionNumber\n' +
      '        rows: 6\n' +
      '        columns: 1\n' +
      '        required: true\n' +
      '        value: 10\n' +
      '        unit: min\n' +
      '        tags:\n' +
      '          - CD-CUSTOM-IVG|MINUTES-CONTRACEPTION-NUMBER|1\n' +
      '      - field : Historique/Situation\n' +
      '        type: textfield\n' +
      '        shortLabel: History\n' +
      '        rows: 7\n' +
      '        columns: 1\n' +
      '        required: false\n' +
      '        tags:\n' +
      '          - CD-CUSTOM-IVG|HISTORY|1\n' +
      '      - field : Position du partenaire pendant la grossesse\n' +
      '        type: textfield\n' +
      '        shortLabel: SexualPosition\n' +
      '        rows: 8\n' +
      '        columns: 1\n' +
      '        required: false\n' +
      '        tags:\n' +
      '          - CD-CUSTOM-IVG|SEXUAL-POSITION|1\n' +
      "      - field : Processus de prise de décision / choix / attitude par rapport à l'avortement (le cas échéant)\n" +
      '        type: textfield\n' +
      '        shortLabel: decisionProcessus\n' +
      '        rows: 9\n' +
      '        columns: 1\n' +
      '        required: false\n' +
      '        tags :\n' +
      '          -  CD-CUSTOM-IVG|DECISION-PROCESSUS|1\n' +
      '      - field : Première décision de la patiente\n' +
      '        type: radio-button\n' +
      '        shortLabel: firstChoice\n' +
      '        rows: 9\n' +
      '        columns: 1\n' +
      '        required: true\n' +
      '        options:\n' +
      '          option1: Oui par curretage\n' +
      '          option2: Ne sait pas\n' +
      '          option3: Oui par médication\n' +
      '          option4: Non\n' +
      '        tags:\n' +
      '          - CD-CUSTOM-IVG|FIRST-CHOICE|1\n' +
      '      - field : Notes\n' +
      '        type: textfield\n' +
      '        shortLabel: notes\n' +
      '        rows: 10\n' +
      '        columns: 1\n' +
      '        required: false\n' +
      '        multiline: true\n' +
      '        tags:\n' +
      '          - CD-CUSTOM-IVG|NOTES|1'
    const ua = utf8_2ua(YamlFile)
    const ab = ua2ab(ua)
    const hex = ua2hex(ua)
    // Note: requires node 18+
    await hFormApiForHcp.setTemplateAttachmentMulti(ab, createdFormTemplate.id!)
    // Then
    const readFormTemplate = await hFormApiForHcp.getFormTemplate(createdFormTemplate.id!)
    expect(readFormTemplate).to.not.be.undefined
    expect(readFormTemplate.id).to.not.be.undefined
    expect(readFormTemplate.descr).to.equal(createdFormTemplate.descr)
    expect(readFormTemplate.templateLayout).to.not.be.undefined
  })

  it('newInstance should honor non-default values unless they are undefined', async () => {
    const api = await initApi(env!, hcp1Username)
    const user = await api.userApi.getCurrentUser()
    const patient = await api.patientApi.createPatientWithUser(
      user,
      await api.patientApi.newInstance(user, { firstName: 'Gigio', lastName: 'Bagigio' })
    )
    const formUndefinedId = await api.formApi.newInstance(user, patient, { id: undefined })
    const customId = 'customId'
    const formCustomId = await api.formApi.newInstance(user, patient, { id: customId })
    const formWithUndefinedInit = await api.formApi.newInstance(user, patient, undefined)
    expect(formUndefinedId.id).to.not.be.undefined
    expect(formWithUndefinedInit.id).to.not.be.undefined
    expect(formCustomId.id).to.equal(customId)
  })
})
