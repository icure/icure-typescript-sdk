import 'isomorphic-fetch'
import { getEnvironmentInitializer, hcp1Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { before } from 'mocha'
import * as models from '../../icc-api/model/models'
import { User } from '../../icc-api/model/User'
import { Apis, ua2utf8, utf8_2ua } from '../../icc-x-api'
import initApi = TestUtils.initApi
import { expect } from 'chai'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'

setLocalStorage(fetch)
let env: TestVars
let apis: Apis
let user: User

interface EntityWithAttachmentApi<T> {
  createEntity(): Promise<T>
  encryptAndSetAttachment(entity: T, attachment: ArrayBuffer | Uint8Array): Promise<T>
  getAndDecryptAttachment(entity: T, validator: (decrypted: ArrayBuffer) => Promise<boolean>): Promise<ArrayBuffer>
  getEncryptedAttachment(entity: T): Promise<ArrayBuffer>
}

const entityWithAttachmentApis = {
  docMainAttachment: (apis: Apis, currentUser: User) =>
    <EntityWithAttachmentApi<models.Document>>{
      async createEntity(): Promise<models.Document> {
        return apis.documentApi.createDocument(await apis.documentApi.newInstance(currentUser))
      },
      encryptAndSetAttachment(entity: models.Document, attachment: ArrayBuffer | Uint8Array): Promise<models.Document> {
        return apis.documentApi.encryptAndSetDocumentAttachment(entity, attachment)
      },
      getAndDecryptAttachment(entity: models.Document, validator: (decrypted: ArrayBuffer) => Promise<boolean>): Promise<ArrayBuffer> {
        return apis.documentApi.getAndDecryptDocumentAttachment(entity, validator)
      },
      getEncryptedAttachment(entity: models.Document): Promise<ArrayBuffer> {
        return apis.documentApi.getDocumentAttachment(entity.id!, 'unused')
      },
    },
  docSecondaryAttachment: (apis: Apis, currentUser: User) =>
    <EntityWithAttachmentApi<models.Document>>{
      async createEntity(): Promise<models.Document> {
        return apis.documentApi.createDocument(await apis.documentApi.newInstance(currentUser))
      },
      encryptAndSetAttachment(entity: models.Document, attachment: ArrayBuffer | Uint8Array): Promise<models.Document> {
        return apis.documentApi.encryptAndSetSecondaryDocumentAttachment(entity, 'secondary', attachment)
      },
      getAndDecryptAttachment(entity: models.Document, validator: (decrypted: ArrayBuffer) => Promise<boolean>): Promise<ArrayBuffer> {
        return apis.documentApi.getAndDecryptSecondaryDocumentAttachment(entity, 'secondary', validator)
      },
      getEncryptedAttachment(entity: models.Document): Promise<ArrayBuffer> {
        return apis.documentApi.getSecondaryAttachment(entity.id!, 'secondary')
      },
    },
  receipt: (apis: Apis, currentUser: User) =>
    <EntityWithAttachmentApi<models.Receipt>>{
      async createEntity(): Promise<models.Receipt> {
        return apis.receiptApi.createReceipt(await apis.receiptApi.newInstance(currentUser, {}))
      },
      async encryptAndSetAttachment(entity: models.Receipt, attachment: ArrayBuffer | Uint8Array): Promise<models.Receipt> {
        return apis.receiptApi.encryptAndSetReceiptAttachment(entity, 'tack', attachment)
      },
      getAndDecryptAttachment(entity: models.Receipt, validator: (decrypted: ArrayBuffer) => Promise<boolean>): Promise<ArrayBuffer> {
        return apis.receiptApi.getAndDecryptReceiptAttachment(entity, (entity.attachmentIds ?? {})['tack'], validator)
      },
      getEncryptedAttachment(entity: models.Receipt): Promise<ArrayBuffer> {
        return apis.receiptApi.getReceiptAttachment(entity.id!, (entity.attachmentIds ?? {})['tack'], '')
      },
    },
}

before(async function () {
  this.timeout(600000)
  const initializer = await getEnvironmentInitializer()
  env = await initializer.execute(getEnvVariables())
  for (const [a, b] of Object.entries(env.dataOwnerDetails)) {
    console.log(a)
    console.log(b.password)
    console.log('')
  }
  apis = await initApi(env!, hcp1Username)
  user = await apis.userApi.getCurrentUser()
})

describe('Entity attachment update methods', async function () {
  Object.entries(entityWithAttachmentApis).forEach(([type, attachmentApiInitialiser]) => {
    it(`should automatically encrypt and decrypt attachments (${type})`, async () => {
      const attachmentApi = attachmentApiInitialiser(apis, user)
      const entity = await attachmentApi.createEntity()
      console.log(`entity id ${entity.id}`)
      const attachmentContent = 'This is some secret attachment'
      const entityWithEncrypted = await attachmentApi.encryptAndSetAttachment(entity, utf8_2ua(attachmentContent))
      const decryptedAttachment = await attachmentApi.getAndDecryptAttachment(entityWithEncrypted, async (d) => {
        try {
          return ua2utf8(d) === attachmentContent
        } catch {
          return false
        }
      })
      expect(ua2utf8(decryptedAttachment)).to.equal(attachmentContent)
      const encryptedAttachment = await attachmentApi.getEncryptedAttachment(entityWithEncrypted)
      let conversionFailed
      try {
        conversionFailed = ua2utf8(encryptedAttachment) !== attachmentContent
      } catch {
        conversionFailed = true
      }
      expect(conversionFailed).to.be.true
      const attachmentContent2 = 'This is an updated secret attachment'
      const entityWithEncrypted2 = await attachmentApi.encryptAndSetAttachment(entityWithEncrypted, utf8_2ua(attachmentContent2))
      const decryptedAttachment2 = await attachmentApi.getAndDecryptAttachment(entityWithEncrypted2, async (d) => {
        try {
          return ua2utf8(d) === attachmentContent2
        } catch {
          return false
        }
      })
      expect(ua2utf8(decryptedAttachment2)).to.equal(attachmentContent2)
      const encryptedAttachment2 = await attachmentApi.getEncryptedAttachment(entityWithEncrypted2)
      let conversionFailed2
      try {
        conversionFailed2 = ua2utf8(encryptedAttachment2) !== attachmentContent2
      } catch {
        conversionFailed2 = true
      }
      expect(conversionFailed2).to.be.true
    })
  })
})
