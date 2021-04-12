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
import { XHR } from "./XHR"
import { Delegation } from "../model/Delegation"
import { DocIdentifier } from "../model/DocIdentifier"
import { IcureStub } from "../model/IcureStub"
import { ListOfIds } from "../model/ListOfIds"
import { Message } from "../model/Message"
import { MessagesReadStatusUpdate } from "../model/MessagesReadStatusUpdate"
import { PaginatedListMessage } from "../model/PaginatedListMessage"

export class IccMessageApi {
  host: string
  headers: Array<XHR.Header>
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: any,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
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
   * @summary Creates a message
   * @param body
   */
  createMessage(body?: Message): Promise<Message> {
    let _body = null
    _body = body

    const _url = this.host + `/message` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new Message(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Deletes a message delegation
   * @param messageId
   * @param delegateId
   */
  deleteDelegation(messageId: string, delegateId: string): Promise<Message> {
    let _body = null

    const _url =
      this.host +
      `/message/${encodeURIComponent(String(messageId))}/delegate/${encodeURIComponent(
        String(delegateId)
      )}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("DELETE", _url, headers, _body, this.fetchImpl)
      .then(doc => new Message(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Deletes multiple messages
   * @param messageIds
   */
  deleteMessages(messageIds: string): Promise<Array<DocIdentifier>> {
    let _body = null

    const _url =
      this.host +
      `/message/${encodeURIComponent(String(messageIds))}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("DELETE", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new DocIdentifier(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Deletes multiple messages
   * @param body
   */
  deleteMessagesBatch(body?: ListOfIds): Promise<Array<DocIdentifier>> {
    let _body = null
    _body = body

    const _url = this.host + `/message/delete/byIds` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new DocIdentifier(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get all messages (paginated) for current HC Party
   * @param startKey
   * @param startDocumentId
   * @param limit
   */
  findMessages(
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListMessage> {
    let _body = null

    const _url =
      this.host +
      `/message` +
      "?ts=" +
      new Date().getTime() +
      (startKey ? "&startKey=" + encodeURIComponent(String(startKey)) : "") +
      (startDocumentId ? "&startDocumentId=" + encodeURIComponent(String(startDocumentId)) : "") +
      (limit ? "&limit=" + encodeURIComponent(String(limit)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new PaginatedListMessage(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get all messages (paginated) for current HC Party and provided from address
   * @param fromAddress
   * @param startKey
   * @param startDocumentId
   * @param limit
   * @param hcpId
   */
  findMessagesByFromAddress(
    fromAddress?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    hcpId?: string
  ): Promise<PaginatedListMessage> {
    let _body = null

    const _url =
      this.host +
      `/message/byFromAddress` +
      "?ts=" +
      new Date().getTime() +
      (fromAddress ? "&fromAddress=" + encodeURIComponent(String(fromAddress)) : "") +
      (startKey ? "&startKey=" + encodeURIComponent(String(startKey)) : "") +
      (startDocumentId ? "&startDocumentId=" + encodeURIComponent(String(startDocumentId)) : "") +
      (limit ? "&limit=" + encodeURIComponent(String(limit)) : "") +
      (hcpId ? "&hcpId=" + encodeURIComponent(String(hcpId)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new PaginatedListMessage(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary List messages found By Healthcare Party and secret foreign keys.
   * @param secretFKeys
   */
  findMessagesByHCPartyPatientForeignKeys(secretFKeys: string): Promise<Array<Message>> {
    let _body = null

    const _url =
      this.host +
      `/message/byHcPartySecretForeignKeys` +
      "?ts=" +
      new Date().getTime() +
      (secretFKeys ? "&secretFKeys=" + encodeURIComponent(String(secretFKeys)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new Message(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get all messages (paginated) for current HC Party and provided to address
   * @param toAddress
   * @param startKey
   * @param startDocumentId
   * @param limit
   * @param reverse
   * @param hcpId
   */
  findMessagesByToAddress(
    toAddress?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    reverse?: boolean,
    hcpId?: string
  ): Promise<PaginatedListMessage> {
    let _body = null

    const _url =
      this.host +
      `/message/byToAddress` +
      "?ts=" +
      new Date().getTime() +
      (toAddress ? "&toAddress=" + encodeURIComponent(String(toAddress)) : "") +
      (startKey ? "&startKey=" + encodeURIComponent(String(startKey)) : "") +
      (startDocumentId ? "&startDocumentId=" + encodeURIComponent(String(startDocumentId)) : "") +
      (limit ? "&limit=" + encodeURIComponent(String(limit)) : "") +
      (reverse ? "&reverse=" + encodeURIComponent(String(reverse)) : "") +
      (hcpId ? "&hcpId=" + encodeURIComponent(String(hcpId)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new PaginatedListMessage(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get all messages (paginated) for current HC Party and provided transportGuid
   * @param transportGuid
   * @param received
   * @param startKey
   * @param startDocumentId
   * @param limit
   * @param hcpId
   */
  findMessagesByTransportGuid(
    transportGuid?: string,
    received?: boolean,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    hcpId?: string
  ): Promise<PaginatedListMessage> {
    let _body = null

    const _url =
      this.host +
      `/message/byTransportGuid` +
      "?ts=" +
      new Date().getTime() +
      (transportGuid ? "&transportGuid=" + encodeURIComponent(String(transportGuid)) : "") +
      (received ? "&received=" + encodeURIComponent(String(received)) : "") +
      (startKey ? "&startKey=" + encodeURIComponent(String(startKey)) : "") +
      (startDocumentId ? "&startDocumentId=" + encodeURIComponent(String(startDocumentId)) : "") +
      (limit ? "&limit=" + encodeURIComponent(String(limit)) : "") +
      (hcpId ? "&hcpId=" + encodeURIComponent(String(hcpId)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new PaginatedListMessage(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get all messages starting by a prefix between two date
   * @param from
   * @param to
   * @param transportGuid
   * @param startKey
   * @param startDocumentId
   * @param limit
   * @param hcpId
   */
  findMessagesByTransportGuidSentDate(
    from?: number,
    to?: number,
    transportGuid?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    hcpId?: string
  ): Promise<PaginatedListMessage> {
    let _body = null

    const _url =
      this.host +
      `/message/byTransportGuidSentDate` +
      "?ts=" +
      new Date().getTime() +
      (from ? "&from=" + encodeURIComponent(String(from)) : "") +
      (to ? "&to=" + encodeURIComponent(String(to)) : "") +
      (transportGuid ? "&transportGuid=" + encodeURIComponent(String(transportGuid)) : "") +
      (startKey ? "&startKey=" + encodeURIComponent(String(startKey)) : "") +
      (startDocumentId ? "&startDocumentId=" + encodeURIComponent(String(startDocumentId)) : "") +
      (limit ? "&limit=" + encodeURIComponent(String(limit)) : "") +
      (hcpId ? "&hcpId=" + encodeURIComponent(String(hcpId)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new PaginatedListMessage(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get children messages of provided message
   * @param messageId
   */
  getChildrenMessages(messageId: string): Promise<Array<Message>> {
    let _body = null

    const _url =
      this.host +
      `/message/${encodeURIComponent(String(messageId))}/children` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new Message(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get children messages of provided message
   * @param body
   */
  getChildrenMessagesOfList(body?: ListOfIds): Promise<Array<Message>> {
    let _body = null
    _body = body

    const _url = this.host + `/message/children/batch` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new Message(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Gets a message
   * @param messageId
   */
  getMessage(messageId: string): Promise<Message> {
    let _body = null

    const _url =
      this.host +
      `/message/${encodeURIComponent(String(messageId))}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new Message(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get children messages of provided message
   * @param body
   */
  listMessagesByInvoiceIds(body?: ListOfIds): Promise<Array<Message>> {
    let _body = null
    _body = body

    const _url = this.host + `/message/byInvoiceId` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new Message(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get all messages for current HC Party and provided transportGuids
   * @param body
   * @param hcpId
   */
  listMessagesByTransportGuids(hcpId: string, body?: ListOfIds): Promise<Array<Message>> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/message/byTransportGuid/list` +
      "?ts=" +
      new Date().getTime() +
      (hcpId ? "&hcpId=" + encodeURIComponent(String(hcpId)) : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new Message(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Updates a message
   * @param body
   */
  modifyMessage(body?: Message): Promise<Message> {
    let _body = null
    _body = body

    const _url = this.host + `/message` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => new Message(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Adds a delegation to a message
   * @param body
   * @param messageId
   */
  newMessageDelegations(messageId: string, body?: Array<Delegation>): Promise<IcureStub> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/message/${encodeURIComponent(String(messageId))}/delegate` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => new IcureStub(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Set read status for given list of messages
   * @param body
   */
  setMessagesReadStatus(body?: MessagesReadStatusUpdate): Promise<Array<Message>> {
    let _body = null
    _body = body

    const _url = this.host + `/message/readstatus` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new Message(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Set status bits for given list of messages
   * @param body
   * @param status
   */
  setMessagesStatusBits(status: number, body?: ListOfIds): Promise<Array<Message>> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/message/status/${encodeURIComponent(String(status))}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new Message(it)))
      .catch(err => this.handleError(err))
  }
}
