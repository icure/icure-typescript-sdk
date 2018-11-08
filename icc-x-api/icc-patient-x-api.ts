import { iccPatientApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { IccContactXApi } from "./icc-contact-x-api"
import { IccHcpartyXApi } from "./icc-hcparty-x-api"
import { iccInvoiceApi } from "../icc-api/iccApi"
import { iccHelementApi } from "../icc-api/iccApi"
import { iccDocumentApi } from "../icc-api/iccApi"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"

// noinspection JSUnusedGlobalSymbols
export class IccPatientXApi extends iccPatientApi {
  crypto: IccCryptoXApi
  contactApi: IccContactXApi
  helementApi: iccHelementApi
  invoiceApi: iccInvoiceApi
  hcpartyApi: IccHcpartyXApi
  documentApi: iccDocumentApi

  constructor(
    host: string,
    headers: Array<XHR.Header>,
    crypto: IccCryptoXApi,
    contactApi: IccContactXApi,
    helementApi: iccHelementApi,
    invoiceApi: iccInvoiceApi,
    documentApi: iccDocumentApi,
    hcpartyApi: IccHcpartyXApi
  ) {
    super(host, headers)
    this.crypto = crypto
    this.contactApi = contactApi
    this.helementApi = helementApi
    this.invoiceApi = invoiceApi
    this.hcpartyApi = hcpartyApi
    this.documentApi = documentApi
  }

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: models.UserDto, p: any) {
    const patient = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.Patient",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId,
        author: user.id,
        codes: [],
        tags: []
      },
      p || {}
    )
    return this.initDelegations(patient, null, user)
  }

  initDelegations(
    patient: models.PatientDto,
    parentObject: any,
    user: models.UserDto,
    secretForeignKey?: string
  ): Promise<models.PatientDto> {
    return this.crypto
      .initObjectDelegations(
        patient,
        parentObject,
        user.healthcarePartyId!,
        secretForeignKey || null
      )
      .then(initData => {
        _.extend(patient, { delegations: initData.delegations })

        let promise = Promise.resolve(patient)
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise
              .then(patient =>
                this.crypto.appendObjectDelegations(
                  patient,
                  parentObject,
                  user.healthcarePartyId!,
                  delegateId,
                  initData.secretId
                )
              )
              .then(extraData => _.extend(patient, { delegations: extraData.delegations }))
              .catch(e => {
                console.log(e)
                return patient
              }))
        )
        return promise
      })
  }

  share(patId: string, ownerId: string, delegateIds: Array<string>): Promise<models.PatientDto> {
    return this.getPatient(patId).then((p: models.PatientDto) => {
      const psfksPromise =
        p.delegations && p.delegations[ownerId] && p.delegations[ownerId].length
          ? this.crypto.extractDelegationsSFKs(p, ownerId)
          : Promise.resolve([])
      const peksPromise =
        p.encryptionKeys && p.encryptionKeys[ownerId] && p.encryptionKeys[ownerId].length
          ? this.crypto.extractEncryptionsSKs(p, ownerId)
          : Promise.resolve([])

      return Promise.all([psfksPromise, peksPromise]).then(
        ([psfks, peks]) =>
          psfks.length
            ? Promise.all([
                this.helementApi.findDelegationsStubsByHCPartyPatientSecretFKeys(
                  ownerId,
                  psfks.join(",")
                ) as Promise<Array<models.IcureStubDto>>,
                this.contactApi.findBy(ownerId, p) as Promise<Array<models.ContactDto>>,
                this.invoiceApi.findDelegationsStubsByHCPartyPatientSecretFKeys(
                  ownerId,
                  psfks.join(",")
                ) as Promise<Array<models.IcureStubDto>>
              ]).then(([hes, ctcs, ivs]) => {
                const ctcsStubs = ctcs.map(c => ({
                  id: c.id,
                  rev: c.rev,
                  delegations: c.delegations,
                  cryptedForeignKeys: c.cryptedForeignKeys,
                  encryptionKeys: c.encryptionKeys
                }))
                const docIds: { [key: string]: number } = {}
                ctcs.forEach(
                  (c: models.ContactDto) =>
                    c.services &&
                    c.services.forEach(
                      s =>
                        s.content &&
                        Object.values(s.content).forEach(
                          c => c.documentId && (docIds[c.documentId] = 1)
                        )
                    )
                )

                return Promise.all(
                  Object.keys(docIds).map(dId => this.documentApi.getDocument(dId))
                ).then(docs => {
                  let markerPromise: Promise<any> = Promise.resolve(null)
                  delegateIds.forEach(delegateId => {
                    markerPromise = markerPromise.then(() => {
                      console.log(`share ${p.id} to ${delegateId}`)
                      return this.crypto
                        .addDelegationsAndEncryptionKeys(
                          null,
                          p,
                          ownerId,
                          delegateId,
                          psfks[0],
                          peks[0]
                        )
                        .catch(e => {
                          console.log(e)
                          return p
                        })
                    })
                    hes.forEach(
                      x =>
                        (markerPromise = markerPromise.then(() =>
                          Promise.all([
                            this.crypto.extractDelegationsSFKs(x, ownerId),
                            this.crypto.extractEncryptionsSKs(x, ownerId)
                          ]).then(([sfks, eks]) => {
                            console.log(`share ${x.id} to ${delegateId}`)
                            return this.crypto
                              .addDelegationsAndEncryptionKeys(
                                p,
                                x,
                                ownerId,
                                delegateId,
                                sfks[0],
                                eks[0]
                              )
                              .catch(e => {
                                console.log(e)
                                return x
                              })
                          })
                        ))
                    )
                    ctcsStubs.forEach(
                      x =>
                        (markerPromise = markerPromise.then(() =>
                          Promise.all([
                            this.crypto.extractDelegationsSFKs(x, ownerId),
                            this.crypto.extractEncryptionsSKs(x, ownerId)
                          ]).then(([sfks, eks]) => {
                            console.log(`share ${p.id} to ${delegateId}`)
                            return this.crypto
                              .addDelegationsAndEncryptionKeys(
                                p,
                                x,
                                ownerId,
                                delegateId,
                                sfks[0],
                                eks[0]
                              )
                              .catch(e => {
                                console.log(e)
                                return x
                              })
                          })
                        ))
                    )
                    ivs.forEach(
                      x =>
                        (markerPromise = markerPromise.then(() =>
                          Promise.all([
                            this.crypto.extractDelegationsSFKs(x, ownerId),
                            this.crypto.extractEncryptionsSKs(x, ownerId)
                          ]).then(([sfks, eks]) => {
                            console.log(`share ${p.id} to ${delegateId}`)
                            return this.crypto
                              .addDelegationsAndEncryptionKeys(
                                p,
                                x,
                                ownerId,
                                delegateId,
                                sfks[0],
                                eks[0]
                              )
                              .catch(e => {
                                console.log(e)
                                return x
                              })
                          })
                        ))
                    )
                    docs.forEach(
                      x =>
                        (markerPromise = markerPromise.then(() =>
                          Promise.all([
                            this.crypto.extractDelegationsSFKs(x, ownerId),
                            this.crypto.extractEncryptionsSKs(x, ownerId)
                          ]).then(([sfks, eks]) => {
                            console.log(`share ${p.id} to ${delegateId}`)
                            return this.crypto
                              .addDelegationsAndEncryptionKeys(
                                p,
                                x,
                                ownerId,
                                delegateId,
                                sfks[0],
                                eks[0]
                              )
                              .catch(e => {
                                console.log(e)
                                return x
                              })
                          })
                        ))
                    )
                  })
                  return markerPromise
                    .then(() => {
                      console.log("scd")
                      return this.contactApi.setContactsDelegations(ctcsStubs)
                    })
                    .then(() => {
                      console.log("shed")
                      return this.helementApi.setHealthElementsDelegations(hes)
                    })
                    .then(() => {
                      console.log("sid")
                      return this.invoiceApi.setInvoicesDelegations(ivs)
                    })
                    .then(() => {
                      console.log("sdd")
                      return this.documentApi.setDocumentsDelegations(docs)
                    })
                    .then(() => this.modifyPatient(p))
                })
              })
            : this.modifyPatient(
                Object.assign(p, {
                  delegations: delegateIds
                    .filter(id => !p.delegations || !p.delegations[id])
                    .reduce(
                      (acc, del: String) => Object.assign(acc, _.fromPairs([[del, []]])),
                      p.delegations || {}
                    )
                })
              )
      )
    })
  }

  isValidSsin(ssin: string) {
    ssin = ssin.replace(new RegExp("[^(0-9)]", "g"), "")
    let isValidNiss = false

    const normalNumber = /^[0-9][0-9](([0][0-9])|([1][0-2]))(([0-2][0-9])|([3][0-1]))(([0-9]{2}[1-9])|([0-9][1-9][0-9])|([1-9][0-9]{2}))(([0-8][0-9])|([9][0-7]))$/.test(
      ssin
    )
    const bisNumber = /^[0-9][0-9](([2][0-9])|([3][0-2]))(([0-2][0-9])|([3][0-1]))[0-9]{3}(([0-8][0-9])|([9][0-7]))$/.test(
      ssin
    )
    const terNumber = /^[0-9][0-9](([4][0-9])|([5][0-2]))(([0-2][0-9])|([3][0-1]))[0-9]{3}(([0-8][0-9])|([9][0-7]))$/.test(
      ssin
    )

    if (normalNumber || bisNumber || terNumber) {
      isValidNiss =
        97 - (Number(ssin.substr(0, 9)) % 97) === Number(ssin.substr(9, 2))
          ? true
          : 97 - (Number("2" + ssin.substr(0, 9)) % 97) === Number(ssin.substr(9, 2))
    }

    return isValidNiss
  }
}
