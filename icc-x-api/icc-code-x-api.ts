import { IccCodeApi } from '../icc-api'

import codeLanguages from './rsrc/codelng'
import icd10 from './rsrc/icd10'
import icpc2 from './rsrc/icpc2'

import { sortBy } from './utils/collection-utils'
import { Code } from '../icc-api/model/Code'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'

export class IccCodeXApi extends IccCodeApi {
  icd10: any = icd10
  icpc2: any = icpc2
  codeLanguages: any = codeLanguages

  constructor(
    host: string,
    headers: { [key: string]: string },
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
  }

  /**
   * Groups a list of ICD-10 codes by their corresponding ICD-10 chapter.
   * @param listOfCodes an array of ICD-10 code strings to classify into chapters.
   * @return a sorted array of chapter objects, each containing a code, description, and list of matching sub-codes.
   */
  // noinspection JSUnusedGlobalSymbols
  icdChapters(listOfCodes: Array<string>) {
    return Promise.resolve(
      sortBy(
        Object.values(
          Object.entries(
            Object.fromEntries(
              listOfCodes.map((code) => [
                code,
                Object.entries(this.icd10).find(([k]) => {
                  const parts = k.split(/-/)
                  return code.substr(0, 3) >= parts[0] && code.substr(0, 3) <= parts[1]
                }),
              ])
            )
          ).reduce(
            (acc: any, [code, pairOfRangeAndIcdInfo]) => {
              if (!pairOfRangeAndIcdInfo) {
                return acc
              }
              const shortKey = pairOfRangeAndIcdInfo[0].substr(0, 2)
              ;(
                acc[shortKey] ||
                (acc[shortKey] = {
                  code: shortKey,
                  descr: pairOfRangeAndIcdInfo[1],
                  subCodes: [],
                })
              ).subCodes.push(code)
              return acc
            },
            {}
          )
        ),
        (c: any) => c.shortKey
      )
    )
  }

  /**
   * Groups a list of ICPC-2 codes by their corresponding ICPC-2 chapter.
   * @param listOfCodes an array of ICPC-2 code strings to classify into chapters.
   * @return a sorted array of chapter objects, each containing a code, description, and list of matching sub-codes.
   */
  // noinspection JSUnusedGlobalSymbols
  icpcChapters(listOfCodes: Array<string>) {
    return Promise.resolve(
      sortBy(
        Object.values(
          Object.entries(
            Object.fromEntries(listOfCodes.map((code) => [code, Object.entries(this.icpc2).find(([k]) => k === code.substr(0, 1).toUpperCase())]))
          ).reduce(
            (acc: any, [code, pairOfRangeAndIcdInfo]) => {
              if (!pairOfRangeAndIcdInfo) {
                return acc
              }
              const shortKey = pairOfRangeAndIcdInfo[0]
              ;(
                acc[shortKey] ||
                (acc[shortKey] = {
                  code: shortKey,
                  descr: pairOfRangeAndIcdInfo[1],
                  subCodes: [],
                })
              ).subCodes.push(code)
              return acc
            },
            {}
          )
        ),
        (c: any) => c.shortKey
      )
    )
  }

  /**
   * Returns the appropriate language code for a given code type. Falls back to French ('fr') if the
   * requested language is not available for the specified type.
   * @param type the code type to look up available languages for.
   * @param lng the desired language code.
   * @return the requested language code if available, or 'fr' as a fallback.
   */
  // noinspection JSUnusedGlobalSymbols
  languageForType(type: string, lng: string) {
    const availableLanguages = this.codeLanguages[type]
    return availableLanguages && availableLanguages.indexOf(lng) >= 0 ? lng : 'fr'
  }

  /**
   * Normalizes a code, ensuring it has a consistent structure with id, type, code, and version fields.
   * Accepts either a pipe-delimited string (e.g. "type|code|version") or a Code object.
   * @param c a code represented as a pipe-delimited string or a Code object.
   * @return an object with id, type, code, and version fields fully populated.
   */
  // noinspection JSMethodCanBeStatic, JSUnusedGlobalSymbols
  normalize(c: Code | string) {
    return typeof c === 'string'
      ? {
          id: c,
          type: c.split(/\|/)[0],
          code: c.split(/\|/)[1],
          version: c.split(/\|/)[2],
        }
      : (c as Code).type && (c as Code).code && !(c as Code).id
      ? {
          id: (c as Code).type + '|' + (c as Code).code + '|' + ((c as Code).version || '1'),
          type: (c as Code).type,
          code: (c as Code).code,
          version: (c as Code).version || '1',
        }
      : (c as Code).id && (!(c as Code).code || !(c as Code).type || !(c as Code).version)
      ? {
          id: (c as Code).id,
          type: (c as Code).id!.split(/\|/)[0],
          code: (c as Code).id!.split(/\|/)[1],
          version: (c as Code).id!.split(/\|/)[2],
        }
      : {
          id: (c as Code).id!,
          type: (c as Code).type,
          code: (c as Code).code,
          version: (c as Code).version || '1',
        }
  }
}
