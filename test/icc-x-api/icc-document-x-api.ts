import { before, it } from 'mocha'

import 'isomorphic-fetch'

import { EntityWithDelegationTypeName, IccContactXApi, IccHelementXApi, IccPatientXApi, utf8_2ua } from '../../icc-x-api'
import { Patient } from '../../icc-api/model/Patient'
import { assert, expect } from 'chai'
import { randomUUID } from 'crypto'
import { createNewHcpApi, getEnvironmentInitializer, hcp1Username, hcp2Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { Code } from '../../icc-api/model/Code'
import { Contact } from '../../icc-api/model/Contact'
import { Service } from '../../icc-api/model/Service'
import { Content } from '../../icc-api/model/Content'
import { User } from '../../icc-api/model/User'
import { HealthElement } from '../../icc-api/model/HealthElement'
import { SubContact } from '../../icc-api/model/SubContact'
import { ServiceLink } from '../../icc-api/model/ServiceLink'
import { FilterChainService } from '../../icc-api/model/FilterChainService'
import { ServiceByHcPartyHealthElementIdsFilter } from '../../icc-x-api/filters/ServiceByHcPartyHealthElementIdsFilter'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { Measure } from '../../icc-api/model/Measure'
import initApi = TestUtils.initApi
import { IccDocumentApi, IccMessageApi } from '../../icc-api'

setLocalStorage(fetch)
let env: TestVars

before(async function () {
  this.timeout(600000)
  const initializer = await getEnvironmentInitializer()
  env = await initializer.execute(getEnvVariables())
})

describe('icc-x-document-api Tests', () => {
  it('Get and decrypt as json should work', async () => {
    // Given
    const { documentApi, userApi } = await initApi(env!, hcp1Username)

    const currUser = await userApi.getCurrentUser()
    const document = await documentApi.createDocumentWithUser(undefined, await documentApi.newInstance(currUser, undefined, {}))
    const obj = { test: 'test' }
    await documentApi.encryptAndSetDocumentAttachment(document, utf8_2ua(JSON.stringify(obj)))
    const decrypted = await documentApi.getAndTryDecryptMainAttachmentAs(document, 'application/json')
    expect(decrypted).to.deep.equal(obj)
  })

  it('Get and decrypt as string should work', async () => {
    // Given
    const { documentApi, userApi } = await initApi(env!, hcp1Username)

    const currUser = await userApi.getCurrentUser()
    const document = await documentApi.createDocumentWithUser(undefined, await documentApi.newInstance(currUser, undefined, {}))
    const obj = 'Test'
    await documentApi.encryptAndSetDocumentAttachment(document, utf8_2ua(obj))
    const decrypted = await documentApi.getAndTryDecryptMainAttachmentAs(document, 'text/plain')
    expect(decrypted).to.deep.equal(obj)
    const decryptedAsJson = await documentApi.getAndTryDecryptMainAttachmentAs(document, 'application/json')
    expect(decryptedAsJson).to.be.undefined
  })

  it('Should be encrypted', async () => {
    const hcp = await createNewHcpApi(env, {
      encryptedFieldsConfig: {
        document: ['name'],
      },
    })
    const name = 'Private.txt'
    const externalUuid = randomUUID()
    const created = await hcp.api.documentApi.createDocumentWithUser(
      undefined,
      await hcp.api.documentApi.newInstance(hcp.user, undefined, {
        id: randomUUID(),
        name,
        externalUuid,
      })
    )
    expect(created.name).to.eq(name)
    expect(created.externalUuid).to.eq(externalUuid)
    const retrieved = await hcp.api.documentApi.getDocumentWithUser(undefined, created.id!)
    expect(retrieved.name).to.eq(name)
    expect(retrieved.externalUuid).to.eq(externalUuid)
    const encrypted = await new IccDocumentApi(env.iCureUrl, {}, hcp.api.authApi.authenticationProvider, fetch).getDocument(created.id!)
    expect(encrypted.name).to.be.undefined
    expect(encrypted.externalUuid).to.eq(externalUuid)
  })
})
