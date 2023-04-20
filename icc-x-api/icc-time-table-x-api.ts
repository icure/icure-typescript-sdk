import * as i18n from './rsrc/contact.i18n'

import * as _ from 'lodash'
import {IccTimeTableApi} from '../icc-api'
import {User} from '../icc-api/model/User'
import {TimeTable} from '../icc-api/model/TimeTable'
import {IccCryptoXApi} from './icc-crypto-x-api'
import {IccDataOwnerXApi} from './icc-data-owner-x-api'
import * as models from '../icc-api/model/models'
import {AuthenticationProvider, NoAuthenticationProvider} from './auth/AuthenticationProvider'
import {ShareMetadataBehaviour} from "./crypto/ShareMetadataBehaviour"

export class IccTimeTableXApi extends IccTimeTableApi {
  i18n: any = i18n
  crypto: IccCryptoXApi
  dataOwnerApi: IccDataOwnerXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    dataOwnerApi: IccDataOwnerXApi,
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
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

  /**
   * Creates a new instance of timetable with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param tt initialised data for the timetable. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param delegates initial delegates which will have access to the timetable other than the current data owner.
   * @param delegationTags tags for the initialised delegations.
   * @return a new instance of timetable.
   */
  async newInstance(user: User, tt: TimeTable, delegates: string[] = [], delegationTags?: string[]) {
    const timeTable = _.extend(
      {
        id: this.crypto.primitives.randomUuid(),
        _type: 'org.taktik.icure.entities.TimeTable',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.dataOwnerApi.getDataOwnerIdOf(user),
        author: user.id,
        codes: [],
        tags: [],
      },
      tt || {}
    )

    const extraDelegations = [...delegates, ...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.administrativeData ?? [])]
    return new models.TimeTable(
      await this.crypto.entities
        .entityWithInitialisedEncryptedMetadata(timeTable, undefined, undefined, true, extraDelegations, delegationTags)
        .then((x) => x.updatedEntity)
    )
  }

  /**
   * Share an existing time table with other data owners, allowing them to access the non-encrypted data of the time table and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the time table.
   * @param timeTable the time table to share.
   * @param optionalParams optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * time table does not have encrypted content.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async shareWith(
    delegateId: string,
    timeTable: models.TimeTable,
    optionalParams: {
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.TimeTable> {
    return await this.modifyTimeTable(
      await this.crypto.entities.entityWithAutoExtendedEncryptedMetadata(
        timeTable,
        delegateId,
        undefined,
        optionalParams.shareEncryptionKey,
        ShareMetadataBehaviour.IF_AVAILABLE
      )
    )
  }
}
