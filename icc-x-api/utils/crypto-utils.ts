import * as mm from 'moment'
import { Moment } from 'moment'
import * as _ from 'lodash'
import { a2b, b2a, b64Url2ua, hex2ua, string2ua, ua2b64Url, ua2hex, ua2string } from '../utils/binary-utils'
import { pack } from './asn1-packer'
import { parseAsn1 } from './asn1-parser'
import { KeyPair } from '../crypto/RSA'

export function notConcurrent<T>(concurrencyMap: { [key: string]: PromiseLike<any> }, key: string, proc: () => PromiseLike<T>): PromiseLike<T> {
  const inFlight = concurrencyMap[key]
  if (!inFlight) {
    const newJob = (async () => {
      try {
        return await proc()
      } finally {
        delete concurrencyMap[key]
      }
    })()
    concurrencyMap[key] = newJob
    return newJob
  } else {
    return concurrencyMap[key].then(() => notConcurrent(concurrencyMap, key, proc))
  }
}

export function jwk2pkcs8(jwk: any): string {
  return pack([
    0x30,
    [
      [0x02, '00'],
      [0x30, [[0x06, '2a864886f70d010101'], [0x05]]], // pragma: allowlist secret
      [
        0x04,
        [
          [
            0x30,
            [
              [0x02, '00'],
              [0x02, ua2hex(b64Url2ua(jwk.n))],
              [0x02, ua2hex(b64Url2ua(jwk.e))],
              [0x02, ua2hex(b64Url2ua(jwk.d))],
              [0x02, ua2hex(b64Url2ua(jwk.p))],
              [0x02, ua2hex(b64Url2ua(jwk.q))],
              [0x02, ua2hex(b64Url2ua(jwk.dp))],
              [0x02, ua2hex(b64Url2ua(jwk.dq))],
              [0x02, ua2hex(b64Url2ua(jwk.qi))],
            ],
          ],
        ],
      ],
    ],
  ])
}

export function jwk2spki(jwk: any): string {
  return pack([
    0x30,
    [
      [0x30, [[0x06, '2a864886f70d010101'], [0x05]]], // pragma: allowlist secret
      [
        0x03,
        [
          [
            0x30,
            [
              [0x02, ua2hex(b64Url2ua(jwk.n))],
              [0x02, ua2hex(b64Url2ua(jwk.e))],
            ],
          ],
        ],
      ],
    ],
  ])
}

export function spkiToJwk(buf: Uint8Array): { kty: string; alg: string; n: string; e: string; ext: boolean } {
  const asn1 = parseAsn1(new Uint8Array(buf))

  var modulus: Uint8Array | undefined = undefined
  var exponent: Uint8Array | undefined = undefined
  if (
    asn1.type === 0x30 &&
    asn1.children?.[0]?.type === 0x30 &&
    asn1.children?.[0]?.children?.[0]?.type === 0x06 &&
    ua2hex(asn1.children?.[0]?.children?.[0]?.value ?? new Uint8Array(0)) === '2a864886f70d010101' // pragma: allowlist secret
  ) {
    modulus = asn1.children?.[1]?.children?.[0]?.children?.[0]?.value
    exponent = asn1.children?.[1]?.children?.[0]?.children?.[1]?.value
  } else if (asn1.type === 0x30 && asn1.children?.[0]?.type === 0x02 && asn1.children?.[1]?.type === 0x02) {
    modulus = asn1.children?.[0]?.value
    exponent = asn1.children?.[1]?.value
  }

  if (!modulus || !exponent) {
    throw new Error('Invalid spki format')
  }
  return {
    kty: 'RSA',
    alg: 'RSA-OAEP',
    ext: true,
    n: ua2b64Url(minimalRep(modulus)),
    e: ua2b64Url(minimalRep(exponent)),
  }
}

export function pkcs8ToJwk(buf: Uint8Array | ArrayBuffer) {
  const parsed = parseAsn1(new Uint8Array(buf))
  const seq =
    parsed.children?.length === 3 && parsed.children[2].type === 0x04 && parsed.children[2].children?.length === 1
      ? parsed.children[2].children[0]
      : parsed
  return {
    kty: 'RSA',
    n: ua2b64Url(minimalRep(seq.children![1].value as Uint8Array)),
    e: ua2b64Url(minimalRep(seq.children![2].value as Uint8Array)),
    d: ua2b64Url(minimalRep(seq.children![3].value as Uint8Array)),
    p: ua2b64Url(minimalRep(seq.children![4].value as Uint8Array)),
    q: ua2b64Url(minimalRep(seq.children![5].value as Uint8Array)),
    dp: ua2b64Url(minimalRep(seq.children![6].value as Uint8Array)),
    dq: ua2b64Url(minimalRep(seq.children![7].value as Uint8Array)),
    qi: ua2b64Url(minimalRep(seq.children![8].value as Uint8Array)),
  }
}

