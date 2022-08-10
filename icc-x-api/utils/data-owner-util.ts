import { Delegation } from '../../icc-api/model/Delegation'
import { HealthcareParty } from '../../icc-api/model/HealthcareParty'
import { Patient } from '../../icc-api/model/Patient'
import { Device } from '../../icc-api/model/Device'

export function hasAccessTo(dataOwner: Patient | HealthcareParty | Device, delegations: { [key: string]: Array<Delegation> }): boolean {
  return !!dataOwner.id && !!delegations[dataOwner.id] && !!delegations[dataOwner.id].length
    ? true
    : !!(dataOwner as HealthcareParty).parentId &&
        !!delegations[(dataOwner as HealthcareParty).parentId!] &&
        !!delegations[(dataOwner as HealthcareParty).parentId!].length
}
