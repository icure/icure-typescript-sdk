import { EncryptedEntityWithType, EntityWithDelegationTypeName } from '../utils/EntityWithDelegationTypeName'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { DelegationMembersDetails, SecureDelegationsSecurityMetadataDecryptor } from './SecureDelegationsSecurityMetadataDecryptor'
import { SecureDelegationKeyMap } from '../../icc-api/model/internal/SecureDelegationKeyMap'
import { ExtendedApisUtils } from './ExtendedApisUtils'
import { ShareMetadataBehaviour } from './ShareMetadataBehaviour'
import { EntityShareRequest } from '../../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { CryptoPrimitives } from './CryptoPrimitives'
import { EncryptedFieldsManifest, parseEncryptedFields } from '../utils'
import { IccSecureDelegationKeyMapApi } from '../../icc-api/api/IccSecureDelegationKeyMapApi'
import { XHR } from '../../icc-api/api/XHR'
import { AuthenticationProvider, NoAuthenticationProvider } from '../auth/AuthenticationProvider'
import { ACCESS_CONTROL_KEYS_HEADER, AccessControlKeysHeadersProvider } from './AccessControlKeysHeadersProvider'
import { AccessControlSecretUtils } from './AccessControlSecretUtils'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'

// TODO could be optimised using bulk methods
export class DelegationsDeAnonymization {
  private readonly delegationKeyMapFieldsToEncrypt: EncryptedFieldsManifest
  private readonly delegationKeyMapApi: IccSecureDelegationKeyMapApi

  constructor(
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly secureDelegationsMetadataDecryptor: SecureDelegationsSecurityMetadataDecryptor,
    private readonly xapis: ExtendedApisUtils,
    private readonly cryptoPrimitives: CryptoPrimitives,
    private readonly accessControlSecretUtils: AccessControlSecretUtils,
    host: string,
    headers: { [key: string]: string },
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch,
    private readonly accessControlKeysHeadersProvider: AccessControlKeysHeadersProvider
  ) {
    this.delegationKeyMapFieldsToEncrypt = parseEncryptedFields(['delegate', 'delegator'], 'SecureDelegationKeyMap')
    this.delegationKeyMapApi = new IccSecureDelegationKeyMapApi(host, headers, authenticationProvider, fetchImpl)
  }

  /**
   * Creates / updates information to allow the data owners in {@link shareWithDataOwners} to de-anonymize the delegations contained within
   * {@link entity}.
   * Note that the delegation de-anonymization information may be used also with other entities of the same type.
   */
  async createOrUpdateDeAnonymizationInfo(entityWithType: EncryptedEntityWithType, shareWithDataOwners: string[]) {
    const delegationsDetails = Object.entries(await this.secureDelegationsMetadataDecryptor.getDelegationMemberDetails(entityWithType)).flatMap(
      ([canonicalKey, delegation]) => {
        const aliases = Object.entries(entityWithType.entity.securityMetadata?.keysEquivalences ?? {}).flatMap(([alias, canon]) => {
          if (canon == canonicalKey) {
            return [alias]
          } else {
            return []
          }
        })
        return [[canonicalKey, delegation], ...aliases.map((alias) => [alias, delegation])] as [string, DelegationMembersDetails][]
      }
    )
    const delegationsForDeanonInfoSharing = delegationsDetails.filter(([_, delegationInfo]) => {
      // Drop fully explicit ones: they don't need de-anonymization info
      return !delegationInfo.fullyExplicit
    })
    // A subset of delegations for which deanon info is relevant AND for which we can also create new info instead of sharing only existing one.
    const delegationsForNewDeanonInfoCreation = delegationsForDeanonInfoSharing.filter(([_, delegationInfo]) => {
      // Drop those for which we don't have the full information needed for the creation of new data.
      return !!delegationInfo.delegate && !!delegationInfo.delegator && !!delegationInfo.accessControlSecret
    })
    const existingDelegationsMap = await this.getDecryptedSecureDelegationKeyMaps(
      delegationsForDeanonInfoSharing.map((x) => x[0]),
      entityWithType.type
    )
    for (const delMapToShare of existingDelegationsMap) {
      await this.ensureDelegationKeyMapSharedWith(entityWithType.type, delMapToShare, shareWithDataOwners)
    }
    const existingDelegationsMapKeys = new Set(existingDelegationsMap.map((x) => x.delegationKey))
    const delegationsToCreate = delegationsForNewDeanonInfoCreation.filter(([k, _]) => !existingDelegationsMapKeys.has(k))
    for (const [delKey, membersDetails] of delegationsToCreate) {
      await this.createSecureDelegationKeyMap(entityWithType.type, delKey, membersDetails, shareWithDataOwners)
    }
  }

