import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { getEnvironmentInitializer, hcp1Username, setLocalStorage } from '../../utils/test_utils'
import { IccRecoveryDataApi } from '../../../icc-api/api/internal/IccRecoveryDataApi'
import { BasicAuthenticationProvider, ua2b64, utf8_2ua } from '../../../icc-x-api'
import 'isomorphic-fetch'
import { RecoveryData } from '../../../icc-api/model/internal/RecoveryData'
import { randomUUID } from 'crypto'
import { expect } from 'chai'
import { XHR } from '../../../icc-api/api/XHR'
import XHRError = XHR.XHRError

let env: TestVars
let self: string
let api: IccRecoveryDataApi
setLocalStorage(fetch)

describe('Recovery data api', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    const hcp = env.dataOwnerDetails[hcp1Username]
    self = hcp.dataOwnerId
    api = new IccRecoveryDataApi(env.iCureUrl, {}, new BasicAuthenticationProvider(hcp.user, hcp.password), fetch)
  })

  function newRecoveryData(type: RecoveryData.Type = RecoveryData.Type.KEYPAIR_RECOVERY): RecoveryData {
    return new RecoveryData({
      id: randomUUID(),
      recipient: self,
      encryptedSelf: ua2b64(utf8_2ua(randomUUID())),
      type,
    })
  }

  async function checkDeleted(recoveryDataId: string) {
    await api.getRecoveryData(recoveryDataId).then(
      () => expect.fail('should not be able to retrieve deleted recovery data'),
      (err) => {
        expect(err).to.be.instanceof(XHRError)
        expect(err.statusCode).to.equal(404)
      }
    )
  }

  it('should be capable of creating recovery data', async () => {
    const recoveryData = newRecoveryData()
    const created = await api.createRecoveryData(recoveryData)
    expect(created.rev).to.not.be.empty
    expect(created.id).to.equal(recoveryData.id)
    expect(created.recipient).to.equal(recoveryData.recipient)
    expect(created.encryptedSelf).to.equal(recoveryData.encryptedSelf)
    expect(created.type).to.equal(recoveryData.type)
    expect(created.deletionDate).to.be.undefined
    expect(created.expirationInstant).to.be.undefined
  })

  it('should be capable of getting recovery data', async () => {
    const created = await api.createRecoveryData(newRecoveryData())
    const retrieved = await api.getRecoveryData(created.id!)
    expect(created).to.deep.equal(retrieved)
  })

  it('should be capable of deleting recovery data', async () => {
    const created = await api.createRecoveryData(newRecoveryData())
    await api.deleteRecoveryData(created.id!)
    await checkDeleted(created.id!)
  })

  it('should be capable of deleting all recovery data for a recipient', async () => {
    await api.deleteAllRecoveryDataForRecipient(self)
    const created1 = await api.createRecoveryData(newRecoveryData(RecoveryData.Type.KEYPAIR_RECOVERY))
    const created2 = await api.createRecoveryData(newRecoveryData(RecoveryData.Type.EXCHANGE_KEY_RECOVERY))
    const deleted = await api.deleteAllRecoveryDataForRecipient(self)
    await checkDeleted(created1.id!)
    await checkDeleted(created2.id!)
    expect(deleted.numberValue).to.equal(2)
  })

  it('should be capable of deleting all recovery data of a type for a recipient', async () => {
    await api.deleteAllRecoveryDataForRecipient(self)
    const created1 = await api.createRecoveryData(newRecoveryData(RecoveryData.Type.KEYPAIR_RECOVERY))
    const created2 = await api.createRecoveryData(newRecoveryData(RecoveryData.Type.EXCHANGE_KEY_RECOVERY))
    const created3 = await api.createRecoveryData(newRecoveryData(RecoveryData.Type.EXCHANGE_KEY_RECOVERY))
    const deleted = await api.deleteAllRecoveryDataOfTypeForRecipient(RecoveryData.Type.EXCHANGE_KEY_RECOVERY, self)
    expect(await api.getRecoveryData(created1.id!)).to.deep.equal(created1)
    await checkDeleted(created2.id!)
    await checkDeleted(created3.id!)
    expect(deleted.numberValue).to.equal(2)
  })
})
