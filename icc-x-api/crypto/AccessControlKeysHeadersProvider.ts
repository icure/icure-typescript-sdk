import { ExchangeDataManager } from './ExchangeDataManager'
import { XHR } from '../../icc-api/api/XHR'
import { EntityWithDelegationTypeName } from '../utils/EntityWithDelegationTypeName'

export const ACCESS_CONTROL_KEYS_HEADER = 'Icure-Access-Control-Keys'

/**
 * @internal this class is intended for internal use only and may be changed without notice.
 */
export class AccessControlKeysHeadersProvider {
  constructor(private readonly exchangeDataManager: ExchangeDataManager) {}

  // This will be enough only as long as we don't use the entities sfks in the access control keys.
  /**
   * Add the access control keys headers to the provided initial headers, allowing access control on users with anonymous delegations.
   * @param initialHeaders the initial headers
   * @param entityType the type of entity which the user is attempting to retrieve.
   */
  async addAccessControlKeysHeaders(initialHeaders: XHR.Header[], entityType: EntityWithDelegationTypeName): Promise<XHR.Header[]> {
    const accessControlKeysValue = await this.exchangeDataManager.getAccessControlKeysValue(entityType)
    if (accessControlKeysValue) {
      return [...initialHeaders, new XHR.Header(ACCESS_CONTROL_KEYS_HEADER, accessControlKeysValue)]
    } else {
      return initialHeaders
    }
  }
}
