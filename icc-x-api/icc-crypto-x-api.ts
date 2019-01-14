import { iccHcpartyApi } from "../icc-api/iccApi"
import { AES, AESUtils } from "./crypto/AES"
import { RSA, RSAUtils } from "./crypto/RSA"
import { utils, UtilsClass } from "./crypto/utils"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"
import { DelegationDto } from "../icc-api/model/models"

export class IccCryptoXApi {
  hcPartyKeysCache: {
    [key: string]: { delegatorId: string; key: CryptoKey }
  } = {}
  hcPartiesRequestsCache: { [key: string]: Promise<models.HealthcarePartyDto> } = {}
  hcPartyKeysRequestsCache: { [key: string]: Promise<any> } = {}

  emptyHcpCache(hcpartyId: string) {
    delete this.hcPartiesRequestsCache[hcpartyId]
    delete this.hcPartyKeysRequestsCache[hcpartyId]
  }

  private getHealthcareParty(hcpartyId: string): Promise<models.HealthcarePartyDto> {
    return (
      this.hcPartiesRequestsCache[hcpartyId] ||
      (this.hcPartiesRequestsCache[hcpartyId] = this.hcpartyBaseApi.getHealthcareParty(hcpartyId))
    )
  }

  private getHcPartyKeysForDelegate(delegateHcPartyId: string): Promise<{ [key: string]: string }> {
    return (
      this.hcPartyKeysRequestsCache[delegateHcPartyId] ||
      (this.hcPartyKeysRequestsCache[
        delegateHcPartyId
      ] = this.hcpartyBaseApi.getHcPartyKeysForDelegate(delegateHcPartyId))
    )
  }

  keychainLocalStoreIdPrefix: String = "org.taktik.icure.ehealth.keychain."

  hcpartyBaseApi: iccHcpartyApi
  AES: AESUtils = AES
  RSA: RSAUtils = RSA
  utils: UtilsClass = utils

  constructor(host: string, headers: Array<XHR.Header>, hcpartyBaseApi: iccHcpartyApi) {
    this.hcpartyBaseApi = hcpartyBaseApi
  }

  randomUuid() {
    return ((1e7).toString() + -1e3 + -4e3 + -8e3 + -1e11).replace(
      /[018]/g,
      c =>
        (
          Number(c) ^
          (((typeof window === "undefined" ? self : window).crypto.getRandomValues(
            new Uint8Array(1)
          )! as Uint8Array)[0] &
            (15 >> (Number(c) / 4)))
        ).toString(16) //Keep that inlined or you will loose the random
    )
  }

  decryptHcPartyKey(
    delegatorId: string,
    delegateHcPartyId: string,
    encryptedHcPartyKey: string,
    encryptedForDelegator: boolean = false
  ): Promise<{ delegatorId: string; key: CryptoKey }> {
    const cacheKey =
      delegatorId + "|" + delegateHcPartyId + "|" + (encryptedForDelegator ? "->" : "<-")
    const res = this.hcPartyKeysCache[cacheKey]
    const hcPartyKeyOwner = encryptedForDelegator ? delegatorId : delegateHcPartyId
    if (res) {
      return Promise.resolve(res)
    } else {
      const keyPair = this.RSA.rsaKeyPairs[hcPartyKeyOwner]
      return (keyPair
        ? Promise.resolve(keyPair)
        : Promise.resolve(this.RSA.loadKeyPairNotImported(hcPartyKeyOwner)).then(keyPairInJwk =>
            this.cacheKeyPair(keyPairInJwk, hcPartyKeyOwner)
          )
      )
        .then(keyPair =>
          this.RSA.decrypt(keyPair.privateKey, this.utils.hex2ua(encryptedHcPartyKey))
        )
        .then(decryptedHcPartyKey => this.AES.importKey("raw", decryptedHcPartyKey))
        .then(
          decryptedImportedHcPartyKey =>
            (this.hcPartyKeysCache[cacheKey] = {
              delegatorId: delegatorId,
              key: decryptedImportedHcPartyKey
            })
        )
    }
  }

