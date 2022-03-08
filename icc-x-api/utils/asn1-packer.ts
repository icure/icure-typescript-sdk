// Copyright 2018 AJ ONeal. All rights reserved
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Ported to Typescript by iCure sa */

const numToHex = function (d: number): string {
  const ds = d.toString(16)
  if (ds.length % 2) {
    return '0' + ds
  }
  return ds
}

//
// Packer
//
// Almost every ASN.1 type that's important for CSR
// can be represented generically with only a few rules.
export function packOther(...args: string[]) {
  const typ: string = args.shift()!
  const str: string = args.join('').replace(/\s+/g, '').toLowerCase()
  var len: number = str.length / 2
  var lenlen = 0
  var hex = typ

  // We can't have an odd number of hex chars
  if (len !== Math.round(len)) {
    throw new Error('invalid hex')
  }

  // The first byte of any ASN.1 sequence is the type (Sequence, Integer, etc)
  // The second byte is either the size of the value, or the size of its size
  // 1. If the second byte is < 0x80 (128) it is considered the size
  // 2. If it is > 0x80 then it describes the number of bytes of the size
  //    ex: 0x82 means the next 2 bytes describe the size of the value
  // 3. The special case of exactly 0x80 is "indefinite" length (to end-of-file)
  if (len > 127) {
    lenlen += 1
    while (len > 255) {
      lenlen += 1
      len = len >> 8
    }
  }

  if (lenlen) {
    hex += numToHex(0x80 + lenlen)
  }
  return hex + numToHex(str.length / 2) + str
}

// The Integer type has some special rules
function packUInt(...arr: string[]) {
  const str = arr.join('')
  const first = parseInt(str.slice(0, 2), 16)

  // If the first byte is 0x80 or greater, the number is considered negative
  // Therefore we add a '00' prefix if the 0x80 bit is set
  return 0x80 & first ? packOther('02', '00' + str) : packOther('02', str)
}

// The Bit String type also has a special rule
function packBitStr(...arr: string[]) {
  var str = arr.join('')
  // '00' is a mask of how many bits of the next byte to ignore
  return packOther('03', '00' + str)
}

export type Asn1Item = number | string | Asn1Item[]

export function pack(arr: Asn1Item[]) {
  var typ = numToHex(arr[0] as number)
  var str = ''
  if (arr[1]) {
    if (Array.isArray(arr[1])) {
      arr[1].forEach((a) => (str += pack(a as Asn1Item[])))
    } else if ('string' === typeof arr[1]) {
      str = arr[1]
    } else {
      throw new Error('unexpected item')
    }
  }
  const packed = '03' === typ ? packBitStr(str) : '02' === typ ? packUInt(str) : packOther(typ, str)

  return packed
}
