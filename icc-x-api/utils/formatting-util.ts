import { parseNumber, formatNumber, ParsedNumber } from 'libphonenumber-js'
import {format as formatDate, parse as parseDate} from 'date-fns'

// TODO: move this to env.js?
const DEFAULT_COUNTRY = 'BE'

export const nihiiRegExp = new RegExp('^(\\d{1})(\\d{5})(\\d{2})(\\d{3})$')
export const ssinRegExp = new RegExp('^(\\d{2})(\\d{2})(\\d{2})(\\d{3})(\\d{2})$')
export const ibanRegExp = new RegExp('^(\\d{4})(\\d{4})(\\d{4})(\\d{4})$')

const patterns = {
  IBAN: (iban: string) => /^BE\d{14}$/.test(iban) && isValidIBAN(iban),
  IBANBE: (iban: string) => /^BE\d{14}$/.test(iban) && isValidIBAN(iban),
}

//http://ht5ifv.serprest.pt/extensions/tools/IBAN/
export function isValidIBAN(iban: string | null | undefined): boolean | undefined {
  if (iban === null || iban === undefined) return undefined
  //This function check if the checksum if correct
  iban = iban.replace(/^(.{4})(.*)$/, '$2$1') //Move the first 4 chars from left to the right
  const fun = (e: string) => (e.charCodeAt(0) - 'A'.charCodeAt(0) + 10).toString()
  iban = iban.replace(/[A-Z]/g, fun) //Convert A-Z to 10-25
  let $sum = 0
  let $ei = 1 //First exponent
  for (let $i = iban.length - 1; $i >= 0; $i--) {
    $sum += $ei * parseInt(iban.charAt($i), 10) //multiply the digit by it's exponent
    $ei = ($ei * 10) % 97 //compute next base 10 exponent  in modulus 97
  }
  return $sum % 97 === 1
}

export function ibanValidate(iban: string | null | undefined): boolean | undefined {
  if (iban === null || iban === undefined) return undefined
  if (iban.startsWith('BE')) {
    return patterns.IBANBE(iban)
  } else {
    return patterns.IBAN(iban)
  }
}

export function ibanFormat(iban: string | null | undefined): string | undefined {
  if (iban === null || iban === undefined) return undefined
  return iban.replace(ibanRegExp, '$1 $2 $3 $4')
}

export function nihiiFormat(nihii: string | null | undefined): string | undefined {
  if (nihii === null || nihii === undefined) return undefined
  return nihii.replace(nihiiRegExp, '$1 $2 $3 $4')
}

export function nihiiValidate(nihii: string | null | undefined): boolean | undefined {
  if (nihii === null || nihii === undefined) return undefined
  return !!nihii.match(nihiiRegExp)
}

export function ssinFormat(ssin: string | null | undefined): string | undefined {
  if (ssin === null || ssin === undefined) return undefined
  return ssin.replace(ssinRegExp, '$1 $2 $3 $4 $5')
}

export function ssinValidate(ssin: string | null | undefined): boolean | undefined {
  if (ssin === null || ssin === undefined) return undefined
  return !!ssin.match(ssinRegExp)
}

/* Alternate lib free version
export function phoneNumberValidate(phoneNumber: string): boolean {
  return (
    !!phoneNumber.match(/(?:\+|00)([1-9][0-9]{1-2})([- /.]*([0-9]+))+/) ||
    !!phoneNumber.match(/(0[1-9][0-9]*)([- /.]*([0-9]+))+/)
  )
}

export function phoneNumberFormat(phoneNumber: string): string {
  let match = phoneNumber.match(/(?:\+|00)([1-9][0-9]{1-2})([- /.]*([0-9]+))+/)
  if (match) {
    return `+${match[1]} ${match[2].replace(/[- /.]/g, " ")}`.replace(/  /g, " ")
  }
  match = phoneNumber.match(/0([1-9][0-9]*)([- /.]*([0-9]+))+/)
  if (match) {
    return `+32 ${match[1]} ${match[2].replace(/[- /.]/g, " ")}`.replace(/  /g, " ")
  }
  return phoneNumber
}
*/