  cacheKeyPair(
    keyPairInJwk: { publicKey: JsonWebKey | ArrayBuffer; privateKey: JsonWebKey | ArrayBuffer },
    hcPartyKeyOwner: string
  ) {
    if (!keyPairInJwk) {
      throw "No RSA private key for Healthcare party(" + hcPartyKeyOwner + ")."
    }
    return this.RSA.importKeyPair(
      "jwk",
      keyPairInJwk.privateKey,
      "jwk",
      keyPairInJwk.publicKey
    ).then(importedKeyPair => {
      return (this.RSA.rsaKeyPairs[hcPartyKeyOwner] = importedKeyPair)
    })
  }

  decryptAndImportAesHcPartyKeysForDelegators(
    delegatorsHcPartyIdsSet: Array<string>,
    delegateHcPartyId: string
  ): Promise<Array<{ delegatorId: string; key: CryptoKey }>> {
    return (
      this.hcPartyKeysRequestsCache[delegateHcPartyId] ||
      (this.hcPartyKeysRequestsCache[delegateHcPartyId] = this.getHcPartyKeysForDelegate(
        delegateHcPartyId
      ))
    ).then((healthcarePartyKeys: { [key: string]: string }) => {
      // For each delegatorId, obtain the AES keys
      return Promise.all(
        delegatorsHcPartyIdsSet.map((delegatorId: string) =>
          this.decryptHcPartyKey(delegatorId, delegateHcPartyId, healthcarePartyKeys[delegatorId])
        )
      )
    })
  }

  decryptAndImportAesHcPartyKeysInDelegations(
    healthcarePartyId: string,
    delegations: { [key: string]: Array<models.DelegationDto> },
    fallbackOnParent = true
  ): Promise<Array<{ delegatorId: string; key: CryptoKey }>> {
    const delegatorIds: { [key: string]: boolean } = {}
    if (delegations[healthcarePartyId] && delegations[healthcarePartyId].length) {
      delegations[healthcarePartyId].forEach(function(delegation) {
        delegatorIds[delegation.owner!] = true
      })
    } else if (fallbackOnParent) {
      return this.getHealthcareParty(healthcarePartyId).then(
        hcp =>
          hcp.parentId
            ? this.decryptAndImportAesHcPartyKeysInDelegations(hcp.parentId, delegations)
            : Promise.resolve([])
      )
    }

    return this.decryptAndImportAesHcPartyKeysForDelegators(
      Object.keys(delegatorIds),
      healthcarePartyId
    )
  }

  initObjectDelegations(
    createdObject: any,
    parentObject: any,
    ownerId: string,
    secretForeignKeyOfParent: string | null
  ): Promise<{
    delegations: any
    cryptedForeignKeys: any
    secretForeignKeys: any[]
    secretId: string
  }> {
    const secretId = this.randomUuid()
    return this.getHealthcareParty(ownerId)
      .then(owner => owner.hcPartyKeys![ownerId][0])
      .then(encryptedHcPartyKey =>
        this.decryptHcPartyKey(ownerId, ownerId, encryptedHcPartyKey, true)
      )
      .then(importedAESHcPartyKey =>
        Promise.all([
          this.AES.encrypt(importedAESHcPartyKey.key, utils.text2ua(
            createdObject.id + ":" + secretId
          ).buffer as ArrayBuffer),
          parentObject
            ? this.AES.encrypt(importedAESHcPartyKey.key, utils.text2ua(
                createdObject.id + ":" + parentObject.id
              ).buffer as ArrayBuffer)
            : Promise.resolve(null)
        ])
      )
      .then(encryptedDelegationAndSecretForeignKey => ({
        delegations: _.fromPairs([
          [
            ownerId,
            [
              {
                owner: ownerId,
                delegatedTo: ownerId,
                key: this.utils.ua2hex(encryptedDelegationAndSecretForeignKey[0]!)
              }
            ]
          ]
        ]),
        cryptedForeignKeys:
          (encryptedDelegationAndSecretForeignKey[1] &&
            _.fromPairs([
              [
                ownerId,
                [
                  {
                    owner: ownerId,
                    delegatedTo: ownerId,
                    key: this.utils.ua2hex(encryptedDelegationAndSecretForeignKey[1]!)
                  }
                ]
              ]
            ])) ||
          {},
        secretForeignKeys: (secretForeignKeyOfParent && [secretForeignKeyOfParent]) || [],
        secretId: secretId
      }))
  }

