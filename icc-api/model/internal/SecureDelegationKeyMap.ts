import { SecurityMetadata } from '../SecurityMetadata'
import { b64_2ab } from '../ModelHelper'
import { Patient } from '../Patient'

/**
 * @internal this entity is meant for internal use only
 */
export class SecureDelegationKeyMap {
  constructor(json: JSON | any) {
    Object.assign(this as SecureDelegationKeyMap, json)
  }

  id!: string
  rev?: string
  delegationKey!: string
  delegator?: string
  delegate?: string
  encryptedSelf?: string
  securityMetadata?: SecurityMetadata
}
