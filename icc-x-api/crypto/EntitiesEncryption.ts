import { Delegation, EncryptedEntity, EncryptedEntityStub } from '../../icc-api/model/models'
import { DataOwnerWithType, IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { ExchangeKeysManager } from './ExchangeKeysManager'
import { b2a, crypt, decrypt, string2ua, truncateTrailingNulls, ua2hex, ua2string, ua2utf8, utf8_2ua, hex2ua } from '../utils'
import * as _ from 'lodash'
import { CryptoPrimitives } from './CryptoPrimitives'
import { arrayEquals } from '../utils/collection-utils'

/**
 * Give access to functions for retrieving encryption metadata of entities.
 */
export class EntitiesEncryption {
  private readonly primitives: CryptoPrimitives
  private readonly dataOwnerApi: IccDataOwnerXApi
  private readonly exchangeKeysManager: ExchangeKeysManager

  constructor(primitives: CryptoPrimitives, dataOwnerApi: IccDataOwnerXApi, exchangeKeysManager: ExchangeKeysManager) {
    this.primitives = primitives
    this.dataOwnerApi = dataOwnerApi
    this.exchangeKeysManager = exchangeKeysManager
  }

  /**
   * Get the encryption keys of an entity that the provided data owner can access, potentially using the keys for his parent.
   * There should only be one encryption key for each entity, but the method supports more to allow to deal with conflicts and merged duplicate data.
   * @param entity an encrypted entity.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @param tagsFilter allows to obtain only encryption keys associated to tags which satisfy the provided filter.
   * @return the encryption keys that the provided data owner can decrypt, deduplicated.
   */
  async encryptionKeysOf(
    entity: EncryptedEntity | EncryptedEntityStub,
    dataOwnerId?: string,
    tagsFilter: (tags: string[]) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<string[]> {
    // Legacy entities may have encryption keys in delegations.
    return this.extractMergedHierarchyFromDelegationAndOwner(
      Object.keys(entity.encryptionKeys ?? {}).length > 0 ? entity.encryptionKeys! : entity.delegations ?? {},
      dataOwnerId,
      (k) => this.validateEncryptionKey(k),
      (t) => tagsFilter(t)
    )
  }

  /**
   * Get the encryption keys of an entity that the current data owner and his parents can access. The resulting array contains the keys for each data
   * owner in the hierarchy which can be decrypted using only that data owner keys (excludes keys accessible through the parent keys). The order of
   * the array is the same as in {@link IccDataOwnerXApi.getCurrentDataOwnerHierarchyIds}.
   * Note that different data owners may have access to the same keys, but the keys extracted for each data owner are deduplicated.
   * There should only be one encryption key for each entity, but the method supports more to allow to deal with conflicts and merged duplicate data.
   * @param entity an encrypted entity.
   * @param tagsFilter allows to obtain only encryption keys associated to tags which satisfy the provided filter.
   * @return the encryption keys that each member of the current data owner hierarchy can decrypt using only his keys and not keys of his parents.
   */
  async encryptionKeysForHcpHierarchyOf(
    entity: EncryptedEntity | EncryptedEntityStub,
    tagsFilter: (tags: string[]) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<{ ownerId: string; extracted: string[] }[]> {
    return this.extractedHierarchyFromDelegation(
      entity.encryptionKeys ?? {},
      (k) => this.validateEncryptionKey(k),
      (t) => tagsFilter(t)
    )
  }

  /**
   * Get the secret ids (SFKs) of an entity that the provided data owner can access, potentially using the keys for his parent.
   * @param entity an encrypted entity.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @param tagsFilter allows to obtain only secret ids associated to tags which satisfy the provided filter.
   * @return the secret ids (SFKs) that the provided data owner can decrypt, deduplicated.
   */
  async secretIdsOf(
    entity: EncryptedEntity | EncryptedEntityStub,
    dataOwnerId?: string,
    tagsFilter: (tags: string[]) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<string[]> {
    return this.extractMergedHierarchyFromDelegationAndOwner(
      entity.delegations ?? {},
      dataOwnerId,
      (k) => this.validateSecretId(k),
      (t) => tagsFilter(t)
    )
  }

  /**
   * Get the secret ids (SFKs) of an entity that the current data owner and his parents can access. The resulting array contains the ids for each data
   * owner in the hierarchy which can be decrypted using only that data owner keys (excludes ids accessible through the parent keys). The order of
   * the array is the same as in {@link IccDataOwnerXApi.getCurrentDataOwnerHierarchyIds}.
   * Note that different data owners may have access to the same secret ids, but the secret ids extracted for each data owner are deduplicated.
   * @param entity an encrypted entity.
   * @param tagsFilter allows to obtain only secret ids associated to tags which satisfy the provided filter.
   * @return the secret ids that each member of the current data owner hierarchy can decrypt using only his keys and not keys of his parents.
   */
  async secretIdsForHcpHierarchyOf(
    entity: EncryptedEntity | EncryptedEntityStub,
    tagsFilter: (tags: string[]) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<{ ownerId: string; extracted: string[] }[]> {
    return this.extractedHierarchyFromDelegation(
      entity.delegations ?? {},
      (k) => this.validateSecretId(k),
      (t) => tagsFilter(t)
    )
  }

  /**
   * Get the decrypted owning entity ids (formerly CFKs) for the provided entity that can be decrypted using the private keys of the current data
   * owner and his parents. The owning entity id would be, for example, the id of a patient for contact and healthcare elements, or the id of a
   * message for documents.
   * There should only be one owning entity id for each entity, but the method supports more to allow to deal with conflicts and merged duplicate
   * data.
   * @param entity an encrypted entity.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @param tagsFilter allows to obtain only owning entity ids associated to tags which satisfy the provided filter.
   * @return the owning entity ids (CFKs) that the provided data owner can decrypt, deduplicated.
   */
  async owningEntityIdsOf(
    entity: EncryptedEntity | EncryptedEntityStub,
    dataOwnerId?: string,
    tagsFilter: (tags: string[]) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<string[]> {
    return this.extractMergedHierarchyFromDelegationAndOwner(
      entity.cryptedForeignKeys ?? {},
      dataOwnerId,
      (k) => this.validateOwningEntityId(k),
      (t) => tagsFilter(t)
    )
  }

  /**
   * Get the decrypted owning entity ids (formerly CFKs) for the provided entity that can be decrypted using the private keys of the current data
   * owner and his parents. The owning entity id would be, for example, the id of a patient for contact and healthcare elements, or the id of a
   * message for documents.
   * The resulting array contains the ids for each data owner in the hierarchy which can be decrypted using only that data owner keys (excludes ids
   * accessible through the parent keys). The order of the array is the same as in {@link IccDataOwnerXApi.getCurrentDataOwnerHierarchyIds}.
   * Note that different data owners may have access to the same owning entity ids, but the owning entity ids extracted for each data owner are
   * deduplicated in case they could be accessed through different delegations.
   * There should only be one owning entity id for each entity, but the method supports more to allow to deal with conflicts and merged duplicate
   * data.
   * @param entity an encrypted entity.
   * @param tagsFilter allows to obtain only owning entity ids associated to tags which satisfy the provided filter.
   * @return the owning entity ids that each member of the current data owner hierarchy can decrypt using only his keys and not keys of his parents.
   */
  async owningEntityIdsForHcpHierarchyOf(
    entity: EncryptedEntity | EncryptedEntityStub,
    tagsFilter: (tags: string[]) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<{ ownerId: string; extracted: string[] }[]> {
    return this.extractedHierarchyFromDelegation(
      entity.cryptedForeignKeys ?? {},
      (k) => this.validateOwningEntityId(k),
      (t) => tagsFilter(t)
    )
  }

  /**
   * @internal this method is intended only for internal use and may be changed without notice.
   * Initializes encryption metadata for an entity. This includes the encrypted secret id, owning entity id, and encryption key for the entity, and
   * the clear text secret foreign key of the parent entity.
   * This method returns a modified copy of the entity.
   * @param entity entity which requires encryption metadata initialisation.
   * @param owningEntity id of the owning entity, if any (e.g. patient id for Contact/HealtchareElement, message id for Document, ...).
   * @param owningEntitySecretId secret id of the parent entity, to use in the secret foreign keys for the provided entity, if any.
   * @param initialiseEncryptionKeys if false this method will not initialize any encryption keys. Use only for entities which use delegations for
   * access control but don't actually have any encrypted content.
   * @param additionalDelegations automatically shares the
   * @param tags tags to associate with the initial encryption keys and metadata
   * @throws if the entity already has non-empty values for encryption metadata.
   * @return an updated copy of the entity.
   */
  async entityWithInitialisedEncryptedMetadata<T extends EncryptedEntity>(
    entity: T,
    owningEntity: string | undefined,
    owningEntitySecretId: string | undefined,
    initialiseEncryptionKeys: boolean,
    additionalDelegations: string[] = [],
    tags: string[] = []
  ): Promise<{
    updatedEntity: T
    rawEncryptionKey: string | undefined
    secretId: string
  }> {
    this.throwDetailedExceptionForInvalidParameter('entity.id', entity.id, 'entityWithInitialisedEncryptedMetadata', arguments)
    this.checkEmptyEncryptionMetadata(entity)
    const secretId = this.primitives.randomUuid()
    const rawEncryptionKey = initialiseEncryptionKeys ? ua2hex(this.primitives.randomBytes(16)) : undefined
    const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
    const allIds = [selfId, ...new Set(additionalDelegations.filter((x) => x !== selfId))]
    const loadKeysResult = await this.loadEncryptionKeysForDelegates(entity, allIds)
    const updatedEntity = await allIds.reduce<Promise<T>>(
      async (prevUpdate, delegateId) =>
        await this.createOrUpdateEntityDelegations(
          await prevUpdate,
          delegateId,
          [],
          [],
          [],
          [secretId],
          initialiseEncryptionKeys ? [rawEncryptionKey!] : [],
          owningEntity ? [owningEntity] : [],
          tags,
          loadKeysResult.keysForDelegates
        ),
      Promise.resolve(loadKeysResult.updatedEntity)
    )
    if (owningEntitySecretId) {
      updatedEntity.secretForeignKeys = [owningEntitySecretId]
    }
    return { updatedEntity, secretId, rawEncryptionKey }
  }

  /**
   * Updates encryption metadata for an entity in order to share it with a delegate or in order to add additional encrypted metadata for an existing
   * delegate.
   * The first time this method is used for a specific delegate it will give access to all unencrypted content of the entity to the delegate data
   * owner. Additionally, this method also allows to share new or existing secret ids (shareSecretId), encryption keys (shareEncryptionKeys) and
   * owning entity ids (shareOwningEntityIds) for the entity.
   * You can use methods like {@link secretIdsOf}, {@link secretIdsForHcpHierarchyOf}, {@link encryptionKeysOf}, ... to retrieve the data you want to
   * share. In most cases you may want to share everything related to the entity, but note that if you use confidential delegations for patients you
   * may want to avoid sharing the confidential secret ids of the current user with other hcps.
   * This method returns a modified copy of the entity.
   * @param entity entity which requires encryption metadata initialisation.
   * @param delegateId id of the delegate to share data with.
   * @param shareSecretIds secret ids to share.
   * @param shareEncryptionKeys encryption keys to share.
   * @param shareOwningEntityIds owning enttiy ids to share.
   * @param newTags tags to associate with the new encryption keys and metadata. Existing data won't be changed.
   * @throws if any of the shareX parameters is set to `true` but the corresponding piece of data could not be retrieved.
   * @return an updated copy of the entity.
   */
  async entityWithExtendedEncryptedMetadata<T extends EncryptedEntity>(
    entity: T,
    delegateId: string,
    shareSecretIds: string[],
    shareEncryptionKeys: string[],
    shareOwningEntityIds: string[],
    newTags: string[] = []
  ): Promise<T> {
    this.throwDetailedExceptionForInvalidParameter('entity.id', entity.id, 'entityWithSharedEncryptedMetadata', arguments)
    async function checkInputAndGet(input: string[], inputName: string, validate: (x: string) => boolean | Promise<boolean>): Promise<string[]> {
      for (const x of input) {
        const validation = validate(x)
        if (validation !== true && validation !== false && !(await validation)) throw new Error(`Invalid input for ${inputName}.`)
      }
      return input
    }
    const secretIdsToShare = await checkInputAndGet(shareSecretIds, 'secretIds', (x) => this.validateSecretId(x))
    const encryptionKeysToShare = await checkInputAndGet(shareEncryptionKeys, 'encryptionKeys', (x) => this.validateEncryptionKey(x))
    const owningEntityIdsToShare = await checkInputAndGet(shareOwningEntityIds, 'owningEntityIds', (x) => this.validateOwningEntityId(x))
    const deduplicateInfoSecretIds = await this.deduplicateDelegationsAndFilterRequiredEntries(
      delegateId,
      entity.delegations ?? {},
      secretIdsToShare,
      (x) => this.validateSecretId(x)
    )
    const deduplicateInfoEncryptionKeys = await this.deduplicateDelegationsAndFilterRequiredEntries(
      delegateId,
      entity.encryptionKeys ?? {},
      encryptionKeysToShare,
      (x) => this.validateEncryptionKey(x)
    )
    const deduplicateInfoOwningEntityIds = await this.deduplicateDelegationsAndFilterRequiredEntries(
      delegateId,
      entity.cryptedForeignKeys ?? {},
      owningEntityIdsToShare,
      (x) => this.validateOwningEntityId(x)
    )
    /*TODO
     * Temporary hack since secret id is necessary to create a delegation for access control: if there is no delegation existing from me to the
     * delegate and there is no new secret id to be created create a new random id.
     */
    const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
    if (deduplicateInfoSecretIds.missingEntries.length === 0 && !deduplicateInfoSecretIds.deduplicatedDelegations.some((d) => d.owner === selfId)) {
      deduplicateInfoSecretIds.missingEntries.push(this.primitives.randomUuid())
    }
    if (
      deduplicateInfoSecretIds.missingEntries.length === 0 &&
      deduplicateInfoEncryptionKeys.missingEntries.length === 0 &&
      deduplicateInfoOwningEntityIds.missingEntries.length === 0
    )
      return _.cloneDeep(entity)
    const { updatedEntity, keysForDelegates } = await this.loadEncryptionKeysForDelegates(entity, [delegateId])
    return this.createOrUpdateEntityDelegations(
      updatedEntity,
      delegateId,
      deduplicateInfoSecretIds.deduplicatedDelegations,
      deduplicateInfoEncryptionKeys.deduplicatedDelegations,
      deduplicateInfoOwningEntityIds.deduplicatedDelegations,
      deduplicateInfoSecretIds.missingEntries,
      deduplicateInfoEncryptionKeys.missingEntries,
      deduplicateInfoOwningEntityIds.missingEntries,
      newTags,
      keysForDelegates
    )
  }

  /**
   * Encrypts data using a key of the entity that the provided data owner can access (current data owner by default). If the provided data owner can
   * access multiple encryption keys of the entity there is no guarantee on which key will be used.
   * Note: you should not use this method to encrypt the `encryptedSelf` of iCure entities, since that will be automatically handled by the extended
   * apis. You should use this method only to encrypt additional data, such as document attachments.
   * @param entity an entity.
   * @param content data of the entity which you want to encrypt.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @param tagsFilter allows to use for encryption only keys associated to tags which pass the filter.
   * @return the encrypted data.
   * @throws if the provided data owner can't access any encryption keys for the entity.
   */
  async encryptDataOf(
    entity: EncryptedEntity | EncryptedEntityStub,
    content: ArrayBuffer | Uint8Array,
    dataOwnerId?: string,
    tagsFilter: (tags: string[]) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<ArrayBuffer> {
    const keys = await this.encryptionKeysOf(await this.ensureEncryptionKeysInitialised(entity), dataOwnerId, tagsFilter)
    if (keys.length === 0)
      throw new Error(
        `Could not extract any encryption keys of entity ${entity} for data owner ${
          dataOwnerId ?? (await this.dataOwnerApi.getCurrentDataOwnerId())
        }.`
      )
    return this.primitives.AES.encryptWithRawKey(keys[0], content)
  }

  /**
   * Decrypts data using a key of the entity that the provided data owner can access (current data owner by default). If the provided data owner can
   * access multiple encryption keys each of them will be tried for decryption until one of them gives a result that is valid according to the
   * provided validator.
   * Note: you should not use this method to decrypt the `encryptedSelf` of iCure entities, since that will be automatically handled by the extended
   * apis. You should use this method only to decrypt additional data, such as document attachments.
   * @param entity an entity.
   * @param content data of the entity which you want to decrypt.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @param validator a function which verifies the correctness of decrypted content: helps to identify decryption with the wrong key without relying
   * solely on padding.
   * @param tagsFilter allows to use for decryption only keys associated to tags which pass the filter.
   * @return the decrypted data.
   * @throws if the provided data owner can't access any encryption keys for the entity, or if no key could be found which provided valid decrypted
   * content according to the validator.
   */
  async decryptDataOf(
    entity: EncryptedEntity | EncryptedEntityStub,
    content: ArrayBuffer | Uint8Array,
    validator: (decryptedData: ArrayBuffer) => Promise<boolean> = () => Promise.resolve(true),
    dataOwnerId?: string,
    tagsFilter: (tags: string[]) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<ArrayBuffer> {
    const keys = await this.encryptionKeysOf(entity, dataOwnerId, tagsFilter)
    for (const key of keys) {
      try {
        const decrypted = await this.primitives.AES.decryptWithRawKey(key, content)
        if (await validator(decrypted)) return decrypted
      } catch (e) {
        /* ignore */
      }
    }
    throw new Error(
      `No valid key found to decrypt data of ${entity} for data owner ${dataOwnerId ?? (await this.dataOwnerApi.getCurrentDataOwnerId())}.`
    )
  }

  /**
   * @internal this method is intended for internal use only and may be changed without notice.
   * Decrypts the content of an encrypted entity.
   */
  async decryptEntity<T extends EncryptedEntity>(
    entity: T,
    ownerId: string,
    constructor: (json: any) => T
  ): Promise<{ entity: T; decrypted: boolean }> {
    if (!entity.encryptedSelf) return { entity, decrypted: true }
    const encryptionKeys = await this.importAllValidKeys(await this.encryptionKeysOf(entity, ownerId))
    if (!encryptionKeys.length) return { entity, decrypted: false }
    return {
      entity: constructor(
        await decrypt(entity, async (encrypted) => {
          return (await this.tryDecryptJson(encryptionKeys, encrypted, false)) ?? {}
        })
      ),
      decrypted: true,
    }
  }

  /**
   * @internal this method is intended for internal use only and may be changed without notice.
   * Tries using the provided keys to decrypt some json.
   */
  async tryDecryptJson(
    potentialKeys: { key: CryptoKey; raw: string }[],
    encrypted: Uint8Array,
    truncateTrailingDecryptedNulls: boolean
  ): Promise<{} | undefined> {
    for (const key of potentialKeys) {
      try {
        const decrypted = (await this.primitives.AES.decrypt(key.key, encrypted, key.raw)) ?? encrypted
        return JSON.parse(ua2utf8(truncateTrailingDecryptedNulls ? truncateTrailingNulls(new Uint8Array(decrypted)) : decrypted))
      } catch (e) {}
    }
    return undefined
  }

  /**
   * @internal this method is intended for internal use only and may be changed without notice.
   * Tries to encrypt the content of an encrypted entity.
   * 1. If valid key for encryption is found the method returns the entity with the encrypted fields specified by cryptedKeys
   * 2. If requireEncryption is true and no key could be found for encryption of the entity the method fails.
   * 3. If requireEncryption is false and no key could be found for encryption the method will only check that the entity does not specify any value
   * for fields which should be encrypted according to cryptedKeys (e.g. note in a patient by default). If the entity specifies a value for any field
   * which should be encrypted the method throws an error, otherwise the method returns the original entity.
   */
  async tryEncryptEntity<T extends EncryptedEntity>(
    entity: T,
    dataOwnerId: string,
    cryptedKeys: string[],
    encodeBinaryData: boolean,
    requireEncryption: boolean,
    constructor: (json: any) => T
  ): Promise<T> {
    const entityWithInitialisedEncryptionKeys = await this.ensureEncryptionKeysInitialised(entity)
    const encryptionKey = await this.tryImportFirstValidKey(await this.encryptionKeysOf(entity, dataOwnerId), entity.id!)
    if (!!encryptionKey) {
      return constructor(
        await crypt(
          entityWithInitialisedEncryptionKeys,
          (obj) => {
            const json = encodeBinaryData
              ? JSON.stringify(obj, (k, v) => {
                  return v instanceof ArrayBuffer || v instanceof Uint8Array
                    ? b2a(new Uint8Array(v).reduce((d, b) => d + String.fromCharCode(b), ''))
                    : v
                })
              : JSON.stringify(obj)
            return this.primitives.AES.encrypt(encryptionKey.key, utf8_2ua(json), encryptionKey.raw)
          },
          cryptedKeys
        )
      )
    } else if (requireEncryption) {
      throw new Error(`No key found for encryption of entity ${entity}`)
    } else {
      const cryptedCopyWithRandomKey = await crypt(
        _.cloneDeep(entity),
        async (obj: { [key: string]: string }) => Promise.resolve(new ArrayBuffer(1)),
        cryptedKeys
      )
      if (
        !_.isEqual(
          _.omitBy({ ...cryptedCopyWithRandomKey, encryptedSelf: undefined }, _.isNil),
          _.omitBy({ ...entity, encryptedSelf: undefined }, _.isNil)
        )
      ) {
        throw new Error(`Impossible to modify encrypted value of an entity if no encryption key is known.\n${entity}`)
      }
      return entity
    }
  }

  /**
   * @internal This method is for internal use only and may be changed without notice.
   * Ensures that the encryption keys of an entity are initialised. If not will throw an exception or initialise them depending on the content of
   * the entity. This function supports migration of entities using older encryption schemes (delegation only without encrypted keys) or entities
   * which were previously not encrypted.
   */
  async ensureEncryptionKeysInitialised<T extends EncryptedEntity>(entity: T): Promise<T> {
    if (Object.keys(entity.encryptionKeys ?? {}).length > 0) return entity
    if (!entity.rev) {
      throw new Error(
        'New encrypted entity is lacking encryption metadata. ' +
          'Please instantiate new entities using the `newInstance` method from the respective extended api.'
      )
    }
    /*
     * If entity was using delegations as legacy encryption keys we will essentially revoke the access to the encrypted data for all other data
     * owners. This however should not be a problem as this form of legacy entities should not exist anymore, and it should be present only in the
     * databases of hcps without collaborators.
     */
    return await this.entityWithExtendedEncryptedMetadata(
      entity,
      await this.dataOwnerApi.getCurrentDataOwnerId(),
      [],
      [ua2hex(this.primitives.randomBytes(16))],
      []
    )
  }

  /**
   * Get the decrypted content of a delegation-like object which the provided data owner would be able to access using ONLY HIS EXCHANGE KEYS (does
   * not consider exchange keys for parents).
   * Note that the retrieved exchange keys are decrypted using the private keys available on the device, and results may vary from other devices.
   * @param dataOwnerId id of a data owner, he should be part of the current data owner hierarchy.
   * @param delegations a delegation-like object containing the encrypted key
   * @param includeFromDelegations if true also considers delegation from the provided data owner (or parents) to look for values. This allows to
   * decrypt delegations associated to exchange keys recovered after a giveAccessBack request.
   * @param validateDecrypted validates the decrypted result, to drop decryption results with wrong key that still gave a valid checksum.
   * @param tagsFilter allows to obtain only encryption keys associated to tags which satisfy the provided filter.
   * @return the key which could be decrypted using only keys available on the current device and delegations from/to the provided data owner. May
   * contain duplicates.
   */
  private async extractFromDelegationsForDataOwner(
    dataOwnerId: string,
    delegations: { [delegateId: string]: Delegation[] },
    includeFromDelegations: boolean,
    validateDecrypted: (result: string) => boolean | Promise<boolean>,
    tagsFilter: (tags: string[]) => Promise<boolean>
  ): Promise<string[]> {
    const delegationsWithOwner = includeFromDelegations
      ? Object.entries(delegations).flatMap(([delegateId, delegations]) =>
          dataOwnerId === delegateId
            ? this.populateDelegatedTo(delegateId, delegations)
            : this.populateDelegatedTo(
                delegateId,
                delegations.filter((d) => d.owner === dataOwnerId)
              )
        )
      : delegations[dataOwnerId] ?? []
    const res = []
    for (const delegation of delegationsWithOwner) {
      if (await tagsFilter(delegation.tags ?? [])) {
        const decrypted = await this.tryDecryptDelegation(delegation, (k) => validateDecrypted(k))
        if (decrypted) res.push(decrypted)
      }
    }
    return res
  }

  // Ensures that the delegatedTo field of delegations has the appropriate values, else returns a copy of the delegations with the appropriate value.
  private populateDelegatedTo(delegateId: string, delegations: Delegation[]): Delegation[] {
    return delegations.map((d) => (d.delegatedTo === delegateId ? d : { ...d, delegatedTo: delegateId }))
  }

  private async extractedHierarchyFromDelegation(
    delegations: { [delegateId: string]: Delegation[] },
    validateDecrypted: (result: string) => boolean | Promise<boolean>,
    tagsFilter: (tags: string[]) => Promise<boolean>
  ): Promise<{ ownerId: string; extracted: string[] }[]> {
    return Promise.all(
      (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()).map(async (ownerId) => {
        const extracted = this.deduplicate(
          await this.extractFromDelegationsForDataOwner(
            ownerId,
            delegations,
            true,
            (k) => validateDecrypted(k),
            (t) => tagsFilter(t)
          )
        )
        return { ownerId, extracted }
      })
    )
  }

  /**
   * @internal This method should be private but is currently public/internal to allow to continue supporting legacy methods
   */
  async extractMergedHierarchyFromDelegationAndOwner(
    delegations: { [delegateId: string]: Delegation[] },
    dataOwnerId: string | undefined,
    validateDecrypted: (result: string) => boolean | Promise<boolean>,
    tagsFilter: (tags: string[]) => Promise<boolean>
  ): Promise<string[]> {
    const hierarchy = dataOwnerId
      ? await this.dataOwnerApi.getCurrentDataOwnerHierarchyIdsFrom(dataOwnerId)
      : await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()
    const extractedByOwner = await Promise.all(
      // Reverse is just to keep method behaviour as close as possible to the legacy behaviour, in case someone depended on the ordering.
      [...hierarchy].reverse().map((ownerId) =>
        this.extractFromDelegationsForDataOwner(
          ownerId,
          delegations,
          true,
          (k) => validateDecrypted(k),
          (t) => tagsFilter(t)
        )
      )
    )
    return this.deduplicate(extractedByOwner.flatMap((x) => x))
  }

  private async tryDecryptDelegation(
    delegation: Delegation,
    validateDecrypted: (result: string) => boolean | Promise<boolean>
  ): Promise<string | undefined> {
    const exchangeKeys = await this.exchangeKeysManager.getDecryptionExchangeKeysFor(delegation.owner!, delegation.delegatedTo!)
    for (const key of exchangeKeys) {
      try {
        // Format of encrypted key for any delegation should be entityId:key, but with the merging of entities the entityId might not match the
        // current id. As a checksum we are only verifying that the decrypted bytes can be represented as a string with exactly one ':'.
        // Additionally, we also have a validator that is specific for each type of delegation content (encryption key, secret id, ...)
        const decrypted = ua2string(await this.primitives.AES.decrypt(key, hex2ua(delegation.key!)))
        const decryptedSplit = decrypted.split(':')
        if (decryptedSplit.length === 2) {
          const validation = validateDecrypted(decryptedSplit[1])
          if (validation === true || (validation !== false && (await validation))) return decryptedSplit[1]
        } else {
          console.warn("Error in the decrypted delegation: content should contain exactly 1 ':', the delegation is ignored.")
        }
      } catch (e) {
        // Do nothing: the delegation uses another exchange key owner->delegator
      }
    }
  }

  private async tryImportKey(key: string): Promise<CryptoKey | undefined> {
    if (!/^[0-9A-Fa-f\-]+$/g.test(key)) return undefined
    try {
      return await this.primitives.AES.importKey('raw', hex2ua(key.replace(/-/g, '')))
    } catch (e) {
      console.warn(`Could not import key ${key} as an encryption key.`, e)
      return undefined
    }
  }

  /**
   * @internal this method is for internal use only and may be changed without notice.
   */
  async importFirstValidKey(keys: string[], entityId: string): Promise<{ key: CryptoKey; raw: string }> {
    const res = await this.tryImportFirstValidKey(keys, entityId)
    if (!res) throw new Error(`Could not find any valid key for entity ${entityId}.`)
    return res
  }

  private async tryImportFirstValidKey(keys: string[], entityId: string): Promise<{ key: CryptoKey; raw: string } | undefined> {
    for (const key of keys) {
      const imported = await this.tryImportKey(key)
      if (imported) return { key: imported, raw: key }
    }
  }

  /**
   * @internal this method is for internal use only and may be changed without notice.
   */
  async importAllValidKeys(keys: string[]): Promise<{ key: CryptoKey; raw: string }[]> {
    const res = []
    for (const key of keys) {
      const imported = await this.tryImportKey(key)
      if (imported) res.push({ key: imported, raw: key })
    }
    return res
  }

  private async validateEncryptionKey(key: string): Promise<boolean> {
    return !!(await this.tryImportKey(key))
  }

  private validateSecretId(key: string): boolean {
    return !!key
  }

  private validateOwningEntityId(key: string): boolean {
    return !!key
  }

  private async createEncryptionKeyDelegation(
    entityId: string,
    delegateId: string,
    exchangeKey: CryptoKey,
    encryptionKey: string,
    newTags: string[]
  ): Promise<Delegation> {
    if (!(await this.validateEncryptionKey(encryptionKey))) throw new Error(`Invalid encryption key ${encryptionKey}`)
    return this.createDelegation(entityId, delegateId, exchangeKey, encryptionKey, newTags)
  }

  private async createSecretIdDelegation(
    entityId: string,
    delegateId: string,
    exchangeKey: CryptoKey,
    secretId: string,
    newTags: string[]
  ): Promise<Delegation> {
    if (!this.validateSecretId(secretId)) throw new Error(`Invalid secret id ${secretId}`)
    return this.createDelegation(entityId, delegateId, exchangeKey, secretId, newTags)
  }

  private async createOwningEntityIdDelegation(
    entityId: string,
    delegateId: string,
    exchangeKey: CryptoKey,
    owningEntityId: string,
    newTags: string[]
  ): Promise<Delegation> {
    if (!this.validateOwningEntityId(owningEntityId)) throw new Error(`Invalid owning id ${owningEntityId}`)
    return this.createDelegation(entityId, delegateId, exchangeKey, owningEntityId, newTags)
  }

  private async createDelegation(
    entityId: string,
    delegateId: string,
    exchangeKey: CryptoKey,
    content: string,
    newTags: string[]
  ): Promise<Delegation> {
    if (entityId.includes(':')) throw new Error("Ids for encrypted entities are not allowed to contain ':'")
    if (content.includes(':')) throw new Error("Content of delegations can not contain ':'")
    return {
      delegatedTo: delegateId,
      owner: await this.dataOwnerApi.getCurrentDataOwnerId(),
      key: ua2hex(await this.primitives.AES.encrypt(exchangeKey, string2ua(entityId + ':' + content))),
      tags: newTags,
    }
  }

  private async loadEncryptionKeysForDelegates<T extends EncryptedEntity>(
    entity: T,
    delegates: string[]
  ): Promise<{ updatedEntity: T; keysForDelegates: { [delegateId: string]: CryptoKey[] } }> {
    const { updatedDelegator, keysForDelegates } = await delegates.reduce(
      async (acc, delegateId) => {
        const awaitedAcc = await acc
        const currUpdateResult = await this.exchangeKeysManager.getOrCreateEncryptionExchangeKeysTo(delegateId)
        return {
          updatedDelegator: currUpdateResult.updatedDelegator ?? awaitedAcc.updatedDelegator,
          keysForDelegates: {
            ...awaitedAcc.keysForDelegates,
            [delegateId]: currUpdateResult.keys,
          },
        }
      },
      Promise.resolve({
        updatedDelegator: undefined as DataOwnerWithType | undefined,
        keysForDelegates: {} as { [delegateId: string]: CryptoKey[] },
      })
    )
    const updatedEntity =
      entity.id === updatedDelegator?.dataOwner?.id
        ? {
            ...entity,
            rev: updatedDelegator!.dataOwner.rev,
            hcPartyKeys: updatedDelegator!.dataOwner.hcPartyKeys,
            aesExchangeKeys: updatedDelegator!.dataOwner.aesExchangeKeys,
          }
        : entity
    return { updatedEntity, keysForDelegates }
  }

  private async createOrUpdateEntityDelegations<T extends EncryptedEntity>(
    entity: T,
    delegateId: string,
    existingSecretIds: Delegation[],
    existingEncryptionKeys: Delegation[],
    existingOwningEntityIds: Delegation[],
    newSecretIds: string[],
    newEncryptionKeys: string[],
    newOwningEntityIds: string[],
    newTags: string[],
    keysForDelegates: { [delegateId: string]: CryptoKey[] }
  ): Promise<T> {
    const entityCopy = _.cloneDeep(entity)
    if (newSecretIds.length === 0 && newEncryptionKeys.length === 0 && newOwningEntityIds.length === 0) return entityCopy
    const chosenKey = keysForDelegates[delegateId][0]
    const updatedSecretIds = [
      ...existingSecretIds,
      ...(await Promise.all(newSecretIds.map((x) => this.createSecretIdDelegation(entity.id!, delegateId, chosenKey, x, newTags)))),
    ]
    const updatedEncryptionKeys = [
      ...existingEncryptionKeys,
      ...(await Promise.all(newEncryptionKeys.map((x) => this.createEncryptionKeyDelegation(entity.id!, delegateId, chosenKey, x, newTags)))),
    ]
    const updatedOwningEntityIds = [
      ...existingOwningEntityIds,
      ...(await Promise.all(newOwningEntityIds.map((x) => this.createOwningEntityIdDelegation(entity.id!, delegateId, chosenKey, x, newTags)))),
    ]
    if (updatedSecretIds.length > 0) {
      entityCopy.delegations = {
        ...(entity.delegations ?? {}),
        [delegateId]: updatedSecretIds,
      }
    }
    if (updatedEncryptionKeys.length > 0) {
      entityCopy.encryptionKeys = {
        ...(entity.encryptionKeys ?? {}),
        [delegateId]: updatedEncryptionKeys,
      }
    }
    if (updatedOwningEntityIds.length > 0) {
      entityCopy.cryptedForeignKeys = {
        ...(entity.cryptedForeignKeys ?? {}),
        [delegateId]: updatedOwningEntityIds,
      }
    }
    return entityCopy
  }

  /**
   * De-duplicates all currently accessible delegations, by removing any delegations created by the current data owner which have duplicated content,
   * and checks if any of the required entries are currently available to the delegate through the existing delegations.
   * @param delegateId id of the delegate.
   * @param allDelegations delegations of the entity.
   * @param requiredEntries potentially new entries that the delegate needs to be able to access from the delegations.
   * @param validateDecrypted validator for decrypted delegation content
   * @return the deduplicated delegations
   */
  private async deduplicateDelegationsAndFilterRequiredEntries(
    delegateId: string,
    allDelegations: { [delegateId: string]: Delegation[] },
    requiredEntries: string[],
    validateDecrypted: (x: string) => boolean | Promise<boolean>
  ): Promise<{
    deduplicatedDelegations: Delegation[]
    missingEntries: string[]
  }> {
    const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
    const delegationsToDelegate = allDelegations[delegateId] ?? []
    const decryptedDelegations = await Promise.all(
      delegationsToDelegate.map(async (d) => ({
        delegation: d,
        content: d.owner === selfId ? await this.tryDecryptDelegation(d, (x) => validateDecrypted(x)) : undefined,
      }))
    )
    const deduplicatedDelegations: Delegation[] = []
    const deduplicatedContent = new Map<string, string[][]>()
    decryptedDelegations.forEach(({ delegation, content }) => {
      if (content === undefined) {
        // Keep all delegations we could not decrypt or from other data owners
        deduplicatedDelegations.push(delegation)
      } else {
        const deduplicatedTags = deduplicatedContent.get(content)
        if (!deduplicatedTags) {
          deduplicatedContent.set(content, [delegation.tags ?? []])
          deduplicatedDelegations.push(delegation)
        } else if (!deduplicatedTags.some((t) => arrayEquals(t, delegation.tags ?? []))) {
          deduplicatedTags.push(delegation.tags ?? [])
          deduplicatedDelegations.push(delegation)
        }
      }
    })
    const delegationsFromDelegateToSelf = (allDelegations[selfId] ?? []).filter((d) => d.owner === delegateId)
    const decryptedDelegationsFromDelegate = new Set(
      await Promise.all(delegationsFromDelegateToSelf.map((d) => this.tryDecryptDelegation(d, (x) => validateDecrypted(x)))).then((dels) =>
        dels.flatMap((x) => (x ? [x] : []))
      )
    )
    return {
      deduplicatedDelegations,
      missingEntries: requiredEntries.filter((entry) => !(deduplicatedContent.has(entry) || decryptedDelegationsFromDelegate.has(entry))),
    }
  }

  private deduplicate<T>(values: T[]): T[] {
    return [...new Set(values)]
  }

  private throwDetailedExceptionForInvalidParameter(argName: string, argValue: any, methodName: string, methodArgs: IArguments) {
    if (argValue) return

    let details = '\nMethod name: icc-crypto-x-api.' + methodName + '()\nArguments:'

    if (methodArgs) {
      try {
        const argsArray = [...methodArgs]
        _.each(argsArray, (arg, index) => (details += '\n[' + index + ']: ' + JSON.stringify(arg)))
      } catch (ex) {
        details += '; a problem occured while logging arguments details: ' + ex
      }
    }

    throw new Error('### THIS SHOULD NOT HAPPEN: ' + argName + ' has an invalid value: ' + argValue + details)
  }

  private checkEmptyEncryptionMetadata(entity: EncryptedEntity) {
    const existingMetadata = []
    if (entity.delegations && Object.keys(entity.delegations).length) existingMetadata.push('delegations')
    if (entity.cryptedForeignKeys && Object.keys(entity.cryptedForeignKeys).length) existingMetadata.push('cryptedForeignKeys')
    if (entity.encryptionKeys && Object.keys(entity.encryptionKeys).length) existingMetadata.push('encryptionKeys')
    if (entity.secretForeignKeys && entity.secretForeignKeys.length) existingMetadata.push('secretForeignKeys')
    if (existingMetadata.length > 0) {
      throw new Error(
        `Entity should have no encryption metadata on initialisation, but the following fields already have some values: ${existingMetadata}\n` +
          JSON.stringify(entity, undefined, 2)
      )
    }
  }
}