  appendObjectDelegationsAndCryptedForeignKeys(
    modifiedObject: any | null,
    parentObject: any | null,
    ownerId: string,
    delegateId: string,
    secretIdOfModifiedObject: string | null
  ): Promise<{
    delegations: { [key: string]: Array<models.DelegationDto> }
    cryptedForeignKeys: { [key: string]: Array<models.DelegationDto> }
    secretId: string | null
  }> {
    if (!secretIdOfModifiedObject) {
      return Promise.resolve({
        delegations: modifiedObject.delegations,
        cryptedForeignKeys: modifiedObject.cryptedForeignKeys,
        secretId: null
      })
    }
    return this.getHealthcareParty(ownerId)
      .then(owner => {
        if (!owner.hcPartyKeys![delegateId]) {
          return this.generateKeyForDelegate(ownerId, delegateId).then(
            owner => owner.hcPartyKeys[delegateId][0]
          )
        }
        return Promise.resolve(owner.hcPartyKeys![delegateId][0])
      })
      .then(encryptedHcPartyKey =>
        this.decryptHcPartyKey(ownerId, delegateId, encryptedHcPartyKey, true)
      )
      .then(importedAESHcPartyKey =>
        Promise.all([
          Promise.all((modifiedObject.delegations[delegateId] || []).map(
            (d: DelegationDto) =>
              d.key && this.AES.decrypt(importedAESHcPartyKey.key, this.utils.hex2ua(d.key))
          ) as Array<Promise<ArrayBuffer>>),

          Promise.all((modifiedObject.cryptedForeignKeys[delegateId] || []).map(
            (d: DelegationDto) =>
              d.key && this.AES.decrypt(importedAESHcPartyKey.key, this.utils.hex2ua(d.key))
          ) as Array<Promise<ArrayBuffer>>),

          this.AES.encrypt(importedAESHcPartyKey.key, utils.text2ua(
            modifiedObject.id + ":" + secretIdOfModifiedObject
          ).buffer as ArrayBuffer),

          parentObject
            ? this.AES.encrypt(importedAESHcPartyKey.key, utils.text2ua(
                modifiedObject.id + ":" + parentObject.id
              ).buffer as ArrayBuffer)
            : Promise.resolve(null)
        ])
      )
      .then(
        ([
          previousDecryptedDelegations,
          previousDecryptedCryptedForeignKeys,
          cryptedDelegation,
          cryptedForeignKey
        ]) => {
          //try to limit the extent of the modifications to the delegations by preserving the redundant delegation already present and removing duplicates
          //For delegate delegateId, we create:
          // 1. an array of objects { d : {owner,delegatedTo,encrypted(key)}} with one object for the existing delegations and the new key concatenated
          // 2. an array of objects { k : decrypted(key)} with one object for the existing delegations and the new key concatenated
          // We merge them to get one array of objects: { d: {owner,delegatedTo,encrypted(key)}, k: decrypted(key)}
          const delegationCryptedDecrypted = _.merge(
            (modifiedObject.delegations[delegateId] || [])
              .concat([
                {
                  owner: ownerId,
                  delegatedTo: delegateId,
                  key: this.utils.ua2hex(cryptedDelegation)
                }
              ])
              .map((d: DelegationDto) => ({ d })),
            (previousDecryptedDelegations || [])
              .map(d => this.utils.ua2text(d))
              .concat([`${modifiedObject.id}:${secretIdOfModifiedObject}`])
              .map(k => ({ k }))
          )

          const allDelegations = _.cloneDeep(modifiedObject.delegations)

          //Only keep one version of the decrypted key
          allDelegations[delegateId] = _.uniqBy(delegationCryptedDecrypted, (x: any) => x.k).map(
            (x: any) => x.d
          )

          const cryptedForeignKeysCryptedDecrypted = _.merge(
            (modifiedObject.cryptedForeignKeys[delegateId] || [])
              .concat(
                cryptedForeignKey
                  ? [
                      {
                        owner: ownerId,
                        delegatedTo: delegateId,
                        key: this.utils.ua2hex(cryptedForeignKey)
                      }
                    ]
                  : []
              )
              .map((d: DelegationDto) => ({ d })),
            (previousDecryptedCryptedForeignKeys || [])
              .map(d => this.utils.ua2text(d))
              .concat(cryptedForeignKey ? [`${modifiedObject.id}:${parentObject.id}`] : [])
              .map(k => ({ k }))
          )

          const allCryptedForeignKeys = _.cloneDeep(modifiedObject.cryptedForeignKeys)
          allCryptedForeignKeys[delegateId] = _.uniqBy(
            cryptedForeignKeysCryptedDecrypted,
            (x: any) => x.k
          ).map((x: any) => x.d)

          return {
            delegations: allDelegations,
            cryptedForeignKeys: allCryptedForeignKeys,
            secretId: secretIdOfModifiedObject
          }
        }
      )
  }

