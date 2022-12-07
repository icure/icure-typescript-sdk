import { Delegation, EncryptedEntity } from '../../icc-api/model/models'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { ExchangeKeysManager } from './ExchangeKeysManager'
import { string2ua, ua2hex, ua2string } from '../utils'
import { hex2ua } from '@icure/api'
import * as _ from 'lodash'
import { CryptoPrimitives } from './CryptoPrimitives'

export class EntitiesEncryption {
  private readonly hexWithDashesRegex = /^[0-9A-Fa-f\-]+$/g

  private readonly primitives: CryptoPrimitives
  private readonly dataOwnerApi: IccDataOwnerXApi
  private readonly exchangeKeysManager: ExchangeKeysManager

  constructor(hexWithDashesRegex: RegExp, primitives: CryptoPrimitives, dataOwnerApi: IccDataOwnerXApi, exchangeKeysManager: ExchangeKeysManager) {
    this.hexWithDashesRegex = hexWithDashesRegex
    this.primitives = primitives
    this.dataOwnerApi = dataOwnerApi
    this.exchangeKeysManager = exchangeKeysManager
  }

  /**
   * Get the encryption keys of an entity that the provided data owner can access, potentially using the keys for his parent.
   * There should only be one encryption key for each entity, but the method supports more to allow to deal with conflicts and merged duplicate data.
   * @param entity an encrypted entity.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @return the encryption keys that the provided data owner can decrypt, deduplicated.
   */
  async encryptionKeysOf(entity: EncryptedEntity, dataOwnerId?: string): Promise<string[]> {
    return this.extractMergedHierarchyFromDelegationAndOwner(entity.encryptionKeys ?? {}, dataOwnerId, this.validateEncryptionKey)
  }

  /**
   * Get the encryption keys of an entity that the current data owner and his parents can access. The resulting array contains the keys for each data
   * owner in the hierarchy which can be decrypted using only that data owner keys (excludes keys accessible through the parent keys). The order of
   * the array is the same as in {@link IccDataOwnerXApi.getCurrentDataOwnerHierarchyIds}.
   * Note that different data owners may have access to the same keys, but the keys extracted for each data owner are deduplicated.
   * There should only be one encryption key for each entity, but the method supports more to allow to deal with conflicts and merged duplicate data.
   * @param entity an encrypted entity.
   * @return the encryption keys that each member of the current data owner hierarchy can decrypt using only his keys and not keys of his parents.
   */
  async encryptionKeysForHcpHierarchyOf(entity: EncryptedEntity): Promise<{ ownerId: string; extracted: string[] }[]> {
    return this.extractedHierarchyFromDelegation(entity.encryptionKeys ?? {}, this.validateEncryptionKey)
  }

  /**
   * Get the secret ids (SFKs) of an entity that the provided data owner can access, potentially using the keys for his parent.
   * @param entity an encrypted entity.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @return the secret ids (SFKs) that the provided data owner can decrypt, deduplicated.
   */
  async secretIdsOf(entity: EncryptedEntity, dataOwnerId?: string): Promise<string[]> {
    return this.extractMergedHierarchyFromDelegationAndOwner(entity.delegations ?? {}, dataOwnerId, this.validateSecretId)
  }

  /**
   * Get the secret ids (SFKs) of an entity that the current data owner and his parents can access. The resulting array contains the ids for each data
   * owner in the hierarchy which can be decrypted using only that data owner keys (excludes ids accessible through the parent keys). The order of
   * the array is the same as in {@link IccDataOwnerXApi.getCurrentDataOwnerHierarchyIds}.
   * Note that different data owners may have access to the same secret ids, but the secret ids extracted for each data owner are deduplicated.
   * @param entity an encrypted entity.
   * @return the secret ids that each member of the current data owner hierarchy can decrypt using only his keys and not keys of his parents.
   */
  async secretIdsForHcpHierarchyOf(entity: EncryptedEntity): Promise<{ ownerId: string; extracted: string[] }[]> {
    return this.extractedHierarchyFromDelegation(entity.delegations ?? {}, this.validateSecretId)
  }

