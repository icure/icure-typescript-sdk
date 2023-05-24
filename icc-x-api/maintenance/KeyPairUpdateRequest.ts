/**
 * Represents a request to update aes exchange keys following the creation of a new key pair for a data owner.
 */
import { MaintenanceTask } from '../../icc-api/model/MaintenanceTask'
import { PropertyStub } from '../../icc-api/model/PropertyStub'

export interface KeyPairUpdateRequest {
  /**
   * New public key of the data owner, in hex-encoded spki format.
   */
  readonly newPublicKey: string

  /**
   * Id of the data owner which created a new key pair and wants to regain access to his exchange keys.
   */
  readonly concernedDataOwnerId: string

  /**
   * @internal this field is intended for internal use only and may be changed in future without notice
   */
  readonly originalTask?: MaintenanceTask
}

export namespace KeyPairUpdateRequest {
  /**
   * Create a key pair update request from a maintenance task.
   */
  export function fromMaintenanceTask(task: MaintenanceTask): KeyPairUpdateRequest {
    if (task.taskType !== KeyPairUpdateRequest.TASK_TYPE)
      throw new Error(`Key pair update tasks should have task type ${KeyPairUpdateRequest.TASK_TYPE}, but got task with type ${task.taskType}`)

    function findStringProp(propId: string): string {
      const prop: PropertyStub | undefined = task.properties?.find((x) => x.id === propId)
      if (!prop) throw new Error(`Task is missing required string property ${propId} for KeyPairUpdateRequest. ${JSON.stringify(task)}`)
      const propValue = prop.typedValue?.stringValue
      if (!propValue)
        throw new Error(`Invalid value ${prop.typedValue?.stringValue} for property ${propId} for KeyPairUpdateRequest. ${JSON.stringify(task)}`)
      return propValue
    }

    return {
      concernedDataOwnerId: findStringProp(KeyPairUpdateRequest.OWNER_ID_PROP_ID),
      newPublicKey: findStringProp(KeyPairUpdateRequest.OWNER_PUB_PROP_ID),
      originalTask: task,
    }
  }
}

export namespace KeyPairUpdateRequest {
  /**
   * @internal this field is intended for internal use only and may be changed in future without notice
   */
  export const OWNER_ID_PROP_ID = 'dataOwnerConcernedId'
  /**
   * @internal this field is intended for internal use only and may be changed in future without notice
   */
  export const OWNER_PUB_PROP_ID = 'dataOwnerConcernedPubKey'
  /**
   * @internal this field is intended for internal use only and may be changed in future without notice
   */
  export const TASK_TYPE = MaintenanceTask.TaskTypeEnum.KeyPairUpdate
}