  initEncryptionKeys(
    createdObject: any,
    ownerId: string
  ): Promise<{
    encryptionKeys: any
    secretId: string
  }> {
    const secretId = this.randomUuid()
    return this.getHcPartyKeysForDelegate(ownerId)
      .then(encryptedHcPartyKey =>
        this.decryptHcPartyKey(ownerId, ownerId, encryptedHcPartyKey[ownerId], true)
      )
      .then(importedAESHcPartyKey =>
        this.AES.encrypt(
          importedAESHcPartyKey.key,
          utils.text2ua(createdObject.id + ":" + secretId)
        )
      )
      .then(encryptedEncryptionKeys => ({
        encryptionKeys: _.fromPairs([
          [
            ownerId,
            [
              {
                owner: ownerId,
                delegatedTo: ownerId,
                key: this.utils.ua2hex(encryptedEncryptionKeys)
              }
            ]
          ]
        ]),
        secretId: secretId
      }))
  }

  appendEncryptionKeys(
    modifiedObject: any,
    ownerId: string,
    delegateId: string,
    secretIdOfModifiedObject: string
  ): Promise<{
    encryptionKeys: { [key: string]: Array<models.DelegationDto> }
    secretId: string | null
  }> {
    if (!secretIdOfModifiedObject) {
      return Promise.resolve({ encryptionKeys: modifiedObject.encryptionKeys, secretId: null })
    }
    return this.getHealthcareParty(ownerId)
      .then(owner => {
        if (!owner.hcPartyKeys![delegateId]) {
          return this.generateKeyForDelegate(ownerId, delegateId).then(
            owner => owner.hcPartyKeys![delegateId][0]
          )
        }
        return Promise.resolve(owner.hcPartyKeys![delegateId][0])
      })
      .then(encryptedHcPartyKey =>
        this.decryptHcPartyKey(ownerId, delegateId, encryptedHcPartyKey, true)
      )
      .then(importedAESHcPartyKey =>
        Promise.all([
          Promise.all((modifiedObject.encryptionKeys[delegateId] || []).map(
            (eck: DelegationDto) =>
              eck.key && this.AES.decrypt(importedAESHcPartyKey.key, this.utils.hex2ua(eck.key))
          ) as Array<Promise<ArrayBuffer>>),
          this.AES.encrypt(
            importedAESHcPartyKey.key,
            utils.text2ua(modifiedObject.id + ":" + secretIdOfModifiedObject)
          )
        ])
      )
      .then(([previousDecryptedEncryptionKeys, encryptedEncryptionKey]) => {
        //try to limit the extent of the modifications to the delegations by preserving the redundant encryption keys already present and removing duplicates
        //For delegate delegateId, we create:
        // 1. an array of objects { d : {owner,delegatedTo,encrypted(key)}} with one object for the existing encryption keys and the new key concatenated
        // 2. an array of objects { k : decrypted(key)} with one object for the existing delegations and the new key concatenated
        // We merge them to get one array of objects: { d: {owner,delegatedTo,encrypted(key)}, k: decrypted(key)}
        const encryptionKeysCryptedDecrypted = _.merge(
          (modifiedObject.encryptionKeys[delegateId] || [])
            .concat([
              {
                owner: ownerId,
                delegatedTo: delegateId,
                key: this.utils.ua2hex(encryptedEncryptionKey)
              }
            ])
            .map((d: DelegationDto) => ({ d })),
          (previousDecryptedEncryptionKeys || [])
            .map(d => this.utils.ua2text(d))
            .concat([`${modifiedObject.id}:${secretIdOfModifiedObject}`])
            .map(k => ({ k }))
        )

        const allEncryptionKeys = _.cloneDeep(modifiedObject.encryptionKeys)
        allEncryptionKeys[delegateId] = _.uniqBy(
          encryptionKeysCryptedDecrypted,
          (x: any) => x.k
        ).map((x: any) => x.d)

        return {
          encryptionKeys: allEncryptionKeys,
          secretId: secretIdOfModifiedObject
        }
      })
  }

