import { before } from 'mocha'

import 'isomorphic-fetch'

import { Api, IccFormXApi, IccPatientXApi, ua2ab, ua2hex, utf8_2ua } from '../../icc-x-api'
import { crypto } from '../../node-compat'
import { Patient } from '../../icc-api/model/Patient'
import { assert } from 'chai'
import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, getEnvVariables, hcp1Username, setLocalStorage, TestUtils, TestVars } from '../utils/test_utils'
import { Code } from '../../icc-api/model/Code'
import { User } from '../../icc-api/model/User'
import initKey = TestUtils.initKey
import { Form } from '../../icc-api/model/Form'
import { FormTemplate } from '../../icc-api/model/FormTemplate'

setLocalStorage(fetch)
let env: TestVars | undefined

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

describe('icc-form-x-api Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('CreateForm Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      formApi: hFormApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = await Api(env!.iCureUrl, env!.dataOwnerDetails[hcp1Username].user, env!.dataOwnerDetails[hcp1Username].password, crypto)

    const hcpUser = await userApiForHcp.getCurrentUser()
    await initKey(dataOwnerApiForHcp, cryptoApiForHcp, hcpUser, env!.dataOwnerDetails[hcp1Username].privateKey)

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
    const { formApi: hFormApiForHcp } = await Api(
      env!.iCureUrl,
      env!.dataOwnerDetails[hcp1Username].user,
      env!.dataOwnerDetails[hcp1Username].password,
      crypto
    )

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

    await hFormApiForHcp.setTemplateAttachmentMulti(ab, createdFormTemplate.id!)
    // Then
    const readFormTemplate = await hFormApiForHcp.getFormTemplate(createdFormTemplate.id!)
    assert(!!readFormTemplate)
    assert(!!readFormTemplate.id)
    assert(readFormTemplate.descr === createdFormTemplate.descr)
    assert(!!readFormTemplate.templateLayout)
  })
})
