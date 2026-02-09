import 'isomorphic-fetch'
import { describeNoLite, getEnvironmentInitializer, hcp1Username, hcp2Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { before } from 'mocha'
import { IccPatientXApi, IccUserXApi } from '../../icc-x-api'
import { IccFormApi } from '../../icc-api'
import { Patient } from '../../icc-api/model/Patient'
import { User } from '../../icc-api/model/User'
import { randomUUID } from 'crypto'
import { Form } from '../../icc-api/model/Form'
import { FormTemplate } from '../../icc-api/model/FormTemplate'
import { CodeStub } from '../../icc-api/model/CodeStub'
import { assert, expect } from 'chai'
import initApi = TestUtils.initApi
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { BasicAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { IdWithRev } from '../../icc-api/model/IdWithRev'

setLocalStorage(fetch)
let env: TestVars

describe('icc-form-x-api Tests', () => {
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
      formApi: formXApi,
    } = await initApi(env, hcp1Username)
    const hcpUser = await userApiForHcp.getCurrentUser()
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

  it('Tests for Form Templates', async () => {
    // Given
    const { formApi, userApi } = await initApi(env, hcp1Username)
    const guid = randomUUID()
    const specialtyCode = 'SPECIALTY-' + randomUUID()
    const user = await userApi.getCurrentUser()

    const formTemplateToCreate = new FormTemplate({
      id: randomUUID(),
      guid: guid,
      author: user.id,
      name: 'My Test Template',
      specialty: new CodeStub({ code: specialtyCode, type: 'specialty', version: '1' }),
      descr: 'Description of the template',
    })

    // Create
    const createdTemplate = await formApi.createFormTemplate(formTemplateToCreate)
    expect(createdTemplate.id).to.not.be.undefined
    expect(createdTemplate.guid).to.equal(guid)
    expect(createdTemplate.name).to.equal('My Test Template')

    // Get
    const retrievedTemplate = await formApi.getFormTemplate(createdTemplate.id!)
    expect(retrievedTemplate.id).to.equal(createdTemplate.id)

    // Find all
    const allTemplates = await formApi.findFormTemplates()
    expect(allTemplates.map((t) => t.id)).to.include(createdTemplate.id)

    // Find by specialty
    const templatesBySpecialty = await formApi.findFormTemplatesBySpeciality(specialtyCode)
    expect(templatesBySpecialty.map((t) => t.id)).to.include(createdTemplate.id)
    expect(templatesBySpecialty.length).to.be.greaterThan(0)

    // Get by GUID (using getFormTemplatesByGuid)
    const templatesByGuid = await formApi.getFormTemplatesByGuid(guid, specialtyCode)
    expect(templatesByGuid.map((t) => t.id)).to.include(createdTemplate.id)

    // Update
    createdTemplate.name = 'Updated Name'
    const updatedTemplate = await formApi.updateFormTemplate(createdTemplate.id!, createdTemplate)
    expect(updatedTemplate.name).to.equal('Updated Name')

    // Delete
    await formApi.deleteFormTemplate(createdTemplate.id!)
    try {
      await formApi.getFormTemplate(createdTemplate.id!)
      assert.fail('Should have thrown an error')
    } catch (e) {
      // Expected
    }
  })

  describeNoLite('Form Templates in Group Tests', () => {
    it('should create, find, update and delete form templates in a group', async () => {
      // Given
      const { formApi, userApi } = await initApi(env)
      const currentUser = await userApi.getCurrentUser()
      const guid = randomUUID()
      const specialtyCode = 'SPECIALTY-' + randomUUID()

      // Use the existing test group ID
      const groupId = env.testGroupId

      const formTemplateToCreate = new FormTemplate({
        id: randomUUID(),
        guid: guid,
        author: currentUser.id,
        name: 'My Group Template',
        specialty: new CodeStub({ code: specialtyCode, type: 'specialty', version: '1' }),
        descr: 'Description of the group template',
      })

      // Create In Group
      const createdTemplate = await formApi.createFormTemplateInGroup(groupId, formTemplateToCreate)
      expect(createdTemplate.id).to.not.be.undefined
      expect(createdTemplate.guid).to.equal(guid)
      if (createdTemplate.group) {
        expect(createdTemplate.group.guid).to.equal(groupId)
      }

      // Get In Group
      const templatesInGroup = await formApi.getFormTemplatesByUserInGroup(groupId, currentUser.id!)
      expect(templatesInGroup.map((t) => t.id)).to.include(createdTemplate.id)

      // Update In Group
      createdTemplate.name = 'Updated Group Name'
      const updatedTemplate = await formApi.updateFormTemplateInGroup(groupId, createdTemplate.id!, createdTemplate)
      expect(updatedTemplate.name).to.equal('Updated Group Name')

      // Delete In Group
      await formApi.deleteFormTemplateInGroup(groupId, updatedTemplate.id!, updatedTemplate.rev!)

      // Verify deletion
      const templatesInGroupAfterDelete = await formApi.getFormTemplatesByUserInGroup(groupId, currentUser.id!)
      expect(templatesInGroupAfterDelete.map((t) => t.id)).to.not.include(createdTemplate.id)
    })
  })

  describeNoLite('Form Templates Batch Operations in Group Tests', () => {
    it('should create, get, and modify multiple form templates in a group (batch)', async () => {
      // Given
      const { formApi, userApi } = await initApi(env)
      const currentUser = await userApi.getCurrentUser()
      const groupId = env.testGroupId
      const specialtyCode = 'SPECIALTY-' + randomUUID()

      // Create multiple templates
      const templatesToCreate = [
        new FormTemplate({
          id: randomUUID(),
          guid: randomUUID(),
          author: currentUser.id,
          name: 'Batch Template 1',
          specialty: new CodeStub({ code: specialtyCode, type: 'specialty', version: '1' }),
          descr: 'First batch template',
        }),
        new FormTemplate({
          id: randomUUID(),
          guid: randomUUID(),
          author: currentUser.id,
          name: 'Batch Template 2',
          specialty: new CodeStub({ code: specialtyCode, type: 'specialty', version: '1' }),
          descr: 'Second batch template',
        }),
        new FormTemplate({
          id: randomUUID(),
          guid: randomUUID(),
          author: currentUser.id,
          name: 'Batch Template 3',
          specialty: new CodeStub({ code: specialtyCode, type: 'specialty', version: '1' }),
          descr: 'Third batch template',
        }),
      ]

      // Create batch
      const createdTemplates = await formApi.createFormTemplatesInGroup(groupId, templatesToCreate)
      expect(createdTemplates).to.have.lengthOf(3)
      expect(createdTemplates[0].name).to.equal('Batch Template 1')
      expect(createdTemplates[1].name).to.equal('Batch Template 2')
      expect(createdTemplates[2].name).to.equal('Batch Template 3')
      createdTemplates.forEach((template) => {
        expect(template.id).to.not.be.undefined
        expect(template.rev).to.not.be.undefined
      })

      // Get batch by IDs
      const retrievedTemplates = await formApi.getFormTemplatesInGroup(
        groupId,
        createdTemplates.map((t) => t.id!)
      )
      expect(retrievedTemplates).to.have.lengthOf(3)
      expect(retrievedTemplates.map((t) => t.id)).to.have.members(createdTemplates.map((t) => t.id))

      // Modify batch
      const templatesForUpdate = createdTemplates.map((t, index) => ({
        ...t,
        name: `Updated Batch Template ${index + 1}`,
      }))
      const updatedTemplates = await formApi.modifyFormTemplatesInGroup(groupId, templatesForUpdate)
      expect(updatedTemplates).to.have.lengthOf(3)
      expect(updatedTemplates[0].name).to.equal('Updated Batch Template 1')
      expect(updatedTemplates[1].name).to.equal('Updated Batch Template 2')
      expect(updatedTemplates[2].name).to.equal('Updated Batch Template 3')

      // Clean up - delete batch
      const idsAndRevs = updatedTemplates.map((t) => new IdWithRev({ id: t.id!, rev: t.rev! }))
      const deleteResults = await formApi.deleteFormTemplatesInGroup(groupId, idsAndRevs)
      expect(deleteResults).to.have.lengthOf(3)
      deleteResults.forEach((result) => {
        expect(result.id).to.not.be.undefined
        expect(result.rev).to.not.be.undefined
      })
    })

    it('should delete and undelete multiple form templates in a group (batch)', async () => {
      // Given
      const { formApi, userApi } = await initApi(env)
      const currentUser = await userApi.getCurrentUser()
      const groupId = env.testGroupId
      const specialtyCode = 'SPECIALTY-' + randomUUID()

      // Create templates
      const templatesToCreate = [
        new FormTemplate({
          id: randomUUID(),
          guid: randomUUID(),
          author: currentUser.id,
          name: 'Delete Test Template 1',
          specialty: new CodeStub({ code: specialtyCode, type: 'specialty', version: '1' }),
        }),
        new FormTemplate({
          id: randomUUID(),
          guid: randomUUID(),
          author: currentUser.id,
          name: 'Delete Test Template 2',
          specialty: new CodeStub({ code: specialtyCode, type: 'specialty', version: '1' }),
        }),
      ]

      const createdTemplates = await formApi.createFormTemplatesInGroup(groupId, templatesToCreate)
      expect(createdTemplates).to.have.lengthOf(2)

      // Delete batch
      const idsAndRevs = createdTemplates.map((t) => new IdWithRev({ id: t.id!, rev: t.rev! }))
      const deleteResults = await formApi.deleteFormTemplatesInGroup(groupId, idsAndRevs)
      expect(deleteResults).to.have.lengthOf(2)

      // Verify deletion - templates should not be in active list
      const allTemplates = await formApi.getFormTemplatesByUserInGroup(groupId, currentUser.id!)
      const activeIds = allTemplates.map((t) => t.id)
      createdTemplates.forEach((t) => {
        expect(activeIds).to.not.include(t.id)
      })

      // Undelete batch - use the updated revisions from delete results
      const undeleteIdsAndRevs = deleteResults.map((result) => new IdWithRev({ id: result.id!, rev: result.rev! }))
      const undeletedTemplates = await formApi.undeleteFormTemplatesInGroup(groupId, undeleteIdsAndRevs)
      expect(undeletedTemplates).to.have.lengthOf(2)
      undeletedTemplates.forEach((template) => {
        expect(template.id).to.not.be.undefined
        expect(template.rev).to.not.be.undefined
        expect(template.deletionDate).to.be.undefined
      })

      // Verify undelete - templates should be back in active list
      const templatesAfterUndelete = await formApi.getFormTemplatesByUserInGroup(groupId, currentUser.id!)
      const activeIdsAfterUndelete = templatesAfterUndelete.map((t) => t.id)
      undeletedTemplates.forEach((t) => {
        expect(activeIdsAfterUndelete).to.include(t.id)
      })

      // Final cleanup - delete again
      const finalIdsAndRevs = undeletedTemplates.map((t) => new IdWithRev({ id: t.id!, rev: t.rev! }))
      await formApi.deleteFormTemplatesInGroup(groupId, finalIdsAndRevs)
    })

    it('should purge multiple form templates in a group (batch)', async () => {
      // Given
      const { formApi, userApi } = await initApi(env)
      const currentUser = await userApi.getCurrentUser()
      const groupId = env.testGroupId
      const specialtyCode = 'SPECIALTY-' + randomUUID()

      // Create templates
      const templatesToCreate = [
        new FormTemplate({
          id: randomUUID(),
          guid: randomUUID(),
          author: currentUser.id,
          name: 'Purge Test Template 1',
          specialty: new CodeStub({ code: specialtyCode, type: 'specialty', version: '1' }),
        }),
        new FormTemplate({
          id: randomUUID(),
          guid: randomUUID(),
          author: currentUser.id,
          name: 'Purge Test Template 2',
          specialty: new CodeStub({ code: specialtyCode, type: 'specialty', version: '1' }),
        }),
      ]

      const createdTemplates = await formApi.createFormTemplatesInGroup(groupId, templatesToCreate)
      expect(createdTemplates).to.have.lengthOf(2)

      // First delete them (purge requires deletion first)
      const deleteIdsAndRevs = createdTemplates.map((t) => new IdWithRev({ id: t.id!, rev: t.rev! }))
      const deleteResults = await formApi.deleteFormTemplatesInGroup(groupId, deleteIdsAndRevs)
      expect(deleteResults).to.have.lengthOf(2)

      // Purge batch
      const purgeIdsAndRevs = deleteResults.map((result) => new IdWithRev({ id: result.id!, rev: result.rev! }))
      const purgeResults = await formApi.purgeFormTemplatesInGroup(groupId, purgeIdsAndRevs)
      expect(purgeResults).to.have.lengthOf(2)
      purgeResults.forEach((result) => {
        expect(result.id).to.not.be.undefined
      })

      // Verify purge - trying to get the templates should fail or return empty
      const retrievedTemplates = await formApi.getFormTemplatesInGroup(
        groupId,
        createdTemplates.map((t) => t.id!)
      )
      expect(retrievedTemplates).to.have.lengthOf(0)
    })

    it('should handle empty batch operations gracefully', async () => {
      // Given
      const { formApi } = await initApi(env)
      const groupId = env.testGroupId

      // Test with empty arrays
      const createdTemplates = await formApi.createFormTemplatesInGroup(groupId, [])
      expect(createdTemplates).to.have.lengthOf(0)

      const modifiedTemplates = await formApi.modifyFormTemplatesInGroup(groupId, [])
      expect(modifiedTemplates).to.have.lengthOf(0)

      const retrievedTemplates = await formApi.getFormTemplatesInGroup(groupId, [])
      expect(retrievedTemplates).to.have.lengthOf(0)

      const deleteResults = await formApi.deleteFormTemplatesInGroup(groupId, [])
      expect(deleteResults).to.have.lengthOf(0)

      const undeleteResults = await formApi.undeleteFormTemplatesInGroup(groupId, [])
      expect(undeleteResults).to.have.lengthOf(0)

      const purgeResults = await formApi.purgeFormTemplatesInGroup(groupId, [])
      expect(purgeResults).to.have.lengthOf(0)
    })
  })
})
