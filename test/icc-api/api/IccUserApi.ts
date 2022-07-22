import {Api} from '../../../icc-x-api'
import {crypto} from '../../../node-compat'
import {expect} from 'chai'
import {randomUUID} from 'crypto'

const iCureUrl = process.env.ICURE_URL ?? 'https://kraken.icure.dev/rest/v1'
const hcp1UserName = process.env.HCP_USERNAME!
const hcp1Password = process.env.HCP_PASSWORD!

describe('User', () => {
  it('should be capable of creating a token', async () => {
    const { userApi } = await Api(iCureUrl, hcp1UserName, hcp1Password, crypto)
    const currentUser = await userApi.getCurrentUser()
    const token = await userApi.getTokenInGroup(currentUser.groupId!, currentUser.id!, `e2eTestTS-${randomUUID()}`, undefined, 3)
    expect(token.match(/[a-fA-F0-9]+/))
  })
})