  //This method is safe. It check if the
  addDelegationsAndEncryptionKeys(
    parent: models.PatientDto | models.MessageDto | null,
    child:
      | models.PatientDto
      | models.ContactDto
      | models.InvoiceDto
      | models.DocumentDto
      | models.HealthElementDto
      | models.ReceiptDto,
    ownerId: string,
    delegateId: string,
    secretDelegationKey: string,
    secretEncryptionKey: string
  ) {
    return Promise.all([
      this.appendObjectDelegationsAndCryptedForeignKeys(
        child,
        parent,
        ownerId,
        delegateId,
        secretDelegationKey
      ),
      this.appendEncryptionKeys(child, ownerId, delegateId, secretEncryptionKey)
    ]).then(extraData => {
      const extraDels = extraData[0]
      const extraEks = extraData[1]
      return _.assign(child, {
        //Conservative version ... We might want to be more aggressive with the deduplication of keys
        delegations: _.assignWith(child.delegations, extraDels.delegations, (dest, src) =>
          (src || []).concat(
            _.filter(
              dest,
              (d: DelegationDto) =>
                !src.some(
                  (s: DelegationDto) => s.owner === d.owner && s.delegatedTo === d.delegatedTo
                )
            )
          )
        ),
        cryptedForeignKeys: _.assignWith(
          child.cryptedForeignKeys,
          extraDels.cryptedForeignKeys,
          (dest, src) =>
            (src || []).concat(
              _.filter(
                dest,
                (d: DelegationDto) =>
                  !src.some(
                    (s: DelegationDto) => s.owner === d.owner && s.delegatedTo === d.delegatedTo
                  )
              )
            )
        ),
        encryptionKeys: _.assignWith(child.encryptionKeys, extraEks.encryptionKeys, (dest, src) =>
          (src || []).concat(
            _.filter(
              dest,
              (d: DelegationDto) =>
                !src.some(
                  (s: DelegationDto) => s.owner === d.owner && s.delegatedTo === d.delegatedTo
                )
            )
          )
        )
      })
    })
  }

