import { IccClassificationApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as models from '../icc-api/model/models'

import * as _ from 'lodash'
import * as moment from 'moment'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider } from './auth/AuthenticationProvider'
import { CalendarItem } from '../icc-api/model/models'

export class IccClassificationXApi extends IccClassificationApi {
  crypto: IccCryptoXApi
  dataOwnerApi: IccDataOwnerXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    dataOwnerApi: IccDataOwnerXApi,
    authenticationProvider: AuthenticationProvider,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
    this.crypto = crypto
    this.dataOwnerApi = dataOwnerApi
  }

  async newInstance(
    user: models.User,
    patient: models.Patient,
    c: any = {},
    delegates: string[] = [],
    preferredSfk?: string,
    delegationTags?: string[]
  ): Promise<models.Classification> {
    const classification = _.assign(
      {
        id: this.crypto.primitives.randomUuid(),
        _type: 'org.taktik.icure.entities.Classification',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.dataOwnerApi.getDataOwnerOf(user),
        author: user.id,
        codes: [],
        tags: [],
        healthElementId: this.crypto.primitives.randomUuid(),
        openingDate: parseInt(moment().format('YYYYMMDDHHmmss')),
      },
      c || {}
    )

    const ownerId = this.dataOwnerApi.getDataOwnerOf(user)
    const sfk = patient ? preferredSfk ?? (await this.crypto.entities.secretIdsOf(patient, ownerId))[0] : undefined
    const extraDelegations = [...delegates, ...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])]
    return new models.Classification(
      await this.crypto.entities
        .entityWithInitialisedEncryptedMetadata(
          classification,
          patient?.id,
          sfk,
          false, // TODO should we actually initialise encryption keys anyway, to have everything future proof?
          extraDelegations,
          delegationTags
        )
        .then((x) => x.updatedEntity)
    )
  }

  async findBy(hcpartyId: string, patient: models.Patient) {
    const extractedKeys = await this.crypto.entities.secretIdsOf(patient, hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0] // TODO should this really be topmost parent?
    return extractedKeys && extractedKeys.length > 0
      ? this.findClassificationsByHCPartyPatientForeignKeys(topmostParentId, _.uniq(extractedKeys).join(','))
      : Promise.resolve([])
  }
}
