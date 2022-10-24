import { Api } from '../../../icc-x-api'
import { crypto } from '../../../node-compat'
import { expect } from 'chai'
import { randomUUID } from 'crypto'
import { Patient } from '../../../icc-api/model/Patient'

const iCureUrl = process.env.ICURE_URL ?? 'https://kraken.icure.cloud/rest/v1'
const hcp1UserName = process.env.HCP_USERNAME!
const hcp1Password = process.env.HCP_PASSWORD!

describe('User', () => {
  it('should be capable of creating a calendar item', async () => {
    const { userApi, patientApi, calendarItemApi } = await Api(iCureUrl, hcp1UserName, hcp1Password, crypto)
    const currentUser = await userApi.getCurrentUser()

    const patient: Patient = await patientApi.getPatientWithUser(currentUser, currentUser.patientId!)
    const calendarItem = await calendarItemApi.createCalendarItemWithHcParty(
      currentUser,
      await calendarItemApi.newInstance(currentUser, { id: randomUUID(), details: 'Hello' }, [
        '44f19c1a-8da8-4959-90df-96a2e98112f4',
        'f80f2b9f-4924-4a46-a6a4-a176f33607d8',
      ])
    )
    expect(calendarItem.id).to.be.not.null
  })
})
