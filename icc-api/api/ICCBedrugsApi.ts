/**
 * 
 * No description provided (generated by Swagger Codegen https://github.com/swagger-api/swagger-codegen)
 *
 * OpenAPI spec version: 1.0.2
 * 
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { XHR } from "./XHR"
import * as models from "../model/models"

export class iccBedrugsApi {
  host: string
  headers: Array<XHR.Header>
  constructor(host: string, headers: any) {
    this.host = host
    this.headers = Object.keys(headers).map(k => new XHR.Header(k, headers[k]))
  }

  setHeaders(h: Array<XHR.Header>) {
    this.headers = h
  }

  handleError(e: XHR.Data) {
    if (e.status == 401) throw Error("auth-failed")
    else throw Error("api-error" + e.status)
  }

  fullTextSearch(searchString: string, lang: string, classes?: string, types?: string, first?: number, count?: number): Promise<Array<models.FullTextSearchResult> | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/mpp/find/fullText/{searchString}/{lang}".replace("{searchString}", searchString+"").replace("{lang}", lang+"") + "?ts=" + new Date().getTime()  + (classes ? "&classes=" + classes : "") + (types ? "&types=" + types : "") + (first ? "&first=" + first : "") + (count ? "&count=" + count : "")
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.FullTextSearchResult(it)))
      .catch(err => this.handleError(err))
}
  getCheapAlternativesBasedOnAtc(medecinePackageId: string, lang: string): Promise<Array<models.MppPreview> | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/atc/{medecinePackageId}/{lang}/cheapmpps".replace("{medecinePackageId}", medecinePackageId+"").replace("{lang}", lang+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.MppPreview(it)))
      .catch(err => this.handleError(err))
}
  getCheapAlternativesBasedOnInn(innClusterId: string, lang: string): Promise<Array<models.MppPreview> | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/inn/{innClusterId}/{lang}/cheapmpps".replace("{innClusterId}", innClusterId+"").replace("{lang}", lang+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.MppPreview(it)))
      .catch(err => this.handleError(err))
}
  getChildrenDocs(docId: string, lang: string): Promise<Array<models.DocPreview> | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/doc/childrenof/{docId}/{lang}".replace("{docId}", docId+"").replace("{lang}", lang+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.DocPreview(it)))
      .catch(err => this.handleError(err))
}
  getChildrenMps(docId: string, lang: string): Promise<Array<models.MpPreview> | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/mp/childrenof/{docId}/{lang}".replace("{docId}", docId+"").replace("{lang}", lang+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.MpPreview(it)))
      .catch(err => this.handleError(err))
}
  getDocOfMp(medecineId: string, lang: string): Promise<models.DocPreview | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/doc/formp/{medecineId}/{lang}".replace("{medecineId}", medecineId+"").replace("{lang}", lang+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc =>  new models.DocPreview(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  getDocPreview(docId: string, lang: string): Promise<models.DocPreview | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/doc/{docId}/{lang}".replace("{docId}", docId+"").replace("{lang}", lang+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc =>  new models.DocPreview(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  getExtentedMpInfosWithPackage(medecinePackageId: string, lang: string): Promise<models.MpExtendedInfos | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/mp/xt/{medecinePackageId}/{lang}".replace("{medecinePackageId}", medecinePackageId+"").replace("{lang}", lang+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc =>  new models.MpExtendedInfos(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  getFullMpInfosWithPackage(medecinePackageId: string, lang: string): Promise<models.MpFullInfos | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/mp/full/{medecinePackageId}/{lang}".replace("{medecinePackageId}", medecinePackageId+"").replace("{lang}", lang+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc =>  new models.MpFullInfos(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  getInnClusters(searchString: string, lang: string, types?: string, first?: number, count?: number): Promise<Array<models.MppPreview> | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/inn/find/{searchString}/{lang}".replace("{searchString}", searchString+"").replace("{lang}", lang+"") + "?ts=" + new Date().getTime()  + (types ? "&types=" + types : "") + (first ? "&first=" + first : "") + (count ? "&count=" + count : "")
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.MppPreview(it)))
      .catch(err => this.handleError(err))
}
  getInteractions(medecinePackageId: string, lang: string, otherCnks: string): Promise<Array<models.IamFullInfos> | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/mpp/{medecinePackageId}/{lang}/interactwith/{otherCnks}".replace("{medecinePackageId}", medecinePackageId+"").replace("{lang}", lang+"").replace("{otherCnks}", otherCnks+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.IamFullInfos(it)))
      .catch(err => this.handleError(err))
}
  getMedecinePackages(searchString: string, lang: string, types?: string, first?: number, count?: number): Promise<Array<models.MppPreview> | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/mpp/find/{searchString}/{lang}".replace("{searchString}", searchString+"").replace("{lang}", lang+"") + "?ts=" + new Date().getTime()  + (types ? "&types=" + types : "") + (first ? "&first=" + first : "") + (count ? "&count=" + count : "")
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.MppPreview(it)))
      .catch(err => this.handleError(err))
}
  getMedecinePackagesFromIngredients(searchString: string, lang: string, types?: string, first?: number, count?: number): Promise<Array<models.MppPreview> | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/mpp/find/byIngredients/{searchString}/{lang}".replace("{searchString}", searchString+"").replace("{lang}", lang+"") + "?ts=" + new Date().getTime()  + (types ? "&types=" + types : "") + (first ? "&first=" + first : "") + (count ? "&count=" + count : "")
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.MppPreview(it)))
      .catch(err => this.handleError(err))
}
  getMpFromMpp(medecinePackageId: string, lang: string): Promise<models.MpPreview | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/mpp/{medecinePackageId}/{lang}/mp".replace("{medecinePackageId}", medecinePackageId+"").replace("{lang}", lang+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc =>  new models.MpPreview(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  getMppInfos(medecinePackageId: string, lang: string): Promise<models.MppInfos | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/mpp/{medecinePackageId}/{lang}".replace("{medecinePackageId}", medecinePackageId+"").replace("{lang}", lang+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc =>  new models.MppInfos(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  getParentDoc(docId: string, lang: string): Promise<models.DocPreview | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/doc/parentof/{docId}/{lang}".replace("{docId}", docId+"").replace("{lang}", lang+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc =>  new models.DocPreview(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  getRootDocs(lang: string): Promise<Array<models.DocPreview> | any> {
    let _body = null
    
    const _url = this.host + "/be_drugs/doc/{lang}".replace("{lang}", lang+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.DocPreview(it)))
      .catch(err => this.handleError(err))
}
}

