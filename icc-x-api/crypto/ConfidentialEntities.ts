import { EncryptedEntity } from '../../icc-api/model/models'
import { EntitiesEncryption } from './EntitiesEncryption'
import { CryptoPrimitives } from './CryptoPrimitives'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'

/**
 * This class helps to create confidential medical data in systems where multiple hcps share data with each other using parent hcps: while normally
 * the hcps would share all data with other hcps part of the same "family" (e.g. an hospital) there are situations where the medical data is
 * confidential and should only be known by the doctor which created the data. In these situations it is also important that the secret foreign key
 * used in the confidential data is not known by other members of the hcp family, otherwise they may be able to draw some links between the medical
 * data and the patient.
 */
export class ConfidentialEntities {
  constructor(
    private readonly entitiesEncryption: EntitiesEncryption,
    private readonly primitives: CryptoPrimitives,
    private readonly dataOwnerApi: IccDataOwnerXApi
  ) {}

  /**
   * @internal this method is intended for internal use only and may be changed without notice.
   * Ensures that the current data owner has access to a confidential secret id for the provided entity: this is an id that is known to the data owner
   * but is not known by any of his parents. If there is currently no confidential secret id for this entity the method returns a copy of the entity
   * with a new confidential secret id for the current data owner (the entity in the database won't be updated), else this method returns undefined.
   * New confidential secret ids will have an appropriate tag, but existing confidential secret ids may not necessarily have it.
   * @param entity an entity which needs to have a confidential secret id for the current data owner
   * @return undefined if the entity already had a confidential secret id for the current user, or the updated entity with the new confidential secret
   * id.
   */
  async entityWithInitialisedConfidentialSecretId<T extends EncryptedEntity>(entity: T): Promise<T | undefined> {
    if (await this.getConfidentialSecretId(entity)) return undefined
    const confidentialSecretId = this.primitives.randomUuid()
    return await this.entitiesEncryption.entityWithExtendedEncryptedMetadata(
      entity,
      await this.dataOwnerApi.getCurrentDataOwnerId(),
      [confidentialSecretId],
      [],
      [],
      ['confidential']
    )
  }

  /**
   * Get an existing confidential secret id of the provided entity for the provided data owner (current data owner by default). A confidential secret
   * id is a secret id known by the data owner but not known by any of his parents: note however that children will know confidential secret ids.
   * @param entity an entity for which you want to retrieve the confidential secret id.
   * @param dataOwnerId (current data owner by default) a data owner for which you want to get a confidential secret id.
   * @return the confidential secret id or undefined if there is no confidential secret id for the provided data owner.
   */
  async getConfidentialSecretId<T extends EncryptedEntity>(entity: T, dataOwnerId?: string): Promise<string | undefined> {
    const chosenDataOwnerId = dataOwnerId ?? (await this.dataOwnerApi.getCurrentDataOwnerId())
    const dataOwnerHierarchy = await this.dataOwnerApi.getCurrentDataOwnerHierarchyIdsFrom(chosenDataOwnerId)
    const hierarchySecretIds = (await this.entitiesEncryption.secretIdsForHcpHierarchyOf(entity)).filter((x) =>
      dataOwnerHierarchy.includes(x.ownerId)
    )
    const keysForDataOwner = hierarchySecretIds.find((x) => x.ownerId === chosenDataOwnerId)

    if (!keysForDataOwner) return undefined
    return keysForDataOwner.extracted.find((k) => !hierarchySecretIds.some((x) => x.ownerId !== chosenDataOwnerId && x.extracted.includes(k)))
  }

  /**
   * Gets a secret id known by the topmost parent of the current data owner hierarchy. If there is multiple secret ids shared with the topmost parent
   * there is no guarantee on which one will be chosen.
   * @param entity an entity.
   * @return a secret id known by the topmost parent of the current data owner hierarchy, or undefined if there is no secret id currently available
   * for the topmost parent.
   */
  async getAnySecretIdSharedWithParents<T extends EncryptedEntity>(entity: T): Promise<string | undefined> {
    return (await this.entitiesEncryption.secretIdsForHcpHierarchyOf(entity))[0].extracted[0]
  }
}