function minimalRep(b: Uint8Array) {
  let i = 0
  while (b[i] === 0) {
    i++
  }
  return b.slice(i)
}

/**
 * Provide a view over the given Uint8Array where any trailing null bytes at
 * the end are truncated.
 *
 * This can be used to ignore null bytes at the end of a padded UTF-8 string
 * without needing to copy that string, assuming code point U+0000 is encoded
 * in one null byte according to standards rather than in a multi-byte
 * overlong form.
 */
export function truncateTrailingNulls(a: Uint8Array) {
  let end = a.byteLength - 1
  while (a[end] === 0 && end >= 0) {
    end--
  }
  // end is now either the last non-null position in a or -1; in the latter
  // case the returned array will have length 0.
  return a.subarray(0, end + 1)
}

/**
 *
 * @param buffer1 {Uint8Array}
 * @param buffer2{ Uint8Array}
 * @returns {ArrayBuffer}
 */
export function appendBuffer(buffer1: ArrayBuffer, buffer2: ArrayBuffer): ArrayBuffer {
  const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength)
  tmp.set(new Uint8Array(buffer1), 0)
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength)
  return tmp.buffer as ArrayBuffer
}

//Convenience methods for dates management
export function after(d1: number | null | undefined, d2: number | null | undefined): boolean {
  return d1 === null || d2 === null || d1 === undefined || d2 === undefined || moment(d1)!.isAfter(moment(d2)!)
}

export function before(d1: number | null | undefined, d2: number | null | undefined): boolean {
  return d1 === null || d2 === null || d1 === undefined || d2 === undefined || moment(d1)!.isBefore(moment(d2)!)
}

function moment(epochOrLongCalendar: number): Moment | null {
  if (!epochOrLongCalendar && epochOrLongCalendar !== 0) {
    return null
  }
  if (epochOrLongCalendar >= 18000101 && epochOrLongCalendar < 25400000) {
    return mm('' + epochOrLongCalendar, 'YYYYMMDD')
  } else if (epochOrLongCalendar >= 18000101000000) {
    return mm('' + epochOrLongCalendar, 'YYYYMMDDHHmmss')
  } else {
    return mm(epochOrLongCalendar)
  }
}

/**
 * Configuration for the encryption of an object.
 * @param topLevelFields the fields of the object to encrypt. All the fields will be encrypted in a single encryptedSelf field which is added to the
 * object.
 * @param nestedObjectsKeys the name of fields which are expected to contain a nested object (or undefined). Allows to specify
 */
export type EncryptedFieldsManifest = {
  topLevelFields: { fieldName: string; fieldPath: string }[]
  nestedObjectsKeys: {
    [objectFieldName: string]: EncryptedFieldsManifest
  }
  mapsValuesKeys: {
    [mapFieldName: string]: EncryptedFieldsManifest
  }
  arraysValuesKeys: {
    [arrayFieldName: string]: EncryptedFieldsManifest
  }
}

