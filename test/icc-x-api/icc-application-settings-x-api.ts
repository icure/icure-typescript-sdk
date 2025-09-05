import 'isomorphic-fetch'
import { describeNoLite, getEnvironmentInitializer, hcp1Username, hcp2Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { before, it, describe } from 'mocha'
import { IccPatientXApi, sleep, SubscriptionOptions } from '../../icc-x-api'
import { Patient } from '../../icc-api/model/Patient'
import { User } from '../../icc-api/model/User'
import { randomUUID } from 'crypto'
import { expect } from 'chai'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { IccTopicXApi } from '../../icc-x-api/icc-topic-x-api'
import { Topic, TopicRole } from '../../icc-api/model/Topic'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import initApi = TestUtils.initApi
import { XHR } from '../../icc-api/api/XHR'
import XHRError = XHR.XHRError
import { FilterChainTopic } from '../../icc-api/model/FilterChainTopic'
import { TopicByHcPartyFilter } from '../../icc-x-api/filters/TopicByHcPartyFilter'
import { TopicByParticipantFilter } from '../../icc-x-api/filters/TopicByParticipantFilter'
import { Connection } from '../../icc-api/model/Connection'
import { Message } from '../../icc-api/model/Message'
import { IccApplicationsettingsApi, IccTopicApi } from '../../icc-api'
import { ApplicationSettings } from '../../icc-api/model/ApplicationSettings'

setLocalStorage(fetch)
let env: TestVars
let unencryptedAppSettings: ApplicationSettings

describeNoLite('icc-application-settings-x-api Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('Should still be able to create and get application settings that are not encrypted using the base api', async () => {
    const api1 = await initApi(env, hcp1Username)
    const appSettingsApi = new IccApplicationsettingsApi(env.iCureUrl, {}, api1.authApi.authenticationProvider, fetch)
    unencryptedAppSettings = await appSettingsApi.createApplicationSettings(
      new ApplicationSettings({
        id: randomUUID(),
        settings: { demo: 'plaintext' },
      })
    )
    expect((await appSettingsApi.getApplicationSettings()).map((x) => x.id)).to.have.members([unencryptedAppSettings.id])
    expect((await api1.applicationSettingsApi.getApplicationSettingsWithUser(undefined)).map((x) => x.id)).to.have.members([
      unencryptedAppSettings.id,
    ])
  }).timeout(10_000)

  it('Should be able to create encrypted application settings', async () => {
    const api2 = await initApi(env, hcp2Username)
    const user = await api2.userApi.getCurrentUser()
    const appSettingsApi = new IccApplicationsettingsApi(env.iCureUrl, {}, api2.authApi.authenticationProvider, fetch)
    const createdWithEncryption = await api2.applicationSettingsApi.createApplicationSettingsWithUser(
      undefined,
      await api2.applicationSettingsApi.newInstance(user, {
        id: randomUUID(),
        settings: { demo: 'plaintext' },
        encryptedSettings: { demo: 'willsucceed' },
      })
    )
    const retrievedWithoutDecryption = await appSettingsApi.getApplicationSettings()
    expect(retrievedWithoutDecryption.map((x) => x.id)).to.have.members([unencryptedAppSettings.id, createdWithEncryption.id])
    retrievedWithoutDecryption.forEach((x) => expect(x.encryptedSettings ?? {}).to.deep.eq({}))
    expect(retrievedWithoutDecryption.find((x) => x.id == createdWithEncryption.id)?.settings).to.deep.eq({ demo: 'plaintext' })
    const retrievedWithDecryption = await api2.applicationSettingsApi.getApplicationSettingsWithUser(undefined)
    expect(retrievedWithDecryption.map((x) => x.id)).to.have.members([unencryptedAppSettings.id, createdWithEncryption.id])
    expect(retrievedWithDecryption.find((x) => x.id == createdWithEncryption.id)?.settings).to.deep.eq({ demo: 'plaintext' })
    expect(retrievedWithDecryption.find((x) => x.id == createdWithEncryption.id)?.encryptedSettings).to.deep.eq({ demo: 'willsucceed' })
  }).timeout(10_000)

  it('Should be able to make existing application settings encrypted', async () => {
    const api1 = await initApi(env, hcp1Username)
    const user = await api1.userApi.getCurrentUser()

    const appSettingsApi = new IccApplicationsettingsApi(env.iCureUrl, {}, api1.authApi.authenticationProvider, fetch)
    const newToEncryptAfter = await appSettingsApi.createApplicationSettings(
      new ApplicationSettings({
        id: randomUUID(),
        settings: { demo: 'plaintext' },
      })
    )
    // Should not be allowed to set encryptedSettings on application settings where encryption key is not initialized through with user method
    await api1.applicationSettingsApi
      .updateApplicationSettingsWithUser(
        user,
        new ApplicationSettings({
          ...newToEncryptAfter,
          encryptedSettings: { demo: 'willfail' },
        })
      )
      .then(
        (x) => {
          throw new Error('Should not succeed')
        },
        (x) => {
          expect(x.toString()).to.contain('Application settings does not have initialized encryption metadata; initialize or use non-encrypted api')
        }
      )
    await api1.applicationSettingsApi.updateApplicationSettingsWithUser(
      undefined,
      await api1.applicationSettingsApi.newInstance(user, {
        ...newToEncryptAfter,
        encryptedSettings: { demo: 'willsucceed' },
      })
    )
    const retrievedWithoutDecryption = await appSettingsApi.getApplicationSettings()
    expect(retrievedWithoutDecryption.map((x) => x.id)).to.have.members([unencryptedAppSettings.id, newToEncryptAfter.id])
    retrievedWithoutDecryption.forEach((x) => expect(x.encryptedSettings ?? {}).to.deep.eq({}))
    expect(retrievedWithoutDecryption.find((x) => x.id == newToEncryptAfter.id)?.settings).to.deep.eq({ demo: 'plaintext' })
    const retrievedWithDecryption = await api1.applicationSettingsApi.getApplicationSettingsWithUser(undefined)
    expect(retrievedWithDecryption.map((x) => x.id)).to.have.members([unencryptedAppSettings.id, newToEncryptAfter.id])
    expect(retrievedWithDecryption.find((x) => x.id == newToEncryptAfter.id)?.settings).to.deep.eq({ demo: 'plaintext' })
    expect(retrievedWithDecryption.find((x) => x.id == newToEncryptAfter.id)?.encryptedSettings).to.deep.eq({ demo: 'willsucceed' })
  }).timeout(10_000)
})
