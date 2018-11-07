import { iccEntityrefApi, iccInsuranceApi, iccInvoiceApi, iccMessageApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"

import * as _ from "lodash"
import moment from "moment"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"
import {
  EntityReference,
  Filter,
  FilterChain,
  HealthcarePartyDto,
  InvoiceDto,
  ListOfIdsDto,
  MessageDto,
  PatientHealthCarePartyDto,
  PatientPaginatedList,
  ReceiptDto,
  ReferralPeriod,
  UserDto
} from "../icc-api/model/models"
import {
  decodeBase36Uuid,
  InvoiceWithPatient,
  toInvoiceBatch,
  uuidBase36,
  uuidBase36Half
} from "./utils/efact-util"
import { timeEncode } from "./utils/formatting-util"
import { fhcEfactcontrollerApi } from "fhc-api"
import { EfactSendResponse } from "fhc-api/dist/model/EfactSendResponse"
import { IccDocumentXApi } from "./icc-document-x-api"
import { utils } from "./crypto/utils"
import { EfactMessage } from "fhc-api/dist/model/EfactMessage"
import {
  EfactMessage920098Reader,
  EfactMessage920099Reader,
  EfactMessage920900Reader,
  EfactMessage920999Reader,
  EfactMessage931000Reader,
  EfactMessageReader,
  File920900Data
} from "./utils/efact-parser"
import { ErrorDetail } from "fhc-api/dist/model/ErrorDetail"
import { IccReceiptXApi } from "./icc-receipt-x-api"
import { DmgsList } from "fhc-api/dist/model/DmgsList"
import { DmgClosure } from "fhc-api/dist/model/DmgClosure"
import { DmgExtension } from "fhc-api/dist/model/DmgExtension"
import { IccPatientXApi } from "./icc-patient-x-api"
import { HcpartyType } from "fhc-api/dist/model/HcpartyType"
import { IDHCPARTY } from "fhc-api/dist/model/IDHCPARTY"

export class IccMessageXApi extends iccMessageApi {
  private crypto: IccCryptoXApi
  private insuranceApi: iccInsuranceApi
  private entityReferenceApi: iccEntityrefApi
  private receiptApi: IccReceiptXApi
  private invoiceApi: iccInvoiceApi
  private patientApi: IccPatientXApi

  constructor(
    host: string,
    headers: Array<XHR.Header>,
    crypto: IccCryptoXApi,
    insuranceApi: iccInsuranceApi,
    entityReferenceApi: iccEntityrefApi,
    receiptApi: IccReceiptXApi,
    invoiceApi: iccInvoiceApi,
    patientApi: IccPatientXApi
  ) {
    super(host, headers)
    this.crypto = crypto
    this.insuranceApi = insuranceApi
    this.entityReferenceApi = entityReferenceApi
    this.receiptApi = receiptApi
    this.invoiceApi = invoiceApi
    this.patientApi = patientApi
  }

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: models.UserDto, p: any) {
    const message = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.Message",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId,
        author: user.id,
        codes: [],
        tags: []
      },
      p || {}
    )
    return this.initDelegations(message, null, user)
  }

  processDmgMessagesList(
    user: UserDto,
    hcp: HealthcarePartyDto,
    list: DmgsList,
    docXApi: IccDocumentXApi
  ): Promise<Array<Array<string>>> {
    const ackHashes: Array<string> = []
    let promAck: Promise<ReceiptDto | null> = Promise.resolve(null)
    _.each(list.acks, ack => {
      promAck = promAck
        .then(() =>
          this.receiptApi.logSCReceipt(ack, user, hcp.id!!, [`nip:pin:valuehash:${ack.valueHash}`])
        )
        .then(receipt => {
          ack.valueHash && ackHashes.push(ack.valueHash)
          return receipt
        })
    })

    const patsDmgs: { [key: string]: any } = {}
    const msgHashes: Array<string> = []

    let promMsg: Promise<Array<MessageDto>> = promAck.then(() => [])
    _.each(list.lists, dmgsMsgList => {
      const metas = { type: "list" }
      _.each(dmgsMsgList.inscriptions, i => {
        i.inss &&
          (patsDmgs[i.inss] || (patsDmgs[i.inss] = [])).push({
            date: moment(i.from).format("DD/MM/YYYY"),
            from: moment(i.from).format("DD/MM/YYYY"),
            to: i.to,
            hcp: this.makeHcp(i.hcParty),
            payments: (i.payment1Amount
              ? [
                  {
                    amount: i.payment1Amount,
                    currency: i.payment1Currency,
                    date: i.payment1Date,
                    ref: i.payment1Ref
                  }
                ]
              : []
            ).concat(
              i.payment2Amount
                ? [
                    {
                      amount: i.payment2Amount,
                      currency: i.payment2Currency,
                      date: i.payment2Date,
                      ref: i.payment2Ref
                    }
                  ]
                : []
            )
          })
      })
      promMsg = promMsg.then(acc => {
        return this.saveMessageInDb(
          user,
          "List",
          dmgsMsgList,
          hcp,
          metas,
          docXApi,
          dmgsMsgList.date
        ).then(msg => {
          dmgsMsgList.valueHash && msgHashes.push(dmgsMsgList.valueHash)
          acc.push(msg)
          return acc
        })
      })
    })

    _.each(list.closures, closure => {
      const metas = {
        type: "closure",
        date:
          (closure.endOfPreviousDmg && moment(closure.endOfPreviousDmg).format("DD/MM/YYYY")) ||
          null,
        closure: "true",
        endOfPreviousDmg:
          (closure.endOfPreviousDmg && moment(closure.endOfPreviousDmg).format("DD/MM/YYYY")) ||
          null,
        beginOfNewDmg:
          (closure.beginOfNewDmg && moment(closure.beginOfNewDmg).format("DD/MM/YYYY")) || null,
        previousHcp: this.makeHcp(closure.previousHcParty),
        newHcp: this.makeHcp(closure.newHcParty),
        ssin: closure.inss || null
      }
      closure.inss && (patsDmgs[closure.inss] || (patsDmgs[closure.inss] = [])).push(metas)
      promMsg = promMsg.then(acc => {
        return this.saveMessageInDb(
          user,
          "Closure",
          closure,
          hcp,
          metas,
          docXApi,
          closure.endOfPreviousDmg,
          closure.inss
        ).then(msg => {
          closure.valueHash && msgHashes.push(closure.valueHash)
          acc.push(msg)
          return acc
        })
      })
    })

    _.each(list.extensions, ext => {
      const metas = {
        type: "extension",
        date: (ext.encounterDate && moment(ext.encounterDate).format("DD/MM/YYYY")) || null,
        from: (ext.encounterDate && moment(ext.encounterDate).format("DD/MM/YYYY")) || null,
        hcp: this.makeHcp(ext.hcParty),
        claim: ext.claim || null,
        ssin: ext.inss || null
      }
      ext.inss && (patsDmgs[ext.inss] || (patsDmgs[ext.inss] = [])).push(metas)
      promMsg = promMsg.then(acc => {
        return this.saveMessageInDb(
          user,
          "Extension",
          ext,
          hcp,
          metas,
          docXApi,
          ext.encounterDate,
          ext.inss
        ).then(msg => {
          ext.valueHash && msgHashes.push(ext.valueHash)
          acc.push(msg)
          return acc
        })
      })
    })

    return promMsg.then(acc =>
      Promise.all(
        _.chunk(Object.keys(patsDmgs), 100).map(ssins =>
          this.patientApi
            .filterBy(
              undefined,
              undefined,
              1000,
              0,
              undefined,
              false,
              new FilterChain({
                filter: new Filter({
                  $type: "PatientByHcPartyAndSsinsFilter",
                  healthcarePartyId: user.healthcarePartyId,
                  ssins: ssins
                })
              })
            )
            .then((pats: PatientPaginatedList) =>
              this.patientApi.bulkUpdatePatients(
                (pats.rows || []).map(p => {
                  const actions = _.sortBy(patsDmgs[p.ssin!!], "date")
                  const latestAction = actions[actions.length - 1]

                  let phcp =
                    (p.patientHealthCareParties || (p.patientHealthCareParties = [])) &&
                    p.patientHealthCareParties.find(
                      phcp => phcp.healthcarePartyId === user.healthcarePartyId
                    )
                  if (!phcp) {
                    p.patientHealthCareParties.push(
                      (phcp = new PatientHealthCarePartyDto({
                        healthcarePartyId: user.healthcarePartyId,
                        referralPeriods: []
                      }))
                    )
                  }
                  if (!phcp.referralPeriods) {
                    phcp.referralPeriods = []
                  }

                  const rp =
                    (phcp.referralPeriods && phcp.referralPeriods.find(per => !per.endDate)) ||
                    (phcp.referralPeriods[phcp.referralPeriods.length] = new ReferralPeriod({}))

                  const actionDate = Number(
                    moment(latestAction.date, "DD/MM/YYYY").format("YYYYMMDD")
                  )
                  if (latestAction && !latestAction.closure) {
                    rp.endDate = actionDate
                    phcp.referralPeriods.push(new ReferralPeriod({ startDate: actionDate }))
                  } else if (latestAction && latestAction.closure) {
                    rp.endDate = actionDate
                    rp.comment = `-> ${latestAction.newHcp}`
                  }
                  return p
                })
              )
            )
        )
      ).then(() => [ackHashes, msgHashes])
    )
  }

  private makeHcp(hcParty: HcpartyType | null | undefined) {
    if (!hcParty) {
      return null
    }
    return `${hcParty.firstname || ""} ${hcParty.familyname || ""} ${hcParty.name ||
      ""} [${(hcParty.ids &&
      (hcParty.ids.find(id => id.s === IDHCPARTY.SEnum.IDHCPARTY) || {}).value) ||
      "-"}]`
  }

  private saveMessageInDb(
    user: UserDto,
    msgName: string,
    dmgMessage: DmgsList | DmgClosure | DmgExtension,
    hcp: HealthcarePartyDto,
    metas: { [key: string]: string | null },
    docXApi: IccDocumentXApi,
    date?: Date,
    inss?: string
  ) {
    return this.newInstance(user, {
      // tslint:disable-next-line:no-bitwise
      transportGuid: "GMD:IN:" + dmgMessage.reference,
      fromAddress: dmgMessage.io,
      sent: date && +date,
      toHealthcarePartyId: hcp.id,
      recipients: [hcp.id],
      recipientsType: "org.taktik.icure.entities.HealthcareParty",
      received: +new Date(),
      metas: metas,
      subject: inss
        ? `${msgName} from IO ${dmgMessage.io} for ${inss}`
        : `${msgName} from IO ${dmgMessage.io}`,
      senderReferences: {
        inputReference: dmgMessage.commonOutput && dmgMessage.commonOutput.inputReference,
        outputReference: dmgMessage.commonOutput && dmgMessage.commonOutput.outputReference,
        nipReference: dmgMessage.commonOutput && dmgMessage.commonOutput.nipReference
      }
    })
      .then(msg => this.createMessage(msg))
      .then(msg => {
        return docXApi
          .newInstance(user, msg, {
            mainUti: "public.json",
            name: `${msg.subject}_content.json`
          })
          .then(doc => docXApi.createDocument(doc))
          .then(doc =>
            docXApi.setAttachment(
              doc.id!!,
              undefined /*TODO provide keys for encryption*/,
              utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(dmgMessage)))
            )
          )
          .then(() => msg)
      })
  }

  extractErrorMessage(es?: { itemId: string | null; error?: ErrorDetail }): string | undefined {
    const e = es && es.error
    return e &&
      (e.rejectionCode1 ||
        e.rejectionDescr1 ||
        e.rejectionCode2 ||
        e.rejectionDescr2 ||
        e.rejectionCode3 ||
        e.rejectionDescr3)
      ? _.compact([
          e.rejectionCode1 || (e.rejectionDescr1 && e.rejectionDescr1.trim().length)
            ? `${e.rejectionCode1 || "XXXXXX"}: ${e.rejectionDescr1 || "-"}`
            : null,
          e.rejectionCode2 || (e.rejectionDescr2 && e.rejectionDescr2.trim().length)
            ? `${e.rejectionCode2 || "XXXXXX"}: ${e.rejectionDescr2 || "-"}`
            : null,
          e.rejectionCode3 || (e.rejectionDescr3 && e.rejectionDescr3.trim().length)
            ? `${e.rejectionCode3 || "XXXXXX"}: ${e.rejectionDescr3 || "-"}`
            : null
        ]).join(",")
      : undefined
  }

  processTack(
    user: UserDto,
    hcp: HealthcarePartyDto,
    efactMessage: EfactMessage
  ): Promise<ReceiptDto> {
    if (!efactMessage.tack) {
      throw new Error("Invalid tack")
    }

    return this.receiptApi
      .createReceipt(
        new ReceiptDto({
          references: [
            `mycarenet:efact:inputReference:${efactMessage.tack.appliesTo}`,
            efactMessage.tack!!.appliesTo,
            efactMessage.tack!!.reference
          ]
        })
      )
      .then(rcpt =>
        this.receiptApi.setAttachment(
          rcpt.id,
          "tack",
          undefined,
          utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(efactMessage.tack)))
        )
      )
  }

  processEfactMessage(
    user: UserDto,
    hcp: HealthcarePartyDto,
    efactMessage: EfactMessage,
    docXApi: IccDocumentXApi
  ): Promise<MessageDto> {
    const messageType = efactMessage.detail!!.substr(0, 6)
    const parser: EfactMessageReader | null =
      messageType === "920098"
        ? new EfactMessage920098Reader(efactMessage)
        : messageType === "920099"
          ? new EfactMessage920099Reader(efactMessage)
          : messageType === "920900"
            ? new EfactMessage920900Reader(efactMessage)
            : messageType === "920999"
              ? new EfactMessage920999Reader(efactMessage)
              : messageType === "931000"
                ? new EfactMessage931000Reader(efactMessage)
                : null

    if (!parser) {
      throw new Error(`Unsupported message type ${messageType}`)
    }

    const parsedRecords = parser.read()

    if (!parsedRecords) {
      throw new Error("Cannot parse...")
    }

    const errors = (parsedRecords.et10 && parsedRecords.et10.errorDetail
      ? [parsedRecords.et10.errorDetail]
      : []
    )
      .concat(
        _.flatMap(parsedRecords.records, r => {
          const errors: Array<ErrorDetail> = []

          if (r.et20 && r.et20.errorDetail) {
            errors.push(r.et20.errorDetail)
          }
          _.each(r.items, i => {
            if (i.et50 && i.et50.errorDetail) errors.push(i.et50.errorDetail)
            if (i.et51 && i.et51.errorDetail) errors.push(i.et51.errorDetail)
            if (i.et52 && i.et52.errorDetail) errors.push(i.et52.errorDetail)
          })
          if (r.et80 && r.et80.errorDetail) {
            errors.push(r.et80.errorDetail)
          }

          return errors
        })
      )
      .concat(
        parsedRecords.et90 && parsedRecords.et90.errorDetail ? [parsedRecords.et90.errorDetail] : []
      )

    const ref = Number(efactMessage.commonOutput!!.inputReference!!) % 10000000000

    const acceptedButRejected =
      (parsedRecords.et91 &&
        Number(parsedRecords.et91.acceptedAmountAccount1) +
          Number(parsedRecords.et91.acceptedAmountAccount2) ===
          0) ||
      false

    const statuses =
      (["920999", "920099"].includes(messageType) ||
      (["920900"].includes(messageType) && acceptedButRejected)
        ? 1 << 17 /*STATUS_ERROR*/
        : 0) |
      (["920900"].includes(messageType) && !errors.length && !acceptedButRejected
        ? 1 << 15 /*STATUS_SUCCESS*/
        : 0) |
      (["920900", "920098"].includes(messageType) && errors.length && !acceptedButRejected
        ? 1 << 16 /*STATUS_WARNING*/
        : 0) |
      (["931000", "920999"].includes(messageType) ? 1 << 9 /*STATUS_RECEIVED*/ : 0) |
      (["931000"].includes(messageType) ? 1 << 10 /*STATUS_ACCEPTED_FOR_TREATMENT*/ : 0) |
      (["920999"].includes(messageType) ? 1 << 12 /*STATUS_REJECTED*/ : 0) |
      (["920900", "920098", "920099"].includes(messageType) ? 1 << 17 /*STATUS_ACCEPTED*/ : 0)

    const invoicingErrors: Array<{ itemId: string | null; error?: ErrorDetail }> =
      messageType === "920900"
        ? _.compact(
            _.flatMap((parsedRecords as File920900Data).records, r =>
              r.items.map(
                i =>
                  i.et50 &&
                  i.et50.itemReference &&
                  ({ itemId: decodeBase36Uuid(i.et50.itemReference), error: i.et50.errorDetail } ||
                    null)
              )
            )
          )
        : []

    return this.findMessagesByTransportGuid(
      "EFACT:BATCH:" + ref,
      false,
      undefined,
      undefined,
      100
    ).then(parents => {
      const msgsForHcp = ((parents && parents.rows) || []).filter(
        (p: MessageDto) => p.responsible === hcp.id
      )
      if (!msgsForHcp.length) {
        throw new Error(`Cannot find parent with ref ${ref}`)
      }
      const parentMessage: MessageDto = msgsForHcp[0]
      return this.newInstance(user, {
        // tslint:disable-next-line:no-bitwise
        status: (1 << 1) /*STATUS_UNREAD*/ | statuses,
        transportGuid: "EFACT:IN:" + ref,
        fromAddress: "EFACT",
        sent: timeEncode(new Date()),
        fromHealthcarePartyId: hcp.id,
        recipients: [hcp.id],
        recipientsType: "org.taktik.icure.entities.HealthcareParty",
        received: +new Date(),
        subject: messageType,
        parentId: parentMessage.id,
        senderReferences: {
          inputReference: efactMessage.commonOutput!!.inputReference,
          outputReference: efactMessage.commonOutput!!.outputReference,
          nipReference: efactMessage.commonOutput!!.nipReference
        }
      })
        .then(msg => this.createMessage(msg))
        .then(msg =>
          Promise.all([
            docXApi.newInstance(user, msg, {
              mainUti: "public.plain-text",
              name: msg.subject
            }),
            docXApi.newInstance(user, msg, {
              mainUti: "public.json",
              name: `${msg.subject}_records`
            }),
            docXApi.newInstance(user, msg, {
              mainUti: "public.json",
              name: `${msg.subject}_parsed_records`
            })
          ])
            .then(([doc, jsonDoc, jsonParsedDoc]) =>
              Promise.all([
                docXApi.createDocument(doc),
                docXApi.createDocument(jsonDoc),
                docXApi.createDocument(jsonParsedDoc)
              ])
            )
            .then(([doc, jsonDoc, jsonParsedDoc]) =>
              Promise.all([
                docXApi.setAttachment(
                  doc.id!!,
                  undefined /*TODO provide keys for encryption*/,
                  utils.ua2ArrayBuffer(utils.text2ua(efactMessage.detail!!))
                ),
                docXApi.setAttachment(
                  jsonDoc.id!!,
                  undefined /*TODO provide keys for encryption*/,
                  utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(efactMessage.message)))
                ),
                docXApi.setAttachment(
                  jsonParsedDoc.id!!,
                  undefined /*TODO provide keys for encryption*/,
                  utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(parsedRecords)))
                )
              ])
            )
            .then(
              () =>
                ["920999", "920099", "920900"].includes(messageType)
                  ? this.invoiceApi.getInvoices(new ListOfIdsDto({ ids: parentMessage.invoiceIds }))
                  : Promise.resolve([])
            )
            .then((invoices: Array<models.InvoiceDto>) => {
              const rejectAll = (statuses & (1 << 17)) /*STATUS_ERROR*/ > 0
              return Promise.all(
                _.flatMap(invoices, iv => {
                  let newInvoice: InvoiceDto | null = null
                  _.each(iv.invoicingCodes, ic => {
                    const errStruct = invoicingErrors.find(it => it.itemId === ic.id)
                    if (rejectAll || errStruct) {
                      ic.accepted = false
                      ic.canceled = true
                      ic.pending = false
                      ic.error = (errStruct && this.extractErrorMessage(errStruct)) || undefined
                      ;(
                        newInvoice ||
                        (newInvoice = new InvoiceDto(
                          _.pick(iv, [
                            "invoiceDate",
                            "recipientType",
                            "recipientId",
                            "invoiceType",
                            "secretForeignKeys",
                            "cryptedForeignKeys",
                            "paid",
                            "author",
                            "responsible"
                          ])
                        ))
                      ).invoicingCodes = (newInvoice.invoicingCodes || []).concat(
                        _.assign({}, ic, {
                          id: this.crypto.randomUuid(),
                          accepted: false,
                          canceled: false,
                          pending: true,
                          resent: true
                        })
                      )
                    } else {
                      ic.accepted = true
                      ic.canceled = false
                      ic.pending = false
                      ic.error = undefined

                      let record51 =
                        messageType === "920900" &&
                        _.compact(
                          _.flatMap((parsedRecords as File920900Data).records, r =>
                            r.items!!.map(
                              i =>
                                i &&
                                i.et50 &&
                                decodeBase36Uuid(i.et50.itemReference) === ic.id &&
                                i.et51
                            )
                          )
                        )[0]
                      ic.paid =
                        (record51 &&
                          record51.reimbursementAmount &&
                          Number((Number(record51.reimbursementAmount) / 100).toFixed(2))) ||
                        ic.reimbursement
                    }
                  })
                  return newInvoice
                    ? [this.invoiceApi.createInvoice(newInvoice), this.invoiceApi.modifyInvoice(iv)]
                    : [this.invoiceApi.modifyInvoice(iv)]
                })
              )
            })
            .then(() => {
              parentMessage.status = (parentMessage.status || 0) | statuses
              this.modifyMessage(parentMessage)
            })
            .then(() => msg)
        )
    })
  }

  sendBatch(
    user: UserDto,
    hcp: HealthcarePartyDto,
    federationId: string, //uuid for the Insurance
    invoices: Array<InvoiceWithPatient>,
    xFHCKeystoreId: string,
    xFHCTokenId: string,
    xFHCPassPhrase: string,
    efactApi: fhcEfactcontrollerApi,
    docXApi: IccDocumentXApi
  ): Promise<models.MessageDto> {
    const uuid = this.crypto.randomUuid()
    const smallBase36 = uuidBase36Half(uuid)
    const fullBase36 = uuidBase36(uuid)
    const sentDate = +new Date()
    const errors: Array<string> = []

    return this.insuranceApi.getInsurance(federationId).then(fed => {
      const prefix = `efact:${hcp.id}:${fed.code}:`
      return this.entityReferenceApi
        .getLatest(prefix)
        .then(er =>
          this.entityReferenceApi.createEntityReference(
            new EntityReference({
              id:
                prefix +
                _.padStart(
                  "" + (((er && er.id ? Number(er.id.substr(prefix.length)) : 0) + 1) % 1000000000),
                  9, //1 billion invoices that are going to be mod 1000
                  "0"
                ),
              docId: uuid
            })
          )
        )
        .then(er =>
          toInvoiceBatch(
            invoices,
            hcp,
            fullBase36,
            er && er.id ? Number(er.id.substr(prefix.length)) % 1000 : 0,
            smallBase36,
            this.insuranceApi
          )
        )
        .then(batch =>
          efactApi
            .sendBatchUsingPOST(xFHCKeystoreId, xFHCTokenId, xFHCPassPhrase, batch)
            .then((res: EfactSendResponse) => {
              if (res.success) {
                let promise = Promise.resolve(true)

                _.each(invoices, iv => {
                  promise = promise.then(() => {
                    ;(iv.invoiceDto.invoicingCodes || []).forEach(code => {
                      code.status = 4 // STATUS_PENDING
                    })
                    iv.invoiceDto.sentDate = sentDate
                    return this.invoiceApi.modifyInvoice(iv.invoiceDto).catch((err: any) => {
                      errors.push(`efac-management.CANNOT_UPDATE_INVOICE.${iv.invoiceDto.id}`)
                    })
                  })
                })
                return promise
                  .then(() =>
                    this.newInstance(user, {
                      id: uuid,
                      invoiceIds: invoices.map(i => i.invoiceDto.id),
                      // tslint:disable-next-line:no-bitwise
                      status: 1 << 6, // STATUS_EFACT
                      externalRef: "" + batch.uniqueSendNumber,
                      transportGuid: "EFACT:BATCH:" + batch.numericalRef,
                      sent: timeEncode(new Date()),
                      fromHealthcarePartyId: hcp.id,
                      recipients: [federationId],
                      recipientsType: "org.taktik.icure.entities.Insurance"
                    })
                  )
                  .then(message =>
                    this.createMessage(
                      Object.assign(message, {
                        sent: sentDate,
                        status: (message.status || 0) | (1 << 8)
                      })
                    )
                      .then(msg =>
                        Promise.all([
                          docXApi.newInstance(user, msg, {
                            mainUti: "public.json",
                            name: "920000_records"
                          }),
                          docXApi.newInstance(user, msg, {
                            mainUti: "public.plain-text",
                            name: "920000"
                          })
                        ])
                      )
                      .then(([jsonDoc, doc]) =>
                        Promise.all([docXApi.createDocument(jsonDoc), docXApi.createDocument(doc)])
                      )
                      .then(([jsonDoc, doc]) =>
                        Promise.all([
                          docXApi.setAttachment(
                            jsonDoc.id!!,
                            undefined /*TODO provide keys for encryption*/,
                            utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(res.records!!)))
                          ),
                          docXApi.setAttachment(
                            doc.id!!,
                            undefined /*TODO provide keys for encryption*/,
                            utils.ua2ArrayBuffer(utils.text2ua(res.detail!!))
                          )
                        ])
                      )
                      .then(() =>
                        this.receiptApi.logReceipt(
                          user,
                          message.id!!,
                          [
                            `mycarenet:efact:inputReference:${res.inputReference}`,
                            res.tack!!.appliesTo!!,
                            res.tack!!.reference!!
                          ],
                          "tack",
                          utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(res.tack)))
                        )
                      )
                      .then(() => message)
                  )
              } else {
                throw "Cannot send batch"
              }
            })
        )
        .catch(err => {
          errors.push(err)
          throw errors
        })
    })
  }

  initDelegations(
    message: models.MessageDto,
    parentObject: any,
    user: models.UserDto,
    secretForeignKey?: string
  ): Promise<models.MessageDto> {
    return this.crypto
      .initObjectDelegations(
        message,
        parentObject,
        user.healthcarePartyId!,
        secretForeignKey || null
      )
      .then(initData => {
        _.extend(message, { delegations: initData.delegations })

        let promise = Promise.resolve(message)
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise.then(patient =>
              this.crypto
                .appendObjectDelegations(
                  message,
                  parentObject,
                  user.healthcarePartyId!,
                  delegateId,
                  initData.secretId
                )
                .then(extraData => _.extend(message, { delegations: extraData.delegations || {} }))
                .catch(e => {
                  console.log(e)
                  return message
                })
            ))
        )
        return promise
      })
  }
}