/**
 * @internal this function is for internal use only and may be changed without notice
 *
 * Parse the encrypted fields configuration for a specific entity type.
 *
 * ## Grammar
 *
 * The grammar for each encrypted field is the following:
 * ```
 * fieldName :=
 *   regex([a-zA-Z_][a-zA-Z0-9_]+)
 * encryptedField :=
 *   fieldName
 *   | fieldName + ("." | ".*." | "[].") + encryptedField
 * ```
 *
 * This grammar allows you to specify the fields to encrypt for the object and recursively for nested objects.
 * - A string containing only a single `fieldName` will encrypt the field with the given name.
 * - A string starting with `fieldName.` allows to specify the encrypted fields of a nested object. The encrypted values of the
 *   fields in the nested object will be saved in the nested object.
 * - A string starting with `fieldName.*.` treats `fieldName` as a map/dictionary data structure and allows to specify the encrypted fields of the
 *   values of the map. Note that the values of the map must be objects as well. The encrypted content of each map value is stored in that value.
 * - A string starting with `fieldName[].` treats `fieldName` as an array and allows to specify the encrypted fields of the values of the array.
 *   Note that the values of the array must be objects as well. The encrypted content of each array element is stored in that element.
 *
 * ## Example
 *
 * Consider the following object and encryption keys:
 * ```javascript
 * const obj = {
 *   a: { x: 0, y: 1 },
 *   b: "hello",
 *   c: [ { public: "a", secret: "b" }, { public: "c", secret: "d" } ],
 *   d: "ok",
 *   e: {
 *     info: "something",
 *     private: "secret",
 *     dataMap: {
 *       "en": {
 *         a: 1,
 *         b: 2
 *       },
 *       "fr": {
 *         a: 3,
 *         b: 4
 *       }
 *     }
 *   }
 * }
 * const encryptedFields = [
 *   "a",
 *   "c[].secret",
 *   "d",
 *   "e.private",
 *   "e.datamap.*.a"
 * ]
 * ```
 * If you use them with the crypt method you will get the following result:
 * ```json
 * {
 *   b: "hello",
 *   c: [
 *     { public: "a", encryptedSelf: "...encrypted data of c[0]" },
 *     { public: "c", encryptedSelf: "...encrypted data of c[1]" }
 *   ],
 *   e: {
 *     info: "something",
 *     dataMap: {
 *       "en": { b: 2, encryptedSelf: "...encrypted data of e.dataMap['en']" },
 *       "fr": { b: 4, encryptedSelf: "...encrypted data of e.dataMap['fr']" }
 *     },
 *     encryptedSelf: "...encrypted data of e"
 *   },
 *   encryptedSelf: "...encrypted data of obj"
 * }
 * ```
 *
 * ## Shortened representation
 *
 * You can also group encrypted fields having the same prefix by concatenating to the prefix the JSON representation of an array of all the postfixes.
 * For example the following encrypted fields:
 * ```javascript
 * const encryptedFields = ["a.b.c.d.e.f1", "a.b.c.d.e.f2", "a.b.c.d.e.f3", "a.b.c.d.e.f4"]
 * ```
 * can be shortened to
 * ```javascript
 * const encryptedFields = ['a.b.c.d.e.["f1","f2","f3","f4"]'] // Note the use of single quotes to avoid escaping the double quotes
 * ```
 * If you use the shortened representation you may need to escape nested json representations. In that case the use of `JSON.stringify` is
 * recommended.
 *
 * @param encryptedFields
 * @param path
 */
