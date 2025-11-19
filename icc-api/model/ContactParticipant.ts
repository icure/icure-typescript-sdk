import { ParticipantType } from './Contact'

export class ContactParticipant {
  constructor(json: JSON | any) {
    Object.assign(this as ContactParticipant, json)
  }

  type?: ParticipantType
  hcpId?: String
}