  /**
   * Get the data owners which can access the entity. See {@link EncryptedEntityXApi.getDataOwnersWithAccessTo} for more details.
   * @param entityWithType an entity.
   */
  async getDataOwnersWithAccessTo(entityWithType: EncryptedEntityWithType): Promise<{
    permissionsByDataOwnerId: { [dataOwnerId: string]: AccessLevelEnum }
    hasUnknownAnonymousDataOwners: boolean
  }> {
    return this.mergePermissions([
      await this.getDataOwnersWithAccessToSecureDelegations(entityWithType),
      {
        permissionsByDataOwnerId: Object.fromEntries(Object.keys(entityWithType.entity.delegations ?? {}).map((k) => [k, AccessLevelEnum.WRITE])),
        hasUnknownAnonymousDataOwners: false,
      },
    ])
  }

  private async getDataOwnersWithAccessToSecureDelegations(entityWithType: EncryptedEntityWithType): Promise<{
    permissionsByDataOwnerId: { [dataOwnerId: string]: AccessLevelEnum }
    hasUnknownAnonymousDataOwners: boolean
  }> {
    const secureDelegationDetails = await this.secureDelegationsMetadataDecryptor.getDelegationMemberDetails(entityWithType)
    const secureDelegationWithUnknownMembers = Object.entries(secureDelegationDetails).flatMap(([canonicalKey, delegation]) => {
      if (!delegation.delegate || !delegation.delegator) {
        const aliases = Object.entries(entityWithType.entity.securityMetadata?.keysEquivalences ?? {}).flatMap(([alias, canon]) => {
          if (canon == canonicalKey) {
            return [alias]
          } else {
            return []
          }
        })
        return [{ keys: [canonicalKey, ...aliases], delegation }]
      } else {
        return []
      }
    })
    const secureDelegationKeyMapsByDelegationKey = Object.fromEntries(
      (
        await this.getDecryptedSecureDelegationKeyMaps(
          secureDelegationWithUnknownMembers.flatMap(({ keys }) => keys),
          entityWithType.type
        )
      ).map((x) => [x.delegationKey, x])
    )
    const permissionsByDataOwnerId: { [dataOwnerId: string]: AccessLevelEnum } = {}
    let hasUnknownAnonymousDataOwners = false
    function addAccess(dataOwnerId: string, level: AccessLevelEnum) {
      if (permissionsByDataOwnerId[dataOwnerId] !== AccessLevelEnum.WRITE) {
        permissionsByDataOwnerId[dataOwnerId] = level
      }
    }
    for (const delegation of Object.values(secureDelegationDetails)) {
      if (delegation.delegate) addAccess(delegation.delegate, delegation.accessLevel)
      if (delegation.delegator) addAccess(delegation.delegator, delegation.accessLevel)
    }
    for (const { keys, delegation } of secureDelegationWithUnknownMembers) {
      const bestKey = keys.find((k) => {
        const currMap = secureDelegationKeyMapsByDelegationKey[k]
        return currMap && !!currMap.delegator && !!currMap.delegate
      })
      if (bestKey) {
        const keyMap = secureDelegationKeyMapsByDelegationKey[bestKey]
        addAccess(keyMap.delegate!, delegation.accessLevel)
        addAccess(keyMap.delegator!, delegation.accessLevel)
      } else {
        hasUnknownAnonymousDataOwners = true
      }
    }
    return { permissionsByDataOwnerId, hasUnknownAnonymousDataOwners }
  }

  private async mergePermissions(
    values: {
      permissionsByDataOwnerId: { [dataOwnerId: string]: AccessLevelEnum }
      hasUnknownAnonymousDataOwners: boolean
    }[]
  ): Promise<{
    permissionsByDataOwnerId: { [dataOwnerId: string]: AccessLevelEnum }
    hasUnknownAnonymousDataOwners: boolean
  }> {
    const accumulatedPermissions: { [dataOwnerId: string]: AccessLevelEnum } = {}
    let hasUnknownAnonymousDataOwners = false
    for (const v of values) {
      hasUnknownAnonymousDataOwners = hasUnknownAnonymousDataOwners || v.hasUnknownAnonymousDataOwners
      for (const [dataOwnerId, level] of Object.entries(v.permissionsByDataOwnerId)) {
        if (accumulatedPermissions[dataOwnerId] !== AccessLevelEnum.WRITE) {
          accumulatedPermissions[dataOwnerId] = level
        }
      }
    }
    return {
      permissionsByDataOwnerId: accumulatedPermissions,
      hasUnknownAnonymousDataOwners,
    }
  }

