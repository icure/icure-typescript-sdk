import { Api, hex2ua, pkcs8ToJwk, spkiToJwk } from '../../../icc-x-api'
import { crypto } from '../../../node-compat'
import { expect } from 'chai'
import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, getEnvVariables, hcp1Username, patUsername, TestVars } from '../../utils/test_utils'

let env: TestVars | undefined

describe('Calendar', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('should be capable of creating a calendar item', async () => {
    const api = await Api(env!.iCureUrl, env!.dataOwnerDetails[patUsername].user, env!.dataOwnerDetails[patUsername].password, crypto)
    const currentUser = await api.userApi.getCurrentUser()
    await api.patientApi.getPatientWithUser(currentUser, currentUser.patientId!)

    const hcpApi = await Api(env!.iCureUrl, env!.dataOwnerDetails[hcp1Username].user, env!.dataOwnerDetails[hcp1Username].password, crypto)
    const hcp = await hcpApi.userApi.getCurrentUser()

    const jwk = {
      publicKey: spkiToJwk(hex2ua(env!.dataOwnerDetails[patUsername].publicKey)),
      privateKey: pkcs8ToJwk(hex2ua(env!.dataOwnerDetails[patUsername].privateKey)),
    }
    await api.cryptoApi.cacheKeyPair(jwk)
    await api.cryptoApi.keyStorage.storeKeyPair(`${currentUser.healthcarePartyId!}.${env!.dataOwnerDetails[patUsername].publicKey.slice(-32)}`, jwk)

    const calendarItem = await api.calendarItemApi.createCalendarItemWithHcParty(
      currentUser,
      await api.calendarItemApi.newInstance(currentUser, { id: randomUUID(), details: 'Hello' }, [hcp.healthcarePartyId!])
    )
    expect(calendarItem.id).to.be.not.null
  })
})
