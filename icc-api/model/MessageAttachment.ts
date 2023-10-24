import {Document} from "./Document"
import DocumentLocationEnum = Document.DocumentLocationEnum


export class MessageAttachment {
  constructor(json: JSON | any) {
    Object.assign(this as MessageAttachment, json)
  }

  type?: DocumentLocationEnum
  /**
   * Ids of this attachment ordered from oldest to newest
   */
  ids?: string[]
}
