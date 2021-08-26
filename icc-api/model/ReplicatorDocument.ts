/**
 * iCure Cloud API Documentation
 * Spring shop sample application
 *
 * OpenAPI spec version: v0.0.1
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { ReplicationStats } from "./ReplicationStats"

import { decodeBase64 } from "./ModelHelper"

export class ReplicatorDocument {
  constructor(json: JSON | any) {
    Object.assign(this as ReplicatorDocument, json)
  }

  id?: string
  rev?: string
  source?: string
  target?: string
  owner?: string
  createTarget?: boolean
  continuous?: boolean
  docIds?: Array<string>
  replicationState?: string
  replicationStateTime?: string
  replicationStats?: ReplicationStats
  revHistory?: { [key: string]: string }
}
