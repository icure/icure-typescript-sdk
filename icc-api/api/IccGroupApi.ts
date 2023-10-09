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
import { XHR } from './XHR'
import { DatabaseInitialisation } from '../model/DatabaseInitialisation'
import { DocIdentifier } from '../model/DocIdentifier'
import { Group } from '../model/Group'
import { GroupDatabasesInfo } from '../model/GroupDatabasesInfo'
import { GroupDeletionReport } from '../model/GroupDeletionReport'
import { IdWithRev } from '../model/IdWithRev'
import { ListOfIds } from '../model/ListOfIds'
import { ListOfProperties } from '../model/ListOfProperties'
import { PaginatedListGroup } from '../model/PaginatedListGroup'
import { RegistrationInformation } from '../model/RegistrationInformation'
import { RegistrationSuccess } from '../model/RegistrationSuccess'
import { ReplicationInfo } from '../model/ReplicationInfo'
import { Unit } from '../model/Unit'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { iccRestApiPath } from './IccRestApiPath'
import { RoleConfiguration } from '../model/RoleConfiguration'
import { UserTypeEnum } from '../model/UserTypeEnum'

export class IccGroupApi {
  host: string
  headers: Array<XHR.Header>
  authenticationProvider: AuthenticationProvider
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: any,
    authenticationProvider?: AuthenticationProvider,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
    this.host = iccRestApiPath(host)
    this.headers = Object.keys(headers).map((k) => new XHR.Header(k, headers[k]))
    this.authenticationProvider = !!authenticationProvider ? authenticationProvider : new NoAuthenticationProvider()
    this.fetchImpl = fetchImpl
  }

  setHeaders(h: Array<XHR.Header>) {
    this.headers = h
  }

  handleError(e: XHR.XHRError): never {
    throw e
  }

  /**
   * Changes the supergroup of the group passed as parameter according to the operation token
   * @summary Transfers the ownership of a group
   * @param operationToken The operation token generated by the target group
   * @param childGroupId The id of the group to transfer
   */
  changeSuperGroup(operationToken: string, childGroupId: string): Promise<Group> {
    let _body = null

    const _url = this.host + `/group/${encodeURIComponent(String(childGroupId))}/transfer` + '?ts=' + new Date().getTime()
    let headers = this.headers
    operationToken && (headers = headers.concat(new XHR.Header('Operation-Token', operationToken)))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Group(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Create a new group and associated dbs.  The created group will be manageable by the users that belong to the same group as the one that called createGroup. Several tasks can be executed during the group creation like DB replications towards the created DBs, users creation and healthcare parties creation
   * @summary Create a group
   * @param body
   * @param id The id of the group, also used for subsequent authentication against the db (can only contain digits, letters, - and _)
   * @param name The name of the group
   * @param type The type of the group.
   * @param password The password of the group (can only contain digits, letters, - and _)
   * @param server The server on which the group dbs will be created
   * @param q The number of shards for patient and healthdata dbs : 3-8 is a recommended range of value
   * @param n The number of replications for dbs : 3 is a recommended value
   * @param superGroup Group parent
   */
  createGroup(
    id: string,
    name: string,
    password: string,
    server?: string,
    q?: number,
    n?: number,
    superGroup?: string,
    type?: string,
    body?: DatabaseInitialisation
  ): Promise<Group> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/group/${encodeURIComponent(String(id))}` +
      '?ts=' +
      new Date().getTime() +
      (name ? '&name=' + encodeURIComponent(String(name)) : '') +
      (type ? '&type=' + encodeURIComponent(String(type)) : '') +
      (server ? '&server=' + encodeURIComponent(String(server)) : '') +
      (q ? '&q=' + encodeURIComponent(String(q)) : '') +
      (n ? '&n=' + encodeURIComponent(String(n)) : '') +
      (superGroup ? '&superGroup=' + encodeURIComponent(String(superGroup)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    password && (headers = headers.concat(new XHR.Header('password', password)))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Group(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Delete group without reset or deleteing storage
   * @summary Delete group
   * @param id The id of group to delete
   */
  deleteGroup(id: string): Promise<Group> {
    let _body = null

    const _url = this.host + `/group/${encodeURIComponent(String(id))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Group(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Deletes an operation token in the group of the user based on its id
   * @summary Deletes an operation token for the current group
   * @param tokenId The operation that the token will allow
   */
  deleteOperationToken(tokenId: string): Promise<Unit> {
    let _body = null

    const _url = this.host + `/group/operationToken/${encodeURIComponent(String(tokenId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Unit(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * List groups that are the children of the group with the provided parent id
   * @summary Find groups by parent
   * @param id The id of the group
   * @param startDocumentId A group document ID used as a cursor for pagination
   * @param limit Number of rows
   */
  findGroups(id: string, startDocumentId?: string, limit?: number): Promise<PaginatedListGroup> {
    let _body = null

    const _url =
      this.host +
      `/group/${encodeURIComponent(String(id))}/children` +
      '?ts=' +
      new Date().getTime() +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListGroup(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * List groups that are the children of the group with the provided parent id and that match the provided search string
   * @summary Find groups by parent and content
   * @param id The id of the group
   * @param searchString The string to search for in the group. Properties, name and id are scanned for the provided search string.
   * @param startKey The start key for pagination, depends on the filters used
   * @param startDocumentId A group document ID used as a cursor for pagination
   * @param limit Number of rows
   */
  findGroupsWithContent(id: string, searchString: string, startKey?: string, startDocumentId?: string, limit?: number): Promise<PaginatedListGroup> {
    let _body = null

    const _url =
      this.host +
      `/group/${encodeURIComponent(String(id))}/children/search` +
      '?ts=' +
      new Date().getTime() +
      (searchString ? '&searchString=' + encodeURIComponent(String(searchString)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListGroup(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get a group by id
   * @summary Get a group by id
   * @param id The id of the group
   */
  getGroup(id: string): Promise<Group> {
    let _body = null

    const _url = this.host + `/group/${encodeURIComponent(String(id))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Group(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Reset storage
   * @summary Reset storage for group
   * @param body
   */
  getGroupsStorageInfos(body?: ListOfIds): Promise<Array<GroupDatabasesInfo>> {
    let _body = null
    _body = body

    const _url = this.host + `/group/storage/info` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new GroupDatabasesInfo(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get all the parent groups of the group passed as parameter, as long as the current user has access to them
   * @param id The id of the group
   */
  getHierarchy(id: string): Promise<Array<string>> {
    let _body = null

    const _url = this.host + `/group/${encodeURIComponent(String(id))}/hierarchy` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => JSON.parse(JSON.stringify(it))))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get a group by id
   * @summary Get a group by id
   * @param id The id of the group
   */
  getNameOfGroupParent(id: string): Promise<string> {
    let _body = null

    const _url = this.host + `/group/${encodeURIComponent(String(id))}/parent/name` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Creates an operation token with limited time and scope validity for the group of the user
   * @summary Creates an operation token for the current group
   * @param operation The operation that the token will allow
   * @param duration The duration of the token in seconds (default 3600)
   */
  getOperationToken(operation: string, duration?: number): Promise<string> {
    let _body = null

    const _url =
      this.host +
      `/group/operationToken` +
      '?ts=' +
      new Date().getTime() +
      (operation ? '&operation=' + encodeURIComponent(String(operation)) : '') +
      (duration ? '&duration=' + encodeURIComponent(String(duration)) : '')
    let headers = this.headers
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get index info
   * @param id The id of the group
   */
  getReplicationInfo1(id: string): Promise<ReplicationInfo> {
    let _body = null

    const _url = this.host + `/group/${encodeURIComponent(String(id))}/r` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new ReplicationInfo(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Hard deletes the provided group from CouchDB. This operation can only be done by an admin user
   * @summary Hard delete group
   * @param id The id of group to delete
   */
  hardDeleteGroup(id: string): Promise<Array<GroupDeletionReport>> {
    let _body = null

    const _url = this.host + `/group/hard/${encodeURIComponent(String(id))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new GroupDeletionReport(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Init design docs for provided group
   * @summary Init design docs
   * @param id The id of the group
   * @param clazz The class of the design doc
   * @param warmup Warmup the design doc
   * @param dryRun Do nothing
   */
  initDesignDocs(id: string, clazz?: string, warmup?: boolean, dryRun?: boolean): Promise<Unit> {
    let _body = null

    const _url =
      this.host +
      `/group/${encodeURIComponent(String(id))}/dd` +
      '?ts=' +
      new Date().getTime() +
      (clazz ? '&clazz=' + encodeURIComponent(String(clazz)) : '') +
      (warmup ? '&warmup=' + encodeURIComponent(String(warmup)) : '') +
      (dryRun ? '&dryRun=' + encodeURIComponent(String(dryRun)) : '')
    let headers = this.headers
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Unit(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * List existing groups
   * @summary List all the groups ids the current user can access
   */
  listAllGroupsIds(): Promise<Array<DocIdentifier>> {
    let _body = null

    const _url = this.host + `/group/all` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * List available apps for user
   * @summary List apps
   */
  listApps(): Promise<Array<Group>> {
    let _body = null

    const _url = this.host + `/group/apps` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Group(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * List existing groups
   * @summary List groups
   */
  listGroups(): Promise<Array<Group>> {
    let _body = null

    const _url = this.host + `/group` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Group(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Update existing group name
   * @summary Update group name
   * @param id The id of the group
   * @param name The new name for the group
   */
  modifyGroupName(id: string, name: string): Promise<Group> {
    let _body = null

    const _url = this.host + `/group/${encodeURIComponent(String(id))}/name/${encodeURIComponent(String(name))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Group(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Update existing group properties
   * @summary Update group properties
   * @param body
   * @param id The id of the group
   */
  modifyGroupProperties(id: string, body?: ListOfProperties): Promise<Group> {
    let _body = null
    _body = body

    const _url = this.host + `/group/${encodeURIComponent(String(id))}/properties` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Group(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Sets the default roles to assign to a certain category of users in a group.
   *
   * @param groupId the group to update.
   * @param userType the type of user.
   * @param roleIds the ids of the roles to assign by default to that type of user.
   * @return the updated group
   */
  setDefaultRoles(groupId: string, userType: UserTypeEnum, roleIds: string[]): Promise<Group> {
    const _body = new ListOfIds({ ids: roleIds })

    const _url = this.host + `/group/${encodeURIComponent(groupId)}/defaultRoles?userType=${userType}&ts=${new Date().getTime()}`
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  getDefaultRoles(groupId: string): Promise<{ [key in UserTypeEnum]: RoleConfiguration }> {
    const _body = null

    const _url = this.host + `/group/${encodeURIComponent(groupId)}/defaultRoles?ts=${new Date().getTime()}`
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Create a new group and associated dbs.  The created group will be manageable by the users that belong to the same group as the one that called createGroup. Several tasks can be executed during the group creation like DB replications towards the created DBs, users creation and healthcare parties creation
   * @summary Create a group
   * @param body
   * @param type The type of the group (default: root)
   * @param role The role of the user (default: admin)
   */
  registerNewGroupAdministrator(type?: string, role?: string, body?: RegistrationInformation): Promise<RegistrationSuccess> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/group/register/trial` +
      '?ts=' +
      new Date().getTime() +
      (type ? '&type=' + encodeURIComponent(String(type)) : '') +
      (role ? '&role=' + encodeURIComponent(String(role)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new RegistrationSuccess(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Reset storage
   * @summary Reset storage for group
   * @param body
   * @param id The id of the group
   * @param q The number of shards for patient and healthdata dbs : 3-8 is a recommended range of value
   * @param n The number of replications for dbs : 3 is a recommended value
   */
  resetStorage(id: string, q?: number, n?: number, body?: ListOfIds): Promise<Unit> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/group/${encodeURIComponent(String(id))}/reset/storage` +
      '?ts=' +
      new Date().getTime() +
      (q ? '&q=' + encodeURIComponent(String(q)) : '') +
      (n ? '&n=' + encodeURIComponent(String(n)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Unit(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Update password for provided group
   * @summary Set group password
   * @param id The id of the group
   * @param password The new password for the group (can only contain digits, letters, - and _)
   */
  setGroupPassword(id: string, password: string): Promise<Group> {
    let _body = null

    const _url = this.host + `/group/${encodeURIComponent(String(id))}/password` + '?ts=' + new Date().getTime()
    let headers = this.headers
    password && (headers = headers.concat(new XHR.Header('password', password)))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Group(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Solve conflicts for group
   * @summary Solve conflicts for group
   * @param id The id of the group
   * @param limit Solve at most limit conflicts
   * @param warmup Warmup the design doc
   */
  solveConflicts(id: string, limit?: number, warmup?: boolean): Promise<Array<IdWithRev>> {
    let _body = null

    const _url =
      this.host +
      `/group/${encodeURIComponent(String(id))}/conflicts` +
      '?ts=' +
      new Date().getTime() +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '') +
      (warmup ? '&warmup=' + encodeURIComponent(String(warmup)) : '')
    let headers = this.headers
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new IdWithRev(it)))
      .catch((err) => this.handleError(err))
  }
}