export function phoneNumberFormat(phoneNumber: string | null | undefined): string | undefined {
  if (phoneNumber === null || phoneNumber === undefined) return undefined
  const parsedPhoneNumber = parseNumber(phoneNumber, DEFAULT_COUNTRY) as ParsedNumber
  if (Object.keys(parsedPhoneNumber).length === 0) {
    // The number is not valid, so we leave the input string as-is.
    return phoneNumber
  }
  return formatNumber(parsedPhoneNumber, 'INTERNATIONAL')
}

/**
 * Converts a backend date number (e.g., patient birth date) into a Date object.
 * @param dateNumber a YYYYMMDD date number from the backend
 * @return a Date object
 * @throws Error if it is impossible to create a date from the number, other if dateNumber is negative.
 * @see #dateEncode
 * @see #timeDecode
 */
export function dateDecode(dateNumber: number | null | undefined): Date | undefined {
  if (dateNumber === null || dateNumber === undefined) return undefined

  if (dateNumber < 0) {
    throw new Error("We don't decode negative dates. Please make sure you have valid data.")
  }
  const dateNumberStr: string = dateNumber.toString().padStart(8, '19700101')
  if (dateNumberStr.length > 8) {
    if (dateNumberStr.endsWith('000000')) {
      return dateNumber ? parseDate(dateNumberStr.slice(0, 8), 'yyyyMMdd', new Date()) : undefined
    }

    throw Error("Decoded date is over year 9999. We can't format it properly.")
  }
  return dateNumber ? parseDate(dateNumberStr, 'yyyyMMdd', new Date()) : undefined
}

/**
 * Converts a backend time number (e.g., health element openingDate) into a Date object.
 * @param timeNumber a YYYYMMDD date number from the backend
 * @return a Date object
 * @see #timeEncode
 * @see #dateDecode
 */
export function timeDecode(timeNumber: number | null | undefined): Date | undefined {
  if (timeNumber === null || timeNumber === undefined) return undefined
  return timeNumber ? parseDate(timeNumber.toString(), 'yyyyMMddHHmmss', new Date()) : undefined
}

/**
 * Encodes a Date object into a backend date number (e.g., patient birth date).
 *
 * A Date is formatted as usual. A String or a Number is interpreted as a fuzzy date that is already
 * encoded (yyyyMMdd or yyyyMMddHHmmss) or as an epoch expressed in milliseconds.
 * @param date a Date object, or a fuzzy date / epoch as a String or Number
 * @return a YYYYMMDD date number for the backend
 * @see #dateDecode
 * @see #timeEncode
 */
export function dateEncode(date?: Date | Number | String | null | undefined): number | undefined {
  if (date === null || date === undefined) { return undefined }
  if (typeof date === 'string' && date.trim() === '') return undefined
  if (date instanceof Date) {
    // date is null if the field is not set
    return date ? Number(formatDate(date, 'yyyyMMdd').padStart(8, '19700101')) : undefined
  }
  // A String or a Number is a fuzzy date (yyyyMMdd, yyyyMMddHHmmss) or an epoch in milliseconds
  const fuzzy = Number(date)
  if (!fuzzy || isNaN(fuzzy)) return undefined
  if (fuzzy >= 18000101 && fuzzy < 25400000) {
    // already a yyyyMMdd fuzzy date
    return fuzzy
  }
  if (fuzzy >= 18000101000000) {
    // a yyyyMMddHHmmss fuzzy date: keep only the date part
    return Math.floor(fuzzy / 1000000)
  }
  // an epoch expressed in milliseconds
  return Number(formatDate(new Date(fuzzy), 'yyyyMMdd'))
}