  /**
   * Get the parent ids (CFKs) of an entity that the provided data owner can access, potentially using the keys for his parent.
   * There should only be one parent id for each entity, but the method supports more to allow to deal with conflicts and merged duplicate data.
   * @param entity an encrypted entity.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @return the parent ids (CFKs) that the provided data owner can decrypt, deduplicated.
   */
  async parentIdsOf(entity: EncryptedEntity, dataOwnerId?: string): Promise<string[]> {
    return this.extractMergedHierarchyFromDelegationAndOwner(entity.cryptedForeignKeys ?? {}, dataOwnerId, this.validateParentId)
  }

  /**
   * Get the parent ids (CFKs) of an entity that the current data owner and his parents can access. The resulting array contains the ids for each data
   * owner in the hierarchy which can be decrypted using only that data owner keys (excludes ids accessible through the parent keys). The order of
   * the array is the same as in {@link IccDataOwnerXApi.getCurrentDataOwnerHierarchyIds}.
   * Note that different data owners may have access to the same parent ids, but the parent ids extracted for each data owner are deduplicated.
   * There should only be one parent id for each entity, but the method supports more to allow to deal with conflicts and merged duplicate data.
   * @param entity an encrypted entity.
   * @return the parent ids that each member of the current data owner hierarchy can decrypt using only his keys and not keys of his parents.
   */
  async parentIdsForHcpHierarchyOf(entity: EncryptedEntity): Promise<{ ownerId: string; extracted: string[] }[]> {
    return this.extractedHierarchyFromDelegation(entity.cryptedForeignKeys ?? {}, this.validateParentId)
  }

  /**
   * Initializes encryption metadata for an entity. This includes the encrypted secret id, parent id, and encryption key for the entity, and the clear
   * text secret foreign key of the parent entity.
   * This method creates an updated copy of the entity, and DOES NOT MODIFY the entity in place.
   * @param entity entity which requires encryption metadata initialisation.
   * @param parentEntityId id of the parent entity, if any.
   * @param parentSecretId secret id of the parent entity, to use in the secret foreign keys for the provided entity, if any.
   * @throws if the entity already has non-empty values for encryption metadata.
   * @return an updated copy of the entity.
   */
  async entityWithInitialisedEncryptionMetadata<T extends EncryptedEntity>(
    entity: T,
    parentEntityId: string | undefined,
    parentSecretId: string | undefined
  ): Promise<T> {
    this.throwDetailedExceptionForInvalidParameter('entity.id', entity.id, 'entityWithInitialisedEncryptionMetadata', arguments)
    this.checkEmptyEncryptionMetadata(entity)
    const res = await this.createOrUpdateEntityDelegations(
      entity,
      await this.dataOwnerApi.getCurrentDataOwnerId(),
      [],
      [],
      [],
      [this.primitives.randomUuid()],
      [ua2hex(this.primitives.randomBytes(16))],
      parentEntityId ? [parentEntityId] : []
    )
    if (parentSecretId) {
      res.secretForeignKeys = [parentSecretId]
    }
    return res
  }

