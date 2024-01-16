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
import { AbstractFilterUser } from '../model/AbstractFilterUser'
import { DocIdentifier } from '../model/DocIdentifier'
import { FilterChainUser } from '../model/FilterChainUser'
import { PaginatedListUser } from '../model/PaginatedListUser'
import { PropertyStub } from '../model/PropertyStub'
import { TokenWithGroup } from '../model/TokenWithGroup'
import { Unit } from '../model/Unit'
import { User } from '../model/User'
import { UserGroup } from '../model/UserGroup'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { iccRestApiPath } from './IccRestApiPath'
import { ListOfIds } from '../model/ListOfIds'

export class IccUserApi {
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
   * UserDto gets returned.
   * @summary Assign a healthcare party ID to current user
   * @param healthcarePartyId
   */
  assignHealthcareParty(healthcarePartyId: string): Promise<User> {
    let _body = null

    const _url = this.host + `/user/current/hcparty/${encodeURIComponent(String(healthcarePartyId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new User(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @param password
   */
  checkPassword(password: string): Promise<boolean> {
    let _body = null

    const _url = this.host + `/user/checkPassword` + '?ts=' + new Date().getTime()
    let headers = this.headers
    password && (headers = headers.concat(new XHR.Header('password', password)))
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Check token validity
   * @param userId
   * @param token
   */
  checkTokenValidity(userId: string, token: string): Promise<boolean> {
    let _body = null

    const _url = this.host + `/user/token/${encodeURIComponent(String(userId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    token && (headers = headers.concat(new XHR.Header('token', token)))
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Create a user. HealthcareParty ID should be set. Email or Login have to be set. If login hasn't been set, Email will be used for Login instead.
   * @summary Create a user
   * @param body
   */
  createUser(body?: User): Promise<User> {
    let _body = null
    _body = body

    const _url = this.host + `/user` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new User(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Create a user. HealthcareParty ID should be set. Email has to be set and the Login has to be null. On server-side, Email will be used for Login.
   * @summary Create a user
   * @param body
   * @param groupId
   */
  createUserInGroup(groupId: string, body?: User): Promise<User> {
    let _body = null
    _body = body

    const _url = this.host + `/user/inGroup/${encodeURIComponent(String(groupId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new User(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Creates a new admin user in the group of the current user.
   * @param body the user to create.
   * @return a promise that will resolve to the created user.
   */
  createAdminUser(body?: User): Promise<User> {
    const _url = this.host + `/user/admin` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new User(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Creates a new admin user in a group of the current user.
   * @param body the user to create.
   * @param groupId the id of the group where to create the user.
   * @return a promise that will resolve to the created user.
   */
  createAdminUserInGroup(groupId: string, body?: User): Promise<User> {
    const _url = this.host + `/user/admin/inGroup/${encodeURIComponent(String(groupId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new User(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Delete a User based on his/her ID. The return value is an array containing the ID of deleted user.
   * @summary Delete a User based on his/her ID.
   * @param userId
   */
  deleteUser(userId: string): Promise<DocIdentifier> {
    let _body = null

    const _url = this.host + `/user/${encodeURIComponent(String(userId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new DocIdentifier(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Delete a User based on his/her ID. The return value is an array containing the ID of deleted user.
   * @summary Delete a User based on his/her ID.
   * @param groupId
   * @param userId
   */
  deleteUserInGroup(groupId: string, userId: string): Promise<Unit> {
    let _body = null

    const _url =
      this.host + `/user/inGroup/${encodeURIComponent(String(groupId))}/${encodeURIComponent(String(userId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Unit(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @param password
   */
  encodePassword(password: string): Promise<string> {
    let _body = null

    const _url = this.host + `/user/encodePassword` + '?ts=' + new Date().getTime()
    let headers = this.headers
    password && (headers = headers.concat(new XHR.Header('password', password)))
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of users along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary Filter users for the current user (HcParty)
   * @param body
   * @param startDocumentId A User document ID
   * @param limit Number of rows
   */
  filterUsersBy(startDocumentId?: string, limit?: number, body?: FilterChainUser): Promise<PaginatedListUser> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/user/filter` +
      '?ts=' +
      new Date().getTime() +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListUser(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of users along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary Filter users for the current user (HcParty) for a provided groupId
   * @param body
   * @param groupId
   * @param startDocumentId A User document ID
   * @param limit Number of rows
   */
  filterUsersInGroupBy(groupId: string, startDocumentId?: string, limit?: number, body?: FilterChainUser): Promise<PaginatedListUser> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/user/filter/inGroup/${encodeURIComponent(String(groupId))}` +
      '?ts=' +
      new Date().getTime() +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListUser(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get the list of users by healthcare party id
   * @param id
   */
  findByHcpartyId(id: string): Promise<Array<string>> {
    let _body = null

    const _url = this.host + `/user/byHealthcarePartyId/${encodeURIComponent(String(id))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => JSON.parse(JSON.stringify(it))))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get the list of users by patient id
   * @param id
   */
  findByPatientId(id: string): Promise<Array<string>> {
    let _body = null

    const _url = this.host + `/user/byPatientId/${encodeURIComponent(String(id))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => JSON.parse(JSON.stringify(it))))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get current user.
   * @summary Get Currently logged-in user session.
   */
  getCurrentSession(): Promise<string> {
    let _body = null

    const _url = this.host + `/user/session` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get current user.
   * @summary Get presently logged-in user.
   */
  getCurrentUser(): Promise<User> {
    let _body = null

    const _url = this.host + `/user/current` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new User(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get current user.
   * @summary Get presently logged-in user.
   */
  getMatchingUsers(): Promise<Array<UserGroup>> {
    let _body = null

    const _url = this.host + `/user/matches` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new UserGroup(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Request a new temporary token for authentication
   * @param userId
   * @param key The token key. Only one instance of a token with a defined key can exist at the same time
   * @param tokenValidity The token validity in seconds
   * @param token
   */
  getToken(userId: string, key: string, tokenValidity?: number, token?: string): Promise<string> {
    let _body = null

    const _url =
      this.host +
      `/user/token/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(key))}` +
      '?ts=' +
      new Date().getTime() +
      (tokenValidity ? '&tokenValidity=' + encodeURIComponent(String(tokenValidity)) : '')
    let headers = this.headers
    token && (headers = headers.concat(new XHR.Header('token', token)))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Require a new temporary token for authentication inside all groups
   * @param userIdentifier
   * @param key The token key. Only one instance of a token with a defined key can exist at the same time
   * @param token
   * @param tokenValidity The token validity in seconds
   */
  getTokenInAllGroups(userIdentifier: string, key: string, token?: string, tokenValidity?: number): Promise<Array<TokenWithGroup>> {
    let _body = null

    const _url =
      this.host +
      `/user/inAllGroups/token/${encodeURIComponent(String(userIdentifier))}/${encodeURIComponent(String(key))}` +
      '?ts=' +
      new Date().getTime() +
      (tokenValidity ? '&tokenValidity=' + encodeURIComponent(String(tokenValidity)) : '')
    let headers = this.headers
    token && (headers = headers.concat(new XHR.Header('token', token)))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new TokenWithGroup(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Require a new temporary token for authentication inside provided group
   * @param groupId
   * @param userId
   * @param key The token key. Only one instance of a token with a defined key can exist at the same time
   * @param token
   * @param tokenValidity The token validity in seconds
   */
  getTokenInGroup(groupId: string, userId: string, key: string, token?: string, tokenValidity?: number): Promise<string> {
    let _body = null

    const _url =
      this.host +
      `/user/inGroup/${encodeURIComponent(String(groupId))}/token/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(key))}` +
      '?ts=' +
      new Date().getTime() +
      (tokenValidity ? '&tokenValidity=' + encodeURIComponent(String(tokenValidity)) : '')
    let headers = this.headers
    token && (headers = headers.concat(new XHR.Header('token', token)))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   * General information about the user
   * @summary Get a user by his ID
   * @param userId
   */
  getUser(userId: string): Promise<User> {
    let _body = null

    const _url = this.host + `/user/${encodeURIComponent(String(userId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new User(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Sets the roles of a user to the ones passed as parameter.
   *
   * @param userId the Id of the user to update.
   * @param roleIds the ids of the roles to add to the user.
   */
  setRoles(userId: string, roleIds: string[]): Promise<User> {
    const _body = new ListOfIds({ ids: roleIds })

    const _url = this.host + `/user/${encodeURIComponent(userId)}/roles/set?ts=${new Date().getTime()}'`
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Sets the roles of a user in a group to the ones passed as parameter.
   *
   * @param userId the Id of the user to update.
   * @param groupId the Id of the group the user belongs to.
   * @param roleIds the ids of the roles to add to the user.
   */
  setRolesInGroup(userId: string, groupId: string, roleIds: string[]): Promise<User> {
    const _body = new ListOfIds({ ids: roleIds })

    const _url = this.host + `/user/${encodeURIComponent(userId)}/inGroup/${encodeURIComponent(groupId)}/roles/set?ts=${new Date().getTime()}'`
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Reset the roles of a user to the default ones for their type.
   *
   * @param userId the Id of the user to update.
   */
  resetRoles(userId: string): Promise<User> {
    const _url = this.host + `/user/${encodeURIComponent(userId)}/roles/reset?ts=${new Date().getTime()}'`
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, null, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Reset the roles of a user in a group to the default ones for their type.
   *
   * @param userId the Id of the user to update.
   * @param groupId the Id of the group the user belongs to.
   */
  resetRolesInGroup(userId: string, groupId: string): Promise<User> {
    const _url = this.host + `/user/${encodeURIComponent(userId)}/inGroup/${encodeURIComponent(groupId)}/roles/reset?ts=${new Date().getTime()}'`
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, null, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   * General information about the user
   * @summary Get a user by his Email/Login
   * @param email
   */
  getUserByEmail(email: string): Promise<User> {
    let _body = null

    const _url = this.host + `/user/byEmail/${encodeURIComponent(String(email))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new User(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Get a user by his phone number.
   * @param phoneNumber
   * @return a promise that resolves to the specified user.
   */
  getUserByPhoneNumber(phoneNumber: string): Promise<User> {
    let _body = null

    const _url = this.host + `/user/byPhoneNumber/${encodeURIComponent(String(phoneNumber))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new User(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of users.
   * @summary List users with(out) pagination
   * @param startKey An user email
   * @param startDocumentId An user document ID
   * @param limit Number of rows
   * @param skipPatients Filter out patient users
   */
  listUsers(startKey?: string, startDocumentId?: string, limit?: number, skipPatients?: boolean): Promise<PaginatedListUser> {
    let _body = null

    const _url =
      this.host +
      `/user` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '') +
      (skipPatients !== undefined ? '&skipPatients=' + encodeURIComponent(String(skipPatients)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListUser(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of users.
   * @summary List users with pagination
   * @param groupId
   * @param startKey An user login
   * @param startDocumentId An user document ID
   * @param limit Number of rows
   */
  listUsersInGroup(groupId: string, startKey?: string, startDocumentId?: string, limit?: number): Promise<PaginatedListUser> {
    let _body = null

    const _url =
      this.host +
      `/user/inGroup/${encodeURIComponent(String(groupId))}` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListUser(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get ids of healthcare party matching the provided filter for the current user (HcParty)
   * @param body
   */
  matchUsersBy(body?: AbstractFilterUser): Promise<Array<string>> {
    let _body = null
    _body = body

    const _url = this.host + `/user/match` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => JSON.parse(JSON.stringify(it))))
      .catch((err) => this.handleError(err))
  }

  /**
   * Modify a User properties based on his/her ID. The return value is the modified user.
   * @summary Modify a User property
   * @param body
   * @param userId
   */
  modifyProperties(userId: string, body?: Array<PropertyStub>): Promise<User> {
    let _body = null
    _body = body

    const _url = this.host + `/user/${encodeURIComponent(String(userId))}/properties` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new User(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * No particular return value. It's just a message.
   * @summary Modify a user.
   * @param body
   */
  modifyUser(body?: User): Promise<User> {
    let _body = null
    _body = body

    const _url = this.host + `/user` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new User(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * No particular return value. It's just a message.
   * @summary Modify a user.
   * @param body
   * @param groupId
   */
  modifyUserInGroup(groupId: string, body?: User): Promise<User> {
    let _body = null
    _body = body

    const _url = this.host + `/user/inGroup/${encodeURIComponent(String(groupId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new User(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  enable2fa(userId: string, secret: string): Promise<void> {
    let _body = { secret }

    const _url = this.host + `/user/${encodeURIComponent(String(userId))}/2fa` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then(() => {})
      .catch((err) => this.handleError(err))
  }

  disable2fa(userId: string): Promise<void> {
    const _url = this.host + `/user/${encodeURIComponent(String(userId))}/2fa` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('DELETE', _url, headers, null, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then(() => {})
      .catch((err) => this.handleError(err))
  }
}