/**
 * Encodes a Date object into a backend time number (e.g., health element openingDate).
 *
 * A Date is formatted as usual. A String or a Number is interpreted as a fuzzy date that is already
 * encoded (yyyyMMdd or yyyyMMddHHmmss) or as an epoch expressed in milliseconds.
 * @param date a Date object, or a fuzzy date / epoch as a String or Number
 * @return a YYYYMMDDHHmmss date number for the backend
 * @see #timeDecode
 * @see #dateEncode
 */
export function timeEncode(date: Date | Number | String | null | undefined): number | undefined {
  if (date === null || date === undefined) return undefined
  if (typeof date === 'string' && date.trim() === '') return undefined
  if (date instanceof Date) {
    return date ? Number(formatDate(date, 'yyyyMMddHHmmss')) : undefined
  }
  // A String or a Number is a fuzzy date (yyyyMMdd, yyyyMMddHHmmss) or an epoch in milliseconds
  const fuzzy = Number(date)
  if (!fuzzy || isNaN(fuzzy)) return undefined
  if (fuzzy >= 18000101 && fuzzy < 25400000) {
    // a yyyyMMdd fuzzy date: pad the time part with zeroes
    return fuzzy * 1000000
  }
  if (fuzzy >= 18000101000000) {
    // already a yyyyMMddHHmmss fuzzy date
    return fuzzy
  }
  // an epoch expressed in milliseconds
  return Number(formatDate(new Date(fuzzy), 'yyyyMMddHHmmss'))
}

/**
 * Formats a value and a physical unit into text.
 * @param value the numerical or string value to encode
 * @param unit the unit represented as a string (an empty string is also supported)
 */
export function unit(value: number | string | null | undefined, unit: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined
  unit = unit || ''
  let separator: string
  if (!unit || unit.startsWith('°')) {
    separator = ''
  } else {
    // including '%'
    separator = '\xa0'
  }
  return value + separator + unit
}

/**
 * 0.1 + 0.2 = 0.30000000000000004. Use this function to be better at maths.
 * @param value number
 * @return the rounded number, two after the comma
 */
export function amount(value: number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined
  return Number(value.toFixed(2))
}

/**
 * A simple formatter to keep the logic across the app.
 * Input: 2.1 ; Output: 2.10€
 */
export function money(value: number | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined
  return [value.toFixed(2), '€'].join('')
}

/**
 * Transform a dictionary to a url params.
 * From { key1: value1, key2: value2, ... } returns key1=value1&key2=value2&...=...
 */
export function toUrlParams(params: { [key: string]: string } | null | undefined): string | undefined {
  if (params === null || params === undefined) return undefined
  return Object.entries(params)
    .map(([key, value]) => (value ? key + '=' + value : undefined))
    .filter(Boolean)
    .join('&')
}

export function personName(person: { firstName?: string; lastName?: string } | null | undefined): string | undefined {
  if (person === null || person === undefined) return undefined
  return `${person.firstName || ''} ${person.lastName || ''}`.trim()
}

export function personNameAbbrev(person: { firstName?: string; lastName?: string } | null | undefined): string | undefined {
  if (person === null || person === undefined) return undefined
  const firstName = person.firstName ? person.firstName[0] + '.' : undefined
  return personName({...person, firstName})
}