  /**
   * Updates encryption metadata for an entity in order to share it with a delegate.
   * The method give access to all unencrypted content of the entity to the delegate data owner, and it allows to also choose which other information
   * on the entity gets shared among secret ids of the entity (shareSecretId), encryption keys (shareEncryptionKeys) and parent ids (shareParentIds).
   * The possible values for the shareX parameters are:
   * - The actual values to share. An empty array will have the same effects as `false`.
   * - `true` to retrieve automatically all currently decryptable values for the corresponding parameter and share all of them. If no value can be
   * retrieved the method will throw an error.
   * - `false` to not share the information. (NOTE: currently for the secret id false may actually generate a new secret id and share that id if there
   * is no delegation from the current data owner to the delegate, as secret ids are also used for access control. This will be changed in future
   * versions)
   * The method also performs some deduplication on the available delegations for the delegate
   * This method creates an updated copy of the entity, and DOES NOT MODIFY the entity in place.
   * @param entity entity which requires encryption metadata initialisation.
   * @param delegateId id of the delegate to share data with.
   * @param shareSecretIds secret ids to share or true if all currently available secret ids should be shared.
   * @param shareEncryptionKeys encryption keys to share or true if all currently available encryption keys should be shared.
   * @param shareParentIds parent ids to share or true if all currently available parent ids should be shared.
   * @throws if any of the shareX parameters is set to `true` but the corresponding piece of data could not be retrieved.
   * @return an updated copy of the entity.
   */
  async entityWithShareMetadata<T extends EncryptedEntity>(
    entity: T,
    delegateId: string,
    shareSecretIds: string[] | boolean,
    shareEncryptionKeys: string[] | boolean,
    shareParentIds: string[] | boolean
  ): Promise<T> {
    this.throwDetailedExceptionForInvalidParameter('entity.id', entity.id, 'entityWithShareMetadata', arguments)
    async function checkInputAndGet(
      input: string[] | boolean,
      inputName: string,
      retrieve: (entity: T) => Promise<string[]>,
      validate: (x: string) => boolean
    ): Promise<string[]> {
      if (input === true) {
        const retrieved = await retrieve(entity)
        if (retrieved.length > 0) {
          return retrieved
        } else {
          throw `Failed to retrieve any value for input ${inputName}, impossible to share.`
        }
      } else if (input === false) {
        return []
      } else {
        input.forEach((x) => {
          if (!validate(x)) throw `Invalid input for ${inputName}.`
        })
        return input
      }
    }
    const secretIdsToShare = await checkInputAndGet(shareSecretIds, 'secretIds', this.secretIdsOf, this.validateSecretId)
    const encryptionKeysToShare = await checkInputAndGet(shareEncryptionKeys, 'encryptionKeys', this.encryptionKeysOf, this.validateEncryptionKey)
    const parentIdsToShare = await checkInputAndGet(shareParentIds, 'parentIds', this.parentIdsOf, this.validateParentId)
    const deduplicateInfoSecretIds = await this.deduplicateDelegationsAndFilterRequiredEntries(
      delegateId,
      entity.delegations?.[delegateId] ?? [],
      secretIdsToShare,
      this.validateSecretId
    )
    const deduplicateInfoEncryptionKeys = await this.deduplicateDelegationsAndFilterRequiredEntries(
      delegateId,
      entity.encryptionKeys?.[delegateId] ?? [],
      encryptionKeysToShare,
      this.validateEncryptionKey
    )
    const deduplicateInfoParentIds = await this.deduplicateDelegationsAndFilterRequiredEntries(
      delegateId,
      entity.cryptedForeignKeys?.[delegateId] ?? [],
      parentIdsToShare,
      this.validateParentId
    )
    /*TODO
     * Temporary hack since secret id is necessary to create a delegation for access control: if there is no delegation existing from me to the
     * delegate and there is no new secret id to be created create a new random id.
     */
    const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
    if (deduplicateInfoSecretIds.missingEntries.length === 0 && !deduplicateInfoSecretIds.deduplicatedDelegations.some((d) => d.owner === selfId)) {
      deduplicateInfoSecretIds.missingEntries.push(this.primitives.randomUuid())
    }
    return this.createOrUpdateEntityDelegations(
      entity,
      delegateId,
      deduplicateInfoSecretIds.deduplicatedDelegations,
      deduplicateInfoEncryptionKeys.deduplicatedDelegations,
      deduplicateInfoParentIds.deduplicatedDelegations,
      deduplicateInfoSecretIds.missingEntries,
      deduplicateInfoEncryptionKeys.missingEntries,
      deduplicateInfoParentIds.missingEntries
    )
  }

