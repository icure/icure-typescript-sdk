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
import { InvoicesBatch } from "./InvoicesBatch"
import { Message } from "./Message"

export class MessageWithBatch {
  constructor(json: JSON | any) {
    Object.assign(this as MessageWithBatch, json)
  }

  invoicesBatch?: InvoicesBatch
  message?: Message
}