// Moment.js → date-fns format token mapping. Listed longest-first so the
// matcher consumes the longest valid moment token at each position.
const MOMENT_TO_DATE_FNS_TOKENS: ReadonlyArray<readonly [string, string]> = [
  // Year
  ['YYYY', 'yyyy'],
  ['YY', 'yy'],
  ['Y', 'y'],
  // Month
  ['MMMM', 'MMMM'],
  ['MMM', 'MMM'],
  ['Mo', 'Mo'],
  ['MM', 'MM'],
  ['M', 'M'],
  // Quarter
  ['Qo', 'Qo'],
  ['Q', 'Q'],
  // Day of year (moment DDD/DDDD/DDDo → date-fns D/DDD/Do, additional tokens)
  ['DDDDo', 'Do'],
  ['DDDD', 'DDD'],
  ['DDDo', 'Do'],
  ['DDD', 'D'],
  // Day of month
  ['Do', 'do'],
  ['DD', 'dd'],
  ['D', 'd'],
  // Day of week
  ['dddd', 'EEEE'],
  ['ddd', 'EEE'],
  ['dd', 'EEEEEE'],
  ['do', 'eo'],
  ['d', 'e'],
  ['E', 'i'],
  // Week of year
  ['ww', 'ww'],
  ['wo', 'wo'],
  ['w', 'w'],
  ['WW', 'II'],
  ['Wo', 'Io'],
  ['W', 'I'],
  // Hour
  ['HH', 'HH'],
  ['H', 'H'],
  ['hh', 'hh'],
  ['h', 'h'],
  ['kk', 'kk'],
  ['k', 'k'],
  // AM/PM
  ['A', 'a'],
  ['a', 'aaa'],
  // Minute
  ['mm', 'mm'],
  ['m', 'm'],
  // Second
  ['ss', 'ss'],
  ['s', 's'],
  // Fractional seconds
  ['SSSS', 'SSSS'],
  ['SSS', 'SSS'],
  ['SS', 'SS'],
  ['S', 'S'],
  // Timezone offset
  ['ZZ', 'xx'],
  ['Z', 'xxx'],
  // Unix timestamp
  ['X', 't'],
  ['x', 'T'],
]

export function momentFormatToDateFnsFormat(format: string | null | undefined): string | undefined {
  if (format === null || format === undefined) return undefined
  const parts: string[] = []
  let literalBuffer = ''

  const flushLiteral = () => {
    if (literalBuffer.length > 0) {
      parts.push("'" + literalBuffer.replace(/'/g, "''") + "'")
      literalBuffer = ''
    }
  }

  let i = 0
  while (i < format.length) {
    const c = format[i]

    // Moment bracketed literal: [text] → date-fns 'text'
    if (c === '[') {
      const end = format.indexOf(']', i)
      if (end === -1) {
        literalBuffer += format.substring(i + 1)
        i = format.length
        continue
      }
      literalBuffer += format.substring(i + 1, end)
      i = end + 1
      continue
    }

    // Match the longest moment token starting at the current position.
    let matched: readonly [string, string] | undefined
    for (const token of MOMENT_TO_DATE_FNS_TOKENS) {
      if (format.startsWith(token[0], i)) {
        matched = token
        break
      }
    }
    if (matched) {
      flushLiteral()
      parts.push(matched[1])
      i += matched[0].length
      continue
    }

    // Non-token character: alphabetic chars must be escaped as literals,
    // otherwise date-fns would interpret them as its own tokens.
    if (/[A-Za-z]/.test(c)) {
      literalBuffer += c
    } else {
      flushLiteral()
      parts.push(c)
    }
    i++
  }
  flushLiteral()
  return parts.join('')
}

export function toMoment(epochOrLongCalendar: number | null | undefined): { format: (format: string | null | undefined) => string | undefined } | undefined {
  if (epochOrLongCalendar === null || epochOrLongCalendar === undefined) return undefined
  if (!epochOrLongCalendar && epochOrLongCalendar !== 0) {
    return undefined
  }
  const parsed = (epochOrLongCalendar >= 18000101 && epochOrLongCalendar < 25400000) ?
    parseDate('' + epochOrLongCalendar, 'yyyyMMdd', new Date()) :
    (epochOrLongCalendar >= 18000101000000) ?
      parseDate('' + epochOrLongCalendar, 'yyyyMMddHHmmss', new Date()) :
      new Date(epochOrLongCalendar)
  return {
    format: (format: string | null | undefined): string | undefined => {
      if (format === null || format === undefined) return undefined
      const dateFnsFormat = momentFormatToDateFnsFormat(format)
      if (dateFnsFormat === null || dateFnsFormat === undefined) return undefined
      return formatDate(parsed, dateFnsFormat, {
        useAdditionalDayOfYearTokens: true,
        useAdditionalWeekYearTokens: true,
      })
    }
  }
}
