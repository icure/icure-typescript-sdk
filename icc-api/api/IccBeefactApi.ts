/**
 * iCure Data Stack API Documentation
 * The iCure Data Stack Application API is the native interface to iCure. This version is obsolete, please use v2.
 *
 * OpenAPI spec version: v1
 * 
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { XHR } from "./XHR"
import { MapOfIds } from '../model/MapOfIds';
import { MessageWithBatch } from '../model/MessageWithBatch';


export class IccBeefactApi {
  host: string
  headers: Array<XHR.Header>
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(host: string, headers: any, fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>) {
    this.host = host
    this.headers = Object.keys(headers).map(k => new XHR.Header(k, headers[k]))
    this.fetchImpl = fetchImpl
  }

  setHeaders(h: Array<XHR.Header>) {
    this.headers = h
  }

  handleError(e: XHR.XHRError): never {
    throw e
  }


     /**
      * 
      * @summary create batch and message
      * @param body 
      * @param insuranceId 
      * @param newMessageId 
      * @param numericalRef 
      */
 createBatchAndMessage(insuranceId: string, newMessageId: string, numericalRef: number, body?: MapOfIds): Promise<MessageWithBatch> {
    let _body = null
    _body = body

    const _url = this.host + `/be_efact/${encodeURIComponent(String(insuranceId))}/${encodeURIComponent(String(newMessageId))}/${encodeURIComponent(String(numericalRef))}` + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => 
          
              new MessageWithBatch(doc.body as JSON)
              
      )
      .catch(err => this.handleError(err))
}
}

