import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, setLocalStorage, TestUtils } from '../../utils/test_utils'
import 'isomorphic-fetch'
import initMasterApi = TestUtils.initMasterApi
import { expect } from 'chai'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { IccAgendaApi } from '../../../icc-api'
import { Agenda } from '../../../icc-api/model/Agenda'
import { describe } from 'mocha'

setLocalStorage(fetch)

let env: TestVars
let agendaApi: IccAgendaApi
const agendas: Agenda[] = []

describe('IccAgendaApi', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    agendaApi = (await initMasterApi(env)).agendaApi

    for (let i = 0; i < 10; i++) {
      const agenda = await agendaApi.createAgenda(
        new Agenda({
          id: randomUUID(),
          name: randomUUID(),
        })
      )
      agendas.push(agenda)
    }
  })

  it('Should be able of getting the Agendas using the deprecated method', async () => {
    const page = await agendaApi.getAgendas()
    page.forEach((it) => {
      const existingAgenda = agendas.find((a) => a.id === it.id)
      expect(existingAgenda).not.to.be.undefined
      expect(it.rev).to.be.eq(existingAgenda!!.rev!!)
    })
  })

  it('Should be able of getting the Agendas with pagination', async () => {
    const firstPage = await agendaApi.getAgendasWithPagination(undefined, 6)
    expect(firstPage.nextKeyPair).not.to.be.undefined
    expect(firstPage.rows).not.to.be.undefined

    const secondPage = await agendaApi.getAgendasWithPagination(firstPage.nextKeyPair?.startKeyDocId, 6)
    expect(secondPage.nextKeyPair).to.be.undefined
    expect(secondPage.rows).not.to.be.undefined

    const rows = firstPage.rows!!.concat(secondPage.rows!!)
    rows.forEach((it) => {
      const existingAgenda = agendas.find((a) => a.id === it.id)
      expect(existingAgenda).not.to.be.undefined
      expect(it.rev).to.be.eq(existingAgenda!!.rev!!)
    })
  })
})