  /**
   * @internal This method is intended only for internal use and may be changed without notice.
   * Get the decrypted content of a delegation-like object which the provided data owner would be able to access using ONLY HIS EXCHANGE KEYS (does
   * not consider exchange keys for parents).
   * Note that the retrieved exchange keys are decrypted using the private keys available on the device, and results may vary from other devices.
   * @param dataOwnerId id of a data owner, he should be part of the current data owner hierarchy.
   * @param delegations a delegation-like object containing the encrypted key
   * @param includeFromDelegations if true also considers delegation from the provided data owner (or parents) to look for values. This allows to
   * decrypt delegations associated to exchange keys recovered after a giveAccessBack request.
   * @param validateDecrypted validates the decrypted result, to drop decryption results with wrong key that still gave a valid checksum
   * @return the key which could be decrypted using only keys available on the current device and delegations from/to the provided data owner. May
   * contain duplicates.
   */
  async extractFromDelegationsForDataOwner(
    dataOwnerId: string,
    delegations: { [delegateId: string]: Delegation[] },
    includeFromDelegations: boolean,
    validateDecrypted: (result: string) => boolean
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
      const decrypted = await this.tryDecryptDelegation(delegation, validateDecrypted)
      if (decrypted) res.push(decrypted)
    }
    return res
  }

  // Ensures that the delegatedTo field of delegations has the appropriate values, else returns a copy of the delegations with the appropriate value.
  private populateDelegatedTo(delegateId: string, delegations: Delegation[]): Delegation[] {
    return delegations.map((d) => (d.delegatedTo === delegateId ? d : { ...d, delegatedTo: delegateId }))
  }

  private async extractedHierarchyFromDelegation(
    delegations: { [delegateId: string]: Delegation[] },
    validateDecrypted: (result: string) => boolean
  ): Promise<{ ownerId: string; extracted: string[] }[]> {
    return Promise.all(
      (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()).map(async (ownerId) => {
        const extracted = this.deduplicate(await this.extractFromDelegationsForDataOwner(ownerId, delegations, true, validateDecrypted))
        return { ownerId, extracted }
      })
    )
  }

  private async extractMergedHierarchyFromDelegationAndOwner(
    delegations: { [delegateId: string]: Delegation[] },
    dataOwnerId: string | undefined,
    validateDecrypted: (result: string) => boolean
  ): Promise<string[]> {
    const hierarchy = dataOwnerId
      ? await this.dataOwnerApi.getCurrentDataOwnerHierarchyIdsFrom(dataOwnerId)
      : await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()
    const extractedByOwner = await Promise.all(
      hierarchy.map((ownerId) => this.extractFromDelegationsForDataOwner(ownerId, delegations, true, validateDecrypted))
    )
    return this.deduplicate(extractedByOwner.flatMap((x) => x))
  }

  private async tryDecryptDelegation(delegation: Delegation, validateDecrypted: (result: string) => boolean): Promise<string | undefined> {
    const exchangeKeys = await this.exchangeKeysManager.getExchangeKeysFor(delegation.owner!, delegation.delegatedTo!)
    for (const key of exchangeKeys) {
      try {
        // Format of encrypted key for any delegation should be entityId:key, but with the merging of entities the entityId might not match the
        // current id. As a checksum we are only verifying that the decrypted bytes can be represented as a string with exactly one ':'.
        // Additionally, we also have a validator that is specific for each type of delegation content (encryption key, secret id, ...)
        const decrypted = ua2string(await this.primitives.AES.decrypt(key, hex2ua(delegation.key!)))
        const decryptedSplit = decrypted.split(':')
        if (decryptedSplit.length === 2) {
          if (validateDecrypted(decryptedSplit[1])) return decryptedSplit[1]
        } else {
          console.warn("Error in the decrypted delegation: content should contain exactly 1 ':', the delegation is ignored.")
        }
      } catch (e) {
        // Do nothing: the delegation uses another exchange key owner->delegator
      }
    }
  }

  private validateEncryptionKey(key: string): boolean {
    return this.hexWithDashesRegex.test(key)
  }

  private validateSecretId(key: string): boolean {
    return !!key
  }

  private validateParentId(key: string): boolean {
    return !!key
  }

  private async createEncryptionKeyDelegation(
    entityId: string,
    delegateId: string,
    exchangeKey: CryptoKey,
    encryptionKey: string
  ): Promise<Delegation> {
    if (!this.validateEncryptionKey(encryptionKey)) throw 'Invalid encryption key'
    return this.createDelegation(entityId, delegateId, exchangeKey, encryptionKey)
  }

  private async createSecretIdDelegation(entityId: string, delegateId: string, exchangeKey: CryptoKey, secretId: string): Promise<Delegation> {
    if (!this.validateSecretId(secretId)) throw 'Invalid secret id'
    return this.createDelegation(entityId, delegateId, exchangeKey, secretId)
  }

  private async createParentIdDelegation(entityId: string, delegateId: string, exchangeKey: CryptoKey, parentId: string): Promise<Delegation> {
    if (!this.validateParentId(parentId)) throw 'Invalid parent id'
    return this.createDelegation(entityId, delegateId, exchangeKey, parentId)
  }

  private async createDelegation(entityId: string, delegateId: string, exchangeKey: CryptoKey, content: string): Promise<Delegation> {
    if (entityId.includes(':')) throw "Ids for encrypted entities are not allowed to contain ':'"
    if (content.includes(':')) throw "Content of delegations can not contain ':'"
    return {
      delegatedTo: delegateId,
      owner: await this.dataOwnerApi.getCurrentDataOwnerId(),
      key: ua2hex(await this.primitives.AES.encrypt(exchangeKey, string2ua(entityId + ':' + content))),
    }
  }

  private async createOrUpdateEntityDelegations<T extends EncryptedEntity>(
    entity: T,
    delegateId: string,
    existingSecretIds: Delegation[],
    existingEncryptionKeys: Delegation[],
    existingParentIds: Delegation[],
    newSecretIds: string[],
    newEncryptionKeys: string[],
    newParentIds: string[]
  ): Promise<T> {
    if (newSecretIds.length == 0 && newEncryptionKeys.length == 0 && newParentIds.length == 0) return entity
    const { updatedDelegator, keys: encryptionKeys } = await this.exchangeKeysManager.getOrCreateEncryptionExchangeKeysTo(delegateId)
    const updatedEntity = entity.id == updatedDelegator?.dataOwner?.id ? (updatedDelegator!.dataOwner as T) : entity
    const chosenKey = encryptionKeys[0]
    const entityCopy = { ...updatedEntity }
    const updatedSecretIds = [
      ...existingSecretIds,
      ...(await Promise.all(newSecretIds.map((x) => this.createSecretIdDelegation(entity.id!, delegateId, chosenKey, x)))),
    ]
    const updatedEncryptionKeys = [
      ...existingEncryptionKeys,
      ...(await Promise.all(newEncryptionKeys.map((x) => this.createEncryptionKeyDelegation(entity.id!, delegateId, chosenKey, x)))),
    ]
    const updatedParentIds = [
      ...existingParentIds,
      ...(await Promise.all(newParentIds.map((x) => this.createParentIdDelegation(entity.id!, delegateId, chosenKey, x)))),
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
    if (updatedParentIds.length > 0) {
      entityCopy.cryptedForeignKeys = {
        ...(entity.cryptedForeignKeys ?? {}),
        [delegateId]: updatedParentIds,
      }
    }
    return entityCopy
  }

  /**
   * De-duplicates all currently accessible delegations, by removing any delegations created by the current data owner which have duplicated content,
   * and checks if any of the required entries are currently available to the delegate through the existing delegations.
   * @param delegateId id of the delegate.
   * @param delegations delegations towards the delegate.
   * @param requiredEntries potentially new entries that the delegate needs to be able to access from the delegations.
   * @param validateDecrypted validator for decrypted delegation content
   * @return the deduplicated delegations
   */
  private async deduplicateDelegationsAndFilterRequiredEntries(
    delegateId: string,
    delegations: Delegation[],
    requiredEntries: string[],
    validateDecrypted: (x: string) => boolean
  ): Promise<{
    deduplicatedDelegations: Delegation[]
    missingEntries: string[]
  }> {
    const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
    const decryptedDelegations = await Promise.all(
      delegations.map(async (d) => ({
        delegation: d,
        content: d.owner === selfId ? await this.tryDecryptDelegation(d, validateDecrypted) : undefined,
      }))
    )
    const deduplicatedDelegations: Delegation[] = []
    const deduplicatedContent = new Set<string>()
    decryptedDelegations.forEach(({ delegation, content }) => {
      if (content === undefined) {
        // Keep all delegations we could not decrypt or from other data owners
        deduplicatedDelegations.push(delegation)
      } else if (!deduplicatedContent.has(content)) {
        deduplicatedContent.add(content)
        deduplicatedDelegations.push(delegation)
      }
    })
    return {
      deduplicatedDelegations,
      missingEntries: requiredEntries.filter((entry) => !deduplicatedContent.has(entry)),
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

    throw '### THIS SHOULD NOT HAPPEN: ' + argName + ' has an invalid value: ' + argValue + details
  }

  private checkEmptyEncryptionMetadata(entity: EncryptedEntity) {
    const existingMetadata = []
    if (entity.delegations && entity.delegations !== {}) existingMetadata.push('delegations')
    if (entity.cryptedForeignKeys && entity.cryptedForeignKeys !== {}) existingMetadata.push('cryptedForeignKeys')
    if (entity.encryptionKeys && entity.encryptionKeys !== {}) existingMetadata.push('encryptionKeys')
    if (entity.secretForeignKeys && entity.secretForeignKeys !== []) existingMetadata.push('secretForeignKeys')
    if (existingMetadata.length > 0) {
      throw (
        `Entity should have no encryption metadata on initialisation, but the following fields already have some values: ${existingMetadata}\n` +
        entity
      )
    }
  }
}