export function parseEncryptedFields(encryptedFields: string[], path: string): EncryptedFieldsManifest {
  const groupedData = {
    topLevelFields: new Set<string>(),
    nestedObjectsKeys: {} as { [objectFieldName: string]: string[] },
    mapsValuesKeys: {} as { [mapFieldName: string]: string[] },
    arraysValuesKeys: {} as { [arrayFieldName: string]: string[] },
  }
  const encryptedFieldRegex = /^([_a-zA-Z][_a-zA-Z0-9]*)(?:(\.\*\.|\[]\.|\.)(?:[_a-zA-Z].*|\[.*]))?$/
  const addSubkeyToGroupedData = (
    currFieldName: string,
    currFieldSeparator: string,
    currEncryptedField: string,
    groupedDataKey: 'nestedObjectsKeys' | 'mapsValuesKeys' | 'arraysValuesKeys'
  ) => {
    const existingOrNew = groupedData[groupedDataKey][currFieldName] ?? (groupedData[groupedDataKey][currFieldName] = [])
    const subKey = currEncryptedField.slice(currFieldName.length + currFieldSeparator.length)
    if (subKey.startsWith('[')) {
      let parsedJson: any[]
      try {
        parsedJson = JSON.parse(subKey)
      } catch {
        throw new Error(`Invalid encrypted field ${path}${currEncryptedField} (not a valid JSON subkey)`)
      }
      if (Array.isArray(parsedJson) && parsedJson.every((x) => typeof x == 'string')) {
        parsedJson.forEach((x) => existingOrNew.push(x))
      } else throw new Error(`Invalid encrypted field ${path}${currEncryptedField} (not an array of strings)`)
    } else {
      existingOrNew.push(subKey)
    }
  }
  for (const currEncryptedField of encryptedFields) {
    const currFieldMatch = currEncryptedField.match(encryptedFieldRegex)
    if (!!currFieldMatch) {
      const currFieldName = currFieldMatch[1]
      const currFieldSeparator = currFieldMatch[2]
      if (!currFieldSeparator) {
        if (groupedData.topLevelFields.has(currFieldName)) throw new Error(`Duplicate encrypted field ${path}${currFieldName}`)
        if (
          !!groupedData.nestedObjectsKeys[currFieldName] ||
          !!groupedData.mapsValuesKeys[currFieldName] ||
          !!groupedData.arraysValuesKeys[currFieldName]
        )
          throw new Error(`Encrypted field appears multiple times as different nested types and or top-level-field: ${path}${currFieldName}`)
        groupedData.topLevelFields.add(currFieldName)
      } else if (currFieldSeparator == '.') {
        if (
          groupedData.topLevelFields.has(currFieldName) ||
          !!groupedData.mapsValuesKeys[currFieldName] ||
          !!groupedData.arraysValuesKeys[currFieldName]
        )
          throw new Error(`Encrypted field appears multiple times as different nested types and or top-level-field: ${path}${currFieldName}`)
        addSubkeyToGroupedData(currFieldName, currFieldSeparator, currEncryptedField, 'nestedObjectsKeys')
      } else if (currFieldSeparator == '.*.') {
        if (
          groupedData.topLevelFields.has(currFieldName) ||
          !!groupedData.nestedObjectsKeys[currFieldName] ||
          !!groupedData.arraysValuesKeys[currFieldName]
        )
          throw new Error(`Encrypted field appears multiple times as different nested types and or top-level-field: ${path}${currFieldName}`)
        addSubkeyToGroupedData(currFieldName, currFieldSeparator, currEncryptedField, 'mapsValuesKeys')
      } else if (currFieldSeparator == '[].') {
        if (
          groupedData.topLevelFields.has(currFieldName) ||
          !!groupedData.nestedObjectsKeys[currFieldName] ||
          !!groupedData.mapsValuesKeys[currFieldName]
        )
          throw new Error(`Encrypted field appears multiple times as different nested types and or top-level-field: ${path}${currFieldName}`)
        addSubkeyToGroupedData(currFieldName, currFieldSeparator, currEncryptedField, 'arraysValuesKeys')
      } else throw new Error(`Internal error: unknown separator ${currFieldSeparator} passed regex validation in ${path}${currEncryptedField}`)
    } else throw new Error(`Invalid encrypted field ${path}${currEncryptedField}`)
  }
  return {
    topLevelFields: Array.from(groupedData.topLevelFields).map((fieldName) => ({ fieldName, fieldPath: path + fieldName })),
    nestedObjectsKeys: Object.fromEntries(
      Object.entries(groupedData.nestedObjectsKeys).map(([fieldName, fieldNames]) => [
        fieldName,
        parseEncryptedFields(fieldNames, path + fieldName + '.'),
      ])
    ),
    mapsValuesKeys: Object.fromEntries(
      Object.entries(groupedData.mapsValuesKeys).map(([fieldName, fieldNames]) => [
        fieldName,
        parseEncryptedFields(fieldNames, path + fieldName + '.*.'),
      ])
    ),
    arraysValuesKeys: Object.fromEntries(
      Object.entries(groupedData.arraysValuesKeys).map(([fieldName, fieldNames]) => [
        fieldName,
        parseEncryptedFields(fieldNames, path + fieldName + '[].'),
      ])
    ),
  }
}

/**
 * @internal this function is for internal use only and may be changed without notice
 * Encrypt the object graph recursively. Generally return an updated SHALLOW copy, although some fields may be deep copied if they also needed to be
 * recursively encrypted.
 * @param obj the object to encrypt
 * @param cryptor takes in input an object consisting only of the fields to encrypt of obj, and returns the encrypted object.
 * @param keys the keys to encrypt for the
 * @param path path of the current object, used for error messages.
 * @return a shallow copy of the object with a new encryptedSelfField and without the encrypted fields.
 */
