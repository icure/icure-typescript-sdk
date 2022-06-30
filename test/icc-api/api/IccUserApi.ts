import { Api } from '../../../icc-x-api'
import { crypto } from '../../../node-compat'
import { expect } from 'chai'

describe('User', () => {
  it('should be capable of creating a token', async () => {
    const { userApi } = await Api('https://kraken.icure.dev/rest/v1', process.env.USER_LOGIN!, process.env.USER_PW!, crypto)
    const token = await userApi.getTokenInGroup(
      'ic-anotherdb-733fe193-cc7f-44fa-9fbd-38001d279995',
      'd922a448-b516-4f25-85b8-cbe73a20037a',
      'e2eTestUser'
    )
    expect(token.match(/[a-fA-F0-9]+/))
  })
})