  private async getDecryptedSecureDelegationKeyMaps(
    delegationIds: string[],
    entityType: EntityWithDelegationTypeName
  ): Promise<SecureDelegationKeyMap[]> {
    if (delegationIds.length) {
      const encryptedMaps = await this.delegationKeyMapApi.getByDelegationKeys(
        { ids: delegationIds },
        await this.accessControlKeysHeadersProvider.getAccessControlKeysHeaders(entityType)
      )
      const res: SecureDelegationKeyMap[] = []
      for (const encryptedMap of encryptedMaps) {
        // Use the original entity type
        const decryptionResult = await this.xapis.decryptEntity(encryptedMap, entityType, (x) => new SecureDelegationKeyMap(x))
        if (decryptionResult.decrypted) {
          res.push(decryptionResult.entity)
        }
      }
      return res
    } else return []
  }

  // Important: to avoid potentially leaking links between entities of different types the key map calculates the secure delegation keys using the
  // same entity type as the delegation key for which they are mapping information.
  private async ensureDelegationKeyMapSharedWith(entityType: EntityWithDelegationTypeName, keyMap: SecureDelegationKeyMap, delegates: string[]) {
    if (!keyMap.delegator || !keyMap.delegate) throw new Error('Illegal state: key map is missing delegator or delegate info.')
    const dataOwnersWithAccessToMapThroughDelegation = Object.values(
      await this.secureDelegationsMetadataDecryptor.getDelegationMemberDetails({
        type: entityType,
        entity: keyMap,
      })
    )
      .flatMap((x) => [x.delegate, x.delegator])
      .filter((x) => !!x) as string[]
    // Delegator and delegate got access to the entity when it was first created: no need to share with them ever.
    const dataOwnersWithAccessToMap = new Set([keyMap.delegate, keyMap.delegator, ...dataOwnersWithAccessToMapThroughDelegation])
    const dataOwnersNeedingShare = delegates.filter((x) => !dataOwnersWithAccessToMap.has(x))
    if (dataOwnersNeedingShare.length) {
      ;(
        await this.xapis.simpleShareOrUpdateEncryptedEntityMetadata(
          { entity: keyMap, type: entityType },
          false,
          Object.fromEntries(
            dataOwnersNeedingShare.map((x) => [
              x,
              {
                shareSecretIds: [],
                shareEncryptionKeys: ShareMetadataBehaviour.REQUIRED,
                shareOwningEntityIds: ShareMetadataBehaviour.NEVER,
                requestedPermissions: RequestedPermissionEnum.FULL_READ,
              },
            ])
          ),
          async (request) =>
            this.delegationKeyMapApi.bulkShareSecureDelegationKeyMap(
              request,
              await this.accessControlKeysHeadersProvider.getAccessControlKeysHeaders(entityType)
            )
        )
      ).updatedEntityOrThrow
    }
  }

  // Important: to avoid potentially leaking links between entities of different types the key map calculates the secure delegation keys using the
  // same entity type as the delegation key for which they are mapping information.
  private async createSecureDelegationKeyMap(
    entityType: EntityWithDelegationTypeName,
    delegationKey: string,
    delegationMembersDetails: DelegationMembersDetails,
    delegates: string[]
  ) {
    if (!delegationMembersDetails.delegate || !delegationMembersDetails.delegator || !delegationMembersDetails.accessControlSecret)
      throw new Error('Illegal state: delegation members details are missing delegate, delegator or access control secret info.')
    const selfDoId = await this.dataOwnerApi.getCurrentDataOwnerId()
    // Ensure that both the delegator and delegate of the delegation this map refers tho can share it later on, even if they did not create it.
    // Usually either the delegator or delegate are the current data owner, but sometimes also the child of the delegator or delegate can do it.
    const initialDelegates = [delegationMembersDetails.delegate, delegationMembersDetails.delegator, ...delegates].filter((x) => x != selfDoId)
    const initalisedMapInfo = await this.xapis.entityWithInitialisedEncryptedMetadata<SecureDelegationKeyMap>(
      {
        id: this.cryptoPrimitives.crypto.randomUUID(),
        delegate: delegationMembersDetails.delegate,
        delegator: delegationMembersDetails.delegator,
        delegationKey: delegationKey,
      },
      entityType,
      undefined,
      undefined,
      true,
      false,
      Object.fromEntries(initialDelegates.map((x) => [x, AccessLevelEnum.READ]))
    )
    const encryptedKeyMap = await this.xapis.tryEncryptEntity(
      initalisedMapInfo.updatedEntity,
      entityType,
      this.delegationKeyMapFieldsToEncrypt,
      false,
      true,
      (x) => new SecureDelegationKeyMap(x)
    )
    await this.delegationKeyMapApi.create(
      encryptedKeyMap,
      new XHR.Header(
        ACCESS_CONTROL_KEYS_HEADER,
        await this.accessControlSecretUtils.getEncodedAccessControlKeys([delegationMembersDetails.accessControlSecret], entityType)
      )
    )
  }
}