export async function encryptObject(
  obj: { [key: string]: any },
  cryptor: (obj: { [key: string]: any }) => Promise<ArrayBuffer>,
  keys: EncryptedFieldsManifest,
  path: string = 'obj'
): Promise<{ [key: string]: any }> {
  const shallowClone = { ...obj }
  const currEncryptedFields: { [key: string]: any } = {}
  for (const { fieldName } of keys.topLevelFields) {
    const fieldValue = shallowClone[fieldName]
    if (fieldValue !== undefined) {
      // we keep null values
      currEncryptedFields[fieldName] = fieldValue
      delete shallowClone[fieldName]
    }
  }
  shallowClone['encryptedSelf'] = b2a(ua2string(await cryptor(currEncryptedFields)))
  for (const [fieldName, subKeys] of Object.entries(keys.nestedObjectsKeys)) {
    const fieldValue = shallowClone[fieldName]
    if (fieldValue !== undefined && fieldValue !== null) {
      if (!isPojo(fieldValue)) throw new Error(`Expected field ${path}.${fieldName} to be a non-array object`)
      shallowClone[fieldName] = await encryptObject(fieldValue, cryptor, subKeys, path + '.' + fieldName)
    }
  }
  for (const [mapFieldName, subKeys] of Object.entries(keys.mapsValuesKeys)) {
    const fieldValue = shallowClone[mapFieldName]
    if (fieldValue !== undefined && fieldValue !== null) {
      if (!isPojo(fieldValue)) throw new Error(`Expected field ${path}.${mapFieldName} to be a non-array object`)
      const newMap: { [key: string]: any } = {}
      for (const [key, value] of Object.entries(fieldValue as object)) {
        if (value === null || value === undefined) {
          newMap[key] = value
        } else {
          if (!isPojo(value)) throw new Error(`Expected field ${path}.${mapFieldName}.${key} to be a non-array object`)
          newMap[key] = await encryptObject(value, cryptor, subKeys, path + '.' + mapFieldName + '.' + key)
        }
      }
      shallowClone[mapFieldName] = newMap
    }
  }
  for (const [arrayFieldName, subKeys] of Object.entries(keys.arraysValuesKeys)) {
    const fieldValue = shallowClone[arrayFieldName]
    if (fieldValue !== undefined && fieldValue !== null) {
      if (!Array.isArray(fieldValue)) throw new Error(`Expected field ${path}.${arrayFieldName} to be an array`)
      const newArray: any[] = Array(fieldValue.length)
      for (let i = 0; i < fieldValue.length; i++) {
        const value = fieldValue[i]
        if (value === null || value === undefined) {
          newArray[i] = value
        } else {
          if (!isPojo(value)) throw new Error(`Expected field ${path}.${arrayFieldName}[${i}] to be a non-array object`)
          newArray[i] = await encryptObject(value, cryptor, subKeys, path + '.' + arrayFieldName + '[' + i + ']')
        }
      }
      shallowClone[arrayFieldName] = newArray
    }
  }
  return shallowClone
}

/**
 * Check if value is a non-null object that is not an array.
 */
function isPojo(value: any): boolean {
  // This break if for some reason we have object versions of String/Number/Boolean
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * @internal this function is for internal use only and may be changed without notice
 * Decrypt object graph recursively.
 *
 * @param obj the object to decrypt
 * @param decryptor the decryptor function (returns a promise)
 * @return a deep copy of the object with the decrypted fields and removed encryptedSelf field
 */
export async function decryptObject(
  obj: { [key: string]: any },
  decryptor: (obj: Uint8Array) => Promise<{ [key: string]: any }>
): Promise<{ [key: string]: any }> {
  const copy: { [key: string]: any } = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'encryptedSelf') {
      copy[key] = value
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        // Note: nested arrays (and primitives) are returned as is and not they are not recursively decrypted. This is because we currently do not
        // support encryption of elements from arrays in arrays (we only support arrays in objects in arrays). In future this may change.
        copy[key] = await Promise.all(value.map((v) => (isPojo(v) ? decryptObject(v, decryptor) : v)))
      } else {
        copy[key] = await decryptObject(value, decryptor)
      }
    } else {
      copy[key] = value
    }
  }
  if (obj.encryptedSelf) {
    const decrypted = await decryptor(string2ua(a2b(obj.encryptedSelf)))
    return { ...copy, ...decrypted }
  } else return copy
}

/**
 * Extracts the full jwk key pair from the jwk representation of the private key.
 * @param privateKeyJwk private key in jwk representation
 * @throws if the key is missing the public modulus or public exponent.
 */
export function keyPairFromPrivateKeyJwk(privateKeyJwk: JsonWebKey): KeyPair<JsonWebKey> {
  if (!privateKeyJwk.n || !privateKeyJwk.e) throw new Error('Incomplete private JsonWebKey: missing public modulus and/or exponent')
  return {
    privateKey: privateKeyJwk,
    publicKey: spkiToJwk(hex2ua(jwk2spki(privateKeyJwk))),
  }
}
