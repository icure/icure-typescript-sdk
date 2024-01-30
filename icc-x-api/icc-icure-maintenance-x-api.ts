import { KeyPair } from './crypto/RSA'
import { IccMaintenanceTaskXApi } from './icc-maintenance-task-x-api'
import { MaintenanceTask } from '../icc-api/model/MaintenanceTask'
import { ua2hex } from './utils'
import { PropertyStub } from '../icc-api/model/PropertyStub'
import { PropertyTypeStub } from '../icc-api/model/PropertyTypeStub'
import { TypedValueObject } from '../icc-api/model/TypedValueObject'
import { IccCryptoXApi } from './icc-crypto-x-api'
import { KeyPairUpdateRequest } from './maintenance/KeyPairUpdateRequest'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { User } from '../icc-api/model/User'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import { IccExchangeDataApi } from '../icc-api/api/internal/IccExchangeDataApi'
import { DataOwnerTypeEnum } from '../icc-api/model/DataOwnerTypeEnum'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { fingerprintV1 } from './crypto/utils'

type ExchangeKeyInfo = { delegator: string; delegate: string; fingerprints: Set<string> }

/**
 * Api for interpreting maintenance tasks and applying required client-side actions.
 */
export class IccIcureMaintenanceXApi {
  constructor(
    private readonly crypto: IccCryptoXApi,
    private readonly tasksApi: IccMaintenanceTaskXApi,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly exchangeDataApi: IccExchangeDataApi
  ) {}

  // TODO api to get all tasks for current owner from owner with id

  /**
   * Applies a key pair update request between another data owner and the current data owner to allow the other data owner to access existing exchange
   * keys shared with the current data owner. IMPORTANT: it is your responsibility to verify the authenticity of the public key / update request
   * before calling this method: this method assumes the new public key for the concerned data owner is authentic.
   * @param update a keypair update request to the current data owner.
   */
  async applyKeyPairUpdate(update: KeyPairUpdateRequest) {
    await this.crypto.exchangeKeys.base.giveAccessBackTo(
      update.concernedDataOwnerId,
      update.newPublicKey,
      this.crypto.userKeysManager.getDecryptionKeys()
    )
    await this.crypto.exchangeData.giveAccessBackTo(update.concernedDataOwnerId, update.newPublicKey)
  }

  /**
   * @internal This method is intended only for internal use and may be changed without notice.
   * Creates the necessary maintenance tasks to request access to existing exchange keys with the new key pair for the current user.
   * @param user the user which owns the new key pair.
   * @param keypair a new key pair for the current user.
   * @param requestToOwnerTypes specifies the types of data owner that have shared data with the current data owner or which were given access to data
   * from the current data owner will receive a 'give access back' request. If not specified, the value be inferred from the current data owner type.
   */
  async createMaintenanceTasksForNewKeypair(user: User, keypair: KeyPair<CryptoKey>, requestToOwnerTypes?: DataOwnerTypeEnum[]): Promise<void> {
    const currentUserType = await this.dataOwnerApi.getCurrentDataOwnerType()
    if (!requestToOwnerTypes) {
      if (currentUserType === 'device') {
        console.warn('Current data owner is a device and there is no need to create maintenance tasks for updated keypair.')
        return
      } else {
        requestToOwnerTypes =
          currentUserType === DataOwnerTypeEnum.Patient ? [DataOwnerTypeEnum.Patient, DataOwnerTypeEnum.Hcp] : [DataOwnerTypeEnum.Hcp]
      }
    }
    const hexNewPubKey = ua2hex(await this.crypto.primitives.RSA.exportKey(keypair.publicKey, 'spki'))
    const hexNewPubKeyFp = fingerprintV1(hexNewPubKey)
    const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
    const requestDataOwnersForExchangeKeys = (await this.getExchangeKeysInfosOf(selfId, requestToOwnerTypes))
      .filter((info) => !info.fingerprints.has(hexNewPubKeyFp))
      .flatMap((info) => [info.delegate, info.delegator])
      .filter((dataOwner) => dataOwner !== selfId)
    const requestDataOwnersForExchangeData = await this.exchangeDataApi.getExchangeDataParticipantCounterparts(
      selfId,
      [...new Set(requestToOwnerTypes)].join(',')
    )
    const requestDataOwners = [...new Set([...requestDataOwnersForExchangeKeys, ...requestDataOwnersForExchangeData])]
    if (requestDataOwners.length > 0) {
      const tasksToCreate = requestDataOwners.map((dataOwner) => ({
        delegate: dataOwner,
        task: this.createMaintenanceTask(selfId, hexNewPubKey),
      }))
      for (const taskToCreate of tasksToCreate) {
        const instance = await this.tasksApi.newInstance(user, taskToCreate.task, {
          additionalDelegates: { [taskToCreate.delegate]: AccessLevelEnum.WRITE },
        })
        if (instance) {
          // TODO create in bulk
          await this.tasksApi.createMaintenanceTaskWithUser(user, instance)
        }
      }
    }
  }

  private async getExchangeKeysInfosOf(dataOwnerId: string, otherOwnerTypes: DataOwnerTypeEnum[]): Promise<ExchangeKeyInfo[]> {
    const allExchangeKeys = await this.crypto.exchangeKeys.base.getAllExchangeKeysWith(dataOwnerId, otherOwnerTypes)
    const infoTo = Object.entries(allExchangeKeys.keysToOwner).flatMap(([delegatorId, delegatorFpToKeys]) =>
      Object.values(delegatorFpToKeys).map((encryptedKeys) => ({
        delegator: delegatorId,
        delegate: dataOwnerId,
        fingerprints: new Set(Object.keys(encryptedKeys).map((x) => fingerprintV1(x))),
      }))
    )
    const infoFrom = Object.values(allExchangeKeys.keysFromOwner).flatMap((delegateIdToKeys) =>
      Object.entries(delegateIdToKeys).map(([delegateId, encryptedKeys]) => ({
        delegator: dataOwnerId,
        delegate: delegateId,
        fingerprints: new Set(Object.keys(encryptedKeys).map((x) => fingerprintV1(x))),
      }))
    )
    return [...infoFrom, ...infoTo]
  }

  private createMaintenanceTask(ownerId: string, concernedPubKey: string) {
    return new MaintenanceTask({
      id: this.crypto.primitives.randomUuid(),
      taskType: KeyPairUpdateRequest.TASK_TYPE,
      status: MaintenanceTask.StatusEnum.Pending,
      properties: [
        new PropertyStub({
          id: KeyPairUpdateRequest.OWNER_ID_PROP_ID,
          type: new PropertyTypeStub({ type: PropertyTypeStub.TypeEnum.STRING }),
          typedValue: new TypedValueObject({
            type: TypedValueObject.TypeEnum.STRING,
            stringValue: ownerId,
          }),
        }),
        new PropertyStub({
          id: KeyPairUpdateRequest.OWNER_PUB_PROP_ID,
          type: new PropertyTypeStub({ type: PropertyTypeStub.TypeEnum.STRING }),
          typedValue: new TypedValueObject({
            type: TypedValueObject.TypeEnum.STRING,
            stringValue: concernedPubKey,
          }),
        }),
      ],
    })
  }
}