  /**
   * Walk up the hierarchy of hcps and extract matching delegations
   * @param document
   * @param hcpartyId
   */
  extractDelegationsSFKs(
    document:
      | models.PatientDto
      | models.MessageDto
      | models.ContactDto
      | models.DocumentDto
      | models.InvoiceDto
      | models.HealthElementDto
      | models.ReceiptDto
      | models.ClassificationDto
      | null,
    hcpartyId: string
  ): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    if (!document) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    const dels = document.delegations
    if (!dels || !Object.keys(dels).length) {
      return this.getHealthcareParty(hcpartyId).then(hcp => {
        if (hcp.parentId) {
          console.log(
            `No delegation in document (${document.id}) for ${hcpartyId}, trying parent ${
              hcp.parentId
            }`
          )
          return this.extractDelegationsSFKs(document, hcp.parentId)
        } else {
          console.log(`There is no delegation in document (${document.id})`)
          return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
        }
      })
    } else {
      return this.extractSfks(hcpartyId, document.id!, dels)
    }
  }

  /**
   * Walk up the hierarchy of hcps and extract matching cryptedFKs
   * @param document
   * @param hcpartyId
   */
  // noinspection JSUnusedGlobalSymbols
  extractCryptedFKs(
    document:
      | models.PatientDto
      | models.MessageDto
      | models.ContactDto
      | models.DocumentDto
      | models.InvoiceDto
      | models.HealthElementDto
      | models.ReceiptDto
      | models.ClassificationDto
      | null,
    hcpartyId: string
  ): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    if (!document || !document.cryptedForeignKeys) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    const cfks = document.cryptedForeignKeys
    if (!cfks || !Object.keys(cfks).length) {
      return this.getHealthcareParty(hcpartyId).then(hcp => {
        if (hcp.parentId) {
          console.log(
            `No cryptedForeignKeys in document (${document.id}) for ${hcpartyId}, trying parent ${
              hcp.parentId
            }`
          )
          return this.extractCryptedFKs(document, hcp.parentId)
        } else {
          console.log(`There is no cryptedForeignKeys in document (${document.id})`)
          return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
        }
      })
    } else {
      return this.extractSfks(hcpartyId, document.id!, cfks)
    }
  }

  /**
   * Walk up the hierarchy of hcps and extract matching encryption keys
   * @param document
   * @param hcpartyId
   */
  extractEncryptionsSKs(
    document:
      | models.PatientDto
      | models.MessageDto
      | models.ContactDto
      | models.DocumentDto
      | models.InvoiceDto
      | models.ReceiptDto
      | models.HealthElementDto
      | models.ClassificationDto,
    hcpartyId: string
  ): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    if (!document.encryptionKeys) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    const eks = document.encryptionKeys
    if (!eks || !Object.keys(eks).length) {
      return this.getHealthcareParty(hcpartyId).then(hcp => {
        if (hcp.parentId) {
          console.log(
            `No encryption key in document (${document.id}) for ${hcpartyId}, trying parent ${
              hcp.parentId
            }`
          )
          return this.extractEncryptionsSKs(document, hcp.parentId)
        } else {
          console.log(`There is no encryption key in document (${document.id})`)
          return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
        }
      })
    } else {
      return this.extractSfks(hcpartyId, document.id!, eks)
    }
  }

  extractSfks(
    hcpartyId: string,
    objectId: string,
    delegations: { [key: string]: Array<models.DelegationDto> }
  ): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    return this.getHealthcareParty(hcpartyId).then(hcp =>
      this.decryptAndImportAesHcPartyKeysInDelegations(hcpartyId, delegations, false)
        .then(decryptedAndImportedAesHcPartyKeys => {
          var collatedAesKeys: { [key: string]: CryptoKey } = {}
          decryptedAndImportedAesHcPartyKeys.forEach(k => (collatedAesKeys[k.delegatorId] = k.key))
          return this.decryptDelegationsSFKs(delegations[hcpartyId], collatedAesKeys, objectId!)
        })
        .then(
          extractedKeys =>
            hcp.parentId
              ? this.extractSfks(hcp.parentId, objectId, delegations).then(parentResponse =>
                  _.assign(parentResponse, {
                    extractedKeys: parentResponse.extractedKeys.concat(extractedKeys)
                  })
                )
              : { extractedKeys: extractedKeys, hcpartyId: hcpartyId }
        )
    )
  }

  decryptDelegationsSFKs(
    delegationsArray: Array<models.DelegationDto>,
    aesKeys: any,
    masterId: string
  ): Promise<Array<string>> {
    const decryptPromises: Array<Promise<string>> = []
    for (var i = 0; i < (delegationsArray || []).length; i++) {
      var delegation = delegationsArray[i]

      decryptPromises.push(
        this.AES.decrypt(aesKeys[delegation.owner!!], this.utils.hex2ua(delegation.key!!)).then(
          (result: ArrayBuffer) => {
            var results = utils.ua2text(result).split(":")
            // results[0]: must be the ID of the object, for checksum
            // results[1]: secretForeignKey
            if (results[0] !== masterId) {
              console.log(
                "Cryptographic mistake: patient ID is not equal to the concatenated id in SecretForeignKey, this may happen when patients have been merged"
              )
            }

            return results[1]
          }
        )
      )
    }

    return Promise.all(decryptPromises)
  }

  loadKeyPairsAsTextInBrowserLocalStorage(healthcarePartyId: string, privateKey: Uint8Array) {
    return this.hcpartyBaseApi
      .getPublicKey(healthcarePartyId)
      .then((publicKey: models.PublicKeyDto) => {
        return this.RSA.importKeyPair(
          "jwk",
          this.utils.pkcs8ToJwk(privateKey),
          "jwk",
          utils.spkiToJwk(utils.hex2ua(publicKey.hexString!))
        )
      })
      .then((keyPair: { publicKey: CryptoKey; privateKey: CryptoKey }) => {
        this.RSA.rsaKeyPairs[healthcarePartyId] = keyPair
        return this.RSA.exportKeys(keyPair, "jwk", "jwk")
      })
      .then(exportedKeyPair => {
        return this.RSA.storeKeyPair(healthcarePartyId, exportedKeyPair)
      })
  }

  // noinspection JSUnusedGlobalSymbols
  loadKeyPairsAsJwkInBrowserLocalStorage(healthcarePartyId: string, privKey: JsonWebKey) {
    return this.hcpartyBaseApi
      .getPublicKey(healthcarePartyId)
      .then((publicKey: models.PublicKeyDto) => {
        const pubKey = utils.spkiToJwk(utils.hex2ua(publicKey.hexString!))

        privKey.n = pubKey.n
        privKey.e = pubKey.e

        return this.RSA.importKeyPair("jwk", privKey, "jwk", pubKey)
      })
      .then((keyPair: { publicKey: CryptoKey; privateKey: CryptoKey }) => {
        this.RSA.rsaKeyPairs[healthcarePartyId] = keyPair
        return this.RSA.exportKeys(keyPair, "jwk", "jwk")
      })
      .then((exportedKeyPair: { publicKey: any; privateKey: any }) => {
        return this.RSA.storeKeyPair(healthcarePartyId, exportedKeyPair)
      })
  }

  // noinspection JSUnusedGlobalSymbols
  loadKeyPairsInBrowserLocalStorage(healthcarePartyId: string, file: Blob) {
    const fr = new FileReader()
    return new Promise((resolve: (() => void), reject) => {
      fr.onerror = reject
      fr.onabort = reject
      fr.onload = (e: any) => {
        //TODO remove any
        const privateKey = e.target.result as string
        this.loadKeyPairsAsTextInBrowserLocalStorage(healthcarePartyId, utils.hex2ua(privateKey))
          .then(resolve)
          .catch(reject)
      }
      fr.readAsText(file)
    })
  }

  // noinspection JSUnusedGlobalSymbols
  saveKeychainInBrowserLocalStorage(id: string, keychain: number) {
    localStorage.setItem(
      this.keychainLocalStoreIdPrefix + id,
      btoa(new Uint8Array(keychain).reduce((data, byte) => data + String.fromCharCode(byte), ""))
    )
  }

  // noinspection JSUnusedGlobalSymbols
  loadKeychainFromBrowserLocalStorage(id: String) {
    const lsItem = localStorage.getItem("org.taktik.icure.ehealth.keychain." + id)
    return lsItem !== null ? this.utils.base64toByteArray(lsItem) : null
  }

  generateKeyForDelegate(ownerId: string, delegateId: string) {
    return Promise.all([
      this.getHealthcareParty(ownerId),
      this.getHealthcareParty(delegateId)
    ]).then(
      ([owner, delegate]) =>
        delegate.publicKey
          ? this.AES.generateCryptoKey(true)
              .then(AESKey => {
                const ownerPubKey = utils.spkiToJwk(utils.hex2ua(owner.publicKey!))
                const delegatePubKey = utils.spkiToJwk(utils.hex2ua(delegate.publicKey!))

                return Promise.all([
                  this.RSA.importKey("jwk", ownerPubKey, ["encrypt"]),
                  this.RSA.importKey("jwk", delegatePubKey, ["encrypt"])
                ]).then(([ownerImportedKey, delegateImportedKey]) =>
                  Promise.all([
                    this.RSA.encrypt(ownerImportedKey, this.utils.hex2ua(AESKey as string)),
                    this.RSA.encrypt(delegateImportedKey, this.utils.hex2ua(AESKey as string))
                  ])
                )
              })
              .then(
                ([ownerKey, delegateKey]) =>
                  (owner.hcPartyKeys![delegateId] = [
                    this.utils.ua2hex(ownerKey),
                    this.utils.ua2hex(delegateKey)
                  ])
              )
              .then(() =>
                this.hcpartyBaseApi.modifyHealthcareParty(owner).then(hcp => {
                  this.emptyHcpCache(hcp.id)
                  return hcp
                })
              )
          : Promise.reject(new Error(`Missing public key for delegate ${delegateId}`))
    )
  }

  // noinspection JSUnusedGlobalSymbols
  checkPrivateKeyValidity(hcp: models.HealthcarePartyDto): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this.RSA.importKey("jwk", utils.spkiToJwk(utils.hex2ua(hcp.publicKey!)), ["encrypt"])
        .then(k => this.RSA.encrypt(k, this.utils.utf82ua("shibboleth")))
        .then(cipher => {
          const kp = this.RSA.loadKeyPairNotImported(hcp.id!)
          return this.RSA.importKeyPair("jwk", kp.privateKey, "jwk", kp.publicKey).then(ikp =>
            this.RSA.decrypt(ikp.privateKey, new Uint8Array(cipher))
          )
        })
        .then(plainText => {
          const pt = this.utils.ua2utf8(plainText)
          console.log(pt)
          resolve(pt === "shibboleth")
        })
        .catch(() => resolve(false))
    })
  }
}
