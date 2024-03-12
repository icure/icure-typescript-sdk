import { getEnvironmentInitializer, setLocalStorage, TestUtils } from '../../utils/test_utils'
import 'isomorphic-fetch'
import initMasterApi = TestUtils.initMasterApi
import { expect } from 'chai'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { IccCodeApi } from '../../../icc-api'
import { describe } from 'mocha'
import { Code } from '../../../icc-api/model/Code'
import { randomUUID } from 'crypto'

setLocalStorage(fetch)

let env: TestVars
let api: IccCodeApi

describe('IccArticleApi', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    api = (await initMasterApi(env)).codeApi
  })

  it('Should be able of getting codes by id', async () => {
    const codes = await api.createCodes(
      [randomUUID(), randomUUID(), randomUUID()].map(
        (code) => new Code({ id: `ICURE|TEST-${code}|1`, type: 'ICURE', code: `TEST-${code}`, version: '1' })
      )
    )

    const retrievedCodes = await api.getCodes(codes.map((it) => it.id!))
    retrievedCodes.forEach((code) => expect(codes.find((it) => it.id === code.id)).not.to.be.undefined)
  })
})
