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
import { Appointment } from '../model/Appointment';
import { AppointmentImport } from '../model/AppointmentImport';
import { EmailOrSmsMessage } from '../model/EmailOrSmsMessage';
import { MikronoAppointmentTypeRest } from '../model/MikronoAppointmentTypeRest';
import { MikronoCredentials } from '../model/MikronoCredentials';
import { Unit } from '../model/Unit';
import { User } from '../model/User';


export class IccBemikronoApi {
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
      * @summary Get appointments for patient
      * @param calendarDate 
      */
 appointmentsByDate(calendarDate: number): Promise<Array<Appointment>> {
    let _body = null
    
    const _url = this.host + `/be_mikrono/appointments/byDate/${encodeURIComponent(String(calendarDate))}` + "?ts=" + new Date().getTime() 
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => 
          
              (doc.body as Array<JSON>).map(it => new Appointment(it))
      )
      .catch(err => this.handleError(err))
}

     /**
      * 
      * @summary Get appointments for patient
      * @param patientId 
      * @param from 
      * @param to 
      */
 appointmentsByPatient(patientId: string, from?: number, to?: number): Promise<Array<Appointment>> {
    let _body = null
    
    const _url = this.host + `/be_mikrono/appointments/byPatient/${encodeURIComponent(String(patientId))}` + "?ts=" + new Date().getTime()  + (from ? "&from=" + encodeURIComponent(String(from)) : "") + (to ? "&to=" + encodeURIComponent(String(to)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => 
          
              (doc.body as Array<JSON>).map(it => new Appointment(it))
      )
      .catch(err => this.handleError(err))
}

     /**
      * 
      * @param body 
      */
 createAppointmentTypes(body?: Array<MikronoAppointmentTypeRest>): Promise<Array<MikronoAppointmentTypeRest>> {
    let _body = null
    _body = body

    const _url = this.host + `/be_mikrono/appointmentTypes` + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => 
          
              (doc.body as Array<JSON>).map(it => new MikronoAppointmentTypeRest(it))
      )
      .catch(err => this.handleError(err))
}

     /**
      * 
      * @summary Create appointments for owner
      * @param body 
      */
 createAppointments(body?: Array<AppointmentImport>): Promise<Array<string>> {
    let _body = null
    _body = body

    const _url = this.host + `/be_mikrono/appointments` + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => 
          
              (doc.body as Array<JSON>).map(it => JSON.parse(JSON.stringify(it)))
      )
      .catch(err => this.handleError(err))
}

     /**
      * 
      * @summary Notify of an appointment change
      * @param appointmentId 
      * @param action 
      */
 notify(appointmentId: string, action: string): Promise<any | Boolean> {
    let _body = null
    
    const _url = this.host + `/be_mikrono/notify/${encodeURIComponent(String(appointmentId))}/${encodeURIComponent(String(action))}` + "?ts=" + new Date().getTime() 
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc =>       (true))
      .catch(err => this.handleError(err))
}

     /**
      * 
      * @summary Set credentials for provided user
      * @param body 
      * @param userId 
      */
 register(userId: string, body?: MikronoCredentials): Promise<User> {
    let _body = null
    _body = body

    const _url = this.host + `/be_mikrono/user/${encodeURIComponent(String(userId))}/register` + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => 
          
              new User(doc.body as JSON)
              
      )
      .catch(err => this.handleError(err))
}

     /**
      * 
      * @summary Send message using mikrono from logged user
      * @param body 
      */
 sendMessage(body?: EmailOrSmsMessage): Promise<Unit> {
    let _body = null
    _body = body

    const _url = this.host + `/be_mikrono/sendMessage` + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => 
          
              new Unit(doc.body as JSON)
              
      )
      .catch(err => this.handleError(err))
}

     /**
      * 
      * @summary Set credentials for provided user
      * @param body 
      * @param userId 
      */
 setUserCredentials(userId: string, body?: MikronoCredentials): Promise<User> {
    let _body = null
    _body = body

    const _url = this.host + `/be_mikrono/user/${encodeURIComponent(String(userId))}/credentials` + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => 
          
              new User(doc.body as JSON)
              
      )
      .catch(err => this.handleError(err))
}
}

