import { Code } from '../../icc-api/model/Code'
import { sortBy } from './collection-utils'

export interface CodeChapter {
  code: string
  descr: any
  subCodes: string[]
}

/**
 * Groups a list of ICD-10 codes by their corresponding ICD-10 chapter.
 * @param listOfCodes an array of ICD-10 code strings to classify into chapters.
 * @param icd10Data the ICD-10 chapter range data (keys like 'A00-B99', values are description objects).
 * @return a sorted array of chapter objects, each containing a code, description, and list of matching sub-codes.
 */
export function icdChapters(listOfCodes: string[], icd10Data: { [range: string]: any }): CodeChapter[] {
  return sortBy(
    Object.values(
      listOfCodes.reduce((acc: { [key: string]: CodeChapter }, code) => {
        const match = Object.entries(icd10Data).find(([k]) => {
          const parts = k.split(/-/)
          return code.substring(0, 3) >= parts[0] && code.substring(0, 3) <= parts[1]
        })
        if (!match) return acc
        const shortKey = match[0].substring(0, 2)
        ;(acc[shortKey] || (acc[shortKey] = { code: shortKey, descr: match[1], subCodes: [] })).subCodes.push(code)
        return acc
      }, {})
    ),
    (c) => c.code
  )
}

/**
 * Groups a list of ICPC-2 codes by their corresponding ICPC-2 chapter.
 * @param listOfCodes an array of ICPC-2 code strings to classify into chapters.
 * @param icpc2Data the ICPC-2 chapter data (keys are single letters, values are description objects).
 * @return a sorted array of chapter objects, each containing a code, description, and list of matching sub-codes.
 */
export function icpcChapters(listOfCodes: string[], icpc2Data: { [letter: string]: any }): CodeChapter[] {
  return sortBy(
    Object.values(
      listOfCodes.reduce((acc: { [key: string]: CodeChapter }, code) => {
        const match = Object.entries(icpc2Data).find(([k]) => k === code.substring(0, 1).toUpperCase())
        if (!match) return acc
        const shortKey = match[0]
        ;(acc[shortKey] || (acc[shortKey] = { code: shortKey, descr: match[1], subCodes: [] })).subCodes.push(code)
        return acc
      }, {})
    ),
    (c) => c.code
  )
}

/**
 * Normalizes the code's four main fields (type, code, version and id). The first three are considered to be
 * authoritative, while the id is a pure function of them. The authoritative fields are filled in from the id if
 * missing, or the version is set to '1' if it is the only missing authoritative field. The id is then rederived from
 * the three fields.
 * @param code The code to normalize.
 * @returns A shallow copy of the input with its type, code, version and id normalized.
 */
export function normalizeCode(code: Code): Code {
  code = { ...code }

  if (code.type && code.code && code.version) {
    // do nothing, we all have the authoritative fields we need
  } else if (code.id) {
    // reconstruct the authoritative fields from the id
    const [idType, idCode, idVersion, ...idRest] = code.id.split('|')
    if (idType && idCode && idVersion && idRest.length === 0) {
      if (!code.type) code.type = idType
      if (!code.code) code.code = idCode
      if (!code.version) code.version = idVersion
    } else {
      throw new Error(`attempted to normalize from a malformed code id "${code.id}"`)
    }
  } else if (code.type && code.code && !code.version) {
    // we can provide a default value
    code.version = '1'
  } else {
    throw new Error('could not reconstruct the code')
  }

  // Recompute the id to ensure that it matches the reconstructed code.
  code.id = `${code.type}|${code.code}|${code.version}`

  return code
}
