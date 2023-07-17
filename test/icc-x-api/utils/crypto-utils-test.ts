import { encryptObject, decryptObject, EncryptedFieldsManifest, parseEncryptedFields, ua2utf8, utf8_2ua } from '../../../icc-x-api'
import * as _ from 'lodash'
import { expect } from 'chai'

describe('Crypt / decrypt', () => {
  it('encrypted fields parsing should create the appropriate structure', () => {
    const fields = [
      'field1',
      'field2',
      'nestedField.field3',
      'nestedField.field4',
      'arrayField[].field5',
      'arrayField[].field6',
      'arrayField[].nestedField.field7',
      'arrayField2[].' +
        JSON.stringify(['field8', 'mapField.*.field9', 'nestedField.' + JSON.stringify(['field10', 'field11']), 'nestedField.field12']),
      'mapField.*.field13',
      'mapField.*.field14',
    ]
    const parsedFields = parseEncryptedFields(fields, 'Test.')
    function checkParsedFields(
      fields: EncryptedFieldsManifest,
      expectedTopLevelFields: { fieldName: string; fieldPath: string }[],
      expectedNestedFields: { [name: string]: (subkeys: EncryptedFieldsManifest) => void },
      expectedArrayFields: { [name: string]: (subkeys: EncryptedFieldsManifest) => void },
      expectedMapFields: { [name: string]: (subkeys: EncryptedFieldsManifest) => void }
    ) {
      expect(fields.topLevelFields.map((x) => JSON.stringify(x))).to.have.members(expectedTopLevelFields.map((x) => JSON.stringify(x)))
      expect(Object.keys(fields.nestedObjectsKeys)).to.have.members(Object.keys(expectedNestedFields))
      expect(Object.keys(fields.arraysValuesKeys)).to.have.members(Object.keys(expectedArrayFields))
      expect(Object.keys(fields.mapsValuesKeys)).to.have.members(Object.keys(expectedMapFields))
      for (const [k, v] of Object.entries(expectedNestedFields)) {
        v(fields.nestedObjectsKeys[k])
      }
      for (const [k, v] of Object.entries(expectedArrayFields)) {
        v(fields.arraysValuesKeys[k])
      }
      for (const [k, v] of Object.entries(expectedMapFields)) {
        v(fields.mapsValuesKeys[k])
      }
    }
    checkParsedFields(
      parsedFields,
      [
        { fieldName: 'field1', fieldPath: 'Test.field1' },
        { fieldName: 'field2', fieldPath: 'Test.field2' },
      ],
      {
        nestedField: (x) =>
          checkParsedFields(
            x,
            [
              { fieldName: 'field3', fieldPath: 'Test.nestedField.field3' },
              { fieldName: 'field4', fieldPath: 'Test.nestedField.field4' },
            ],
            {},
            {},
            {}
          ),
      },
      {
        arrayField: (x) =>
          checkParsedFields(
            x,
            [
              { fieldName: 'field5', fieldPath: 'Test.arrayField[].field5' },
              { fieldName: 'field6', fieldPath: 'Test.arrayField[].field6' },
            ],
            {
              nestedField: (x) => checkParsedFields(x, [{ fieldName: 'field7', fieldPath: 'Test.arrayField[].nestedField.field7' }], {}, {}, {}),
            },
            {},
            {}
          ),
        arrayField2: (x) =>
          checkParsedFields(
            x,
            [{ fieldName: 'field8', fieldPath: 'Test.arrayField2[].field8' }],
            {
              nestedField: (x) =>
                checkParsedFields(
                  x,
                  [
                    { fieldName: 'field10', fieldPath: 'Test.arrayField2[].nestedField.field10' },
                    { fieldName: 'field11', fieldPath: 'Test.arrayField2[].nestedField.field11' },
                    { fieldName: 'field12', fieldPath: 'Test.arrayField2[].nestedField.field12' },
                  ],
                  {},
                  {},
                  {}
                ),
            },
            {},
            {
              mapField: (x) => checkParsedFields(x, [{ fieldName: 'field9', fieldPath: 'Test.arrayField2[].mapField.*.field9' }], {}, {}, {}),
            }
          ),
      },
      {
        mapField: (x) =>
          checkParsedFields(
            x,
            [
              { fieldName: 'field13', fieldPath: 'Test.mapField.*.field13' },
              { fieldName: 'field14', fieldPath: 'Test.mapField.*.field14' },
            ],
            {},
            {},
            {}
          ),
      }
    )
  })

  it('encrypted fields parsing should fail in case of any field being invalid', () => {
    const sampleValidFields = [
      'field1',
      'nestedField.field3',
      'arrayField[].nestedField.field7',
      'arrayField2[].' + JSON.stringify(['field8', 'mapField.*.field9']),
      'mapField.*.field13',
    ]
    const invalidFields: [string, string | null][] = [
      ['a.1b', null],
      ['a.[].b', null],
      ['a[].*.b', null], // Not supported but maybe in future
      ['a[].b.{}', null],
      ['a[].b.["c", 0]', null],
      ['a.*.b.["c", "\\"]', null],
      ['a[].b.["c", "1notAField"]', 'a[].b.1notAField'],
      ['a.b.' + JSON.stringify(['c', 'd.*.' + JSON.stringify(['e', 'f[].' + JSON.stringify(['g', '1notAField'])])]), 'a.b.d.*.f[].1notAField'],
    ]
    for (const [field, expectedErrorMessageInfo] of invalidFields) {
      let result: EncryptedFieldsManifest | undefined = undefined
      try {
        result = parseEncryptedFields([...sampleValidFields, field], 'Test.')
      } catch (e) {
        expect(e).to.be.instanceOf(Error)
        expect((e as Error).message).to.include('Test.' + (expectedErrorMessageInfo ?? field))
      }
      expect(result, 'Operation should fail for field: ' + field).to.be.undefined
    }
  })

  const sampleObj = {
    field1: 'nonEncryptedValue1A',
    field2: 'nonEncryptedValue2A',
    field3: 'encryptedValue3A',
    field4: 'encryptedValue4A',
    nestedData: {
      field1: 'nonEncryptedValue1B',
      field2: 'encryptedValue2B',
      field3: 'nonEncryptedValue3B',
      field4: 'encryptedValue4B',
    },
    arrayData: [
      {
        field1: 'nonEncryptedValue1C',
        field2: 'encryptedValue2C',
        field3: 'encryptedValue3C',
        field4: 'nonEncryptedValue4C',
        nestedData: {
          field1: 'encryptedValue1D',
          field2: 'encryptedValue2D',
          field3: 'nonEncryptedValue3D',
          field4: 'nonEncryptedValue4D',
        },
        arrayData: [
          {
            field1: 'encryptedValue1E',
            field2: 'nonEncryptedValue2E',
            field3: 'nonEncryptedValue3E',
            field4: 'encryptedValue4E',
            arrayData: [
              null,
              {
                a: 1, // encrypted
                b: 2, // encrypted
                x: 3,
                y: 4,
              },
            ],
          },
          {
            field1: 'encryptedValue1F',
            field2: 'nonEncryptedValue2F',
            field3: 'nonEncryptedValue3F',
            field4: 'encryptedValue4F',
            nestedData: {
              a: 1,
              b: 2,
              x: 3, // encrypted
              y: 4, // encrypted
            },
            // No array data: by convention we usually considered undefined array as empty, but in future this may change. The crypt/decrypt must
            // handle this properly
          },
        ],
      },
      null, // Should be left as null
      {
        field1: 'nonEncryptedValue1G',
        field2: 'encryptedValue2G',
        field3: 'encryptedValue3G',
        field4: 'nonEncryptedValue4G',
        nestedData: {
          field1: 'encryptedValue1H',
          field2: 'encryptedValue2H',
          field3: 'nonEncryptedValue3H',
          field4: 'nonEncryptedValue4H',
        },
        arrayData: [],
      },
    ],
    arrayData2: [
      {
        field1: 'encryptedValue1I',
        field2: 'nonEncryptedValue2I',
        field3: 'nonEncryptedValue3I',
        field4: 'encryptedValue4I',
      },
      {
        field1: 'encryptedValue1J',
        field2: 'nonEncryptedValue2J',
        field3: 'nonEncryptedValue3J',
        field4: 'encryptedValue4J',
      },
    ],
    mapData: {
      a: {
        field2: 'encryptedValue2K',
        field4: 'nonEncryptedValue4K',
      },
      b: {
        field1: 'nonEncryptedValue1L',
        field3: 'encryptedValue3L',
      },
      c: {
        field1: 'nonEncryptedValue1M',
        field2: 'encryptedValue2M',
        field3: 'encryptedValue3M',
        field4: 'nonEncryptedValue4M',
      },
      d: {
        field1: 'nonEncryptedValue1N',
        field4: 'nonEncryptedValue4N',
        // If the encrypted fields are all optional and missing the encrypted self should still be set (from {})
      },
    },
  }

  const sampleObjEncryptionKeys = [
    'field3',
    'field4',
    'nestedData.field2',
    'nestedData.field4',
    'arrayData[].' +
      JSON.stringify([
        'field2',
        'field3',
        'nestedData.field1',
        'nestedData.field2',
        'arrayData[].' + JSON.stringify(['field1', 'field4', 'nestedData.x', 'nestedData.y', 'arrayData[].' + JSON.stringify(['a', 'b'])]),
      ]),
    'arrayData2[].field1',
    'arrayData2[].field4',
    'mapData.*.field2',
    'mapData.*.field3',
  ]

  it('crypt should not modify input object (should create shallow copy as needed)', async () => {
    const toBeCrypted = _.cloneDeep(sampleObj)
    const crypted = await encryptObject(
      toBeCrypted,
      async () => {
        return utf8_2ua('Test')
      },
      parseEncryptedFields(sampleObjEncryptionKeys, 'TestObj.'),
      'testObj'
    )
    expect(crypted).to.not.deep.equal(toBeCrypted)
    expect(toBeCrypted).to.deep.equal(sampleObj)
  })

  it('encrypted object should delete encrypted fields and set encryptedSelf', async () => {
    const encryptedSelf = 'VGVzdA=='
    const expectedEncrypted = {
      field1: 'nonEncryptedValue1A',
      field2: 'nonEncryptedValue2A',
      encryptedSelf,
      nestedData: {
        field1: 'nonEncryptedValue1B',
        field3: 'nonEncryptedValue3B',
        encryptedSelf,
      },
      arrayData: [
        {
          field1: 'nonEncryptedValue1C',
          field4: 'nonEncryptedValue4C',
          encryptedSelf,
          nestedData: {
            field3: 'nonEncryptedValue3D',
            field4: 'nonEncryptedValue4D',
            encryptedSelf,
          },
          arrayData: [
            {
              field2: 'nonEncryptedValue2E',
              field3: 'nonEncryptedValue3E',
              encryptedSelf,
              arrayData: [
                null,
                {
                  x: 3,
                  y: 4,
                  encryptedSelf,
                },
              ],
            },
            {
              field2: 'nonEncryptedValue2F',
              field3: 'nonEncryptedValue3F',
              encryptedSelf,
              nestedData: {
                a: 1,
                b: 2,
                encryptedSelf,
              },
              // No array data: by convention we usually considered undefined array as empty, but in future this may change. The crypt/decrypt must
              // handle this properly
            },
          ],
        },
        null,
        {
          field1: 'nonEncryptedValue1G',
          field4: 'nonEncryptedValue4G',
          encryptedSelf,
          nestedData: {
            field3: 'nonEncryptedValue3H',
            field4: 'nonEncryptedValue4H',
            encryptedSelf,
          },
          arrayData: [],
        },
      ],
      arrayData2: [
        {
          field2: 'nonEncryptedValue2I',
          field3: 'nonEncryptedValue3I',
          encryptedSelf,
        },
        {
          field2: 'nonEncryptedValue2J',
          field3: 'nonEncryptedValue3J',
          encryptedSelf,
        },
      ],
      mapData: {
        a: {
          field4: 'nonEncryptedValue4K',
          encryptedSelf,
        },
        b: {
          field1: 'nonEncryptedValue1L',
          encryptedSelf,
        },
        c: {
          field1: 'nonEncryptedValue1M',
          field4: 'nonEncryptedValue4M',
          encryptedSelf,
        },
        d: {
          field1: 'nonEncryptedValue1N',
          field4: 'nonEncryptedValue4N',
          encryptedSelf,
        },
      },
    }
    const encryptedObj = await encryptObject(
      sampleObj,
      async () => {
        return utf8_2ua('Test')
      },
      parseEncryptedFields(sampleObjEncryptionKeys, 'TestObj.'),
      'testObj'
    )
    expect(encryptedObj).to.deep.equal(expectedEncrypted)
  })

  it('encrypted then decrypted object should equal the original (excluding for the addition of encrypted self)', async () => {
    const encryptedObj = await encryptObject(
      sampleObj,
      async (obj: { [key: string]: string }) => {
        return utf8_2ua(JSON.stringify(obj))
      },
      parseEncryptedFields(sampleObjEncryptionKeys, 'TestObj.'),
      'testObj.'
    )
    const decryptedObj = await decryptObject(encryptedObj, async (obj: Uint8Array) => {
      return JSON.parse(ua2utf8(obj))
    })
    const stripEncryptedSelf = (obj: any) =>
      _.cloneDeepWith(_.cloneDeep(obj), (v) => {
        if (v !== null && typeof v == 'object') delete v['encryptedSelf']
      })
    expect(stripEncryptedSelf(encryptedObj)).to.not.deep.equal(sampleObj)
    expect(stripEncryptedSelf(decryptedObj)).to.deep.equal(sampleObj)
  })

  it('crypt should verify the type of fields matches what is defined by the encrypted fields keys', async () => {
    const cases: { keys: EncryptedFieldsManifest; obj: { [k: string]: any }; brokenField: string }[] = [
      {
        keys: {
          topLevelFields: [],
          nestedObjectsKeys: {
            shouldBeObject: {
              topLevelFields: [],
              nestedObjectsKeys: {
                nestedShouldBeObject: {
                  topLevelFields: [{ fieldName: 'field1', fieldPath: 'shouldBeObject.nestedShouldBeObject.field1' }],
                  nestedObjectsKeys: {},
                  mapsValuesKeys: {},
                  arraysValuesKeys: {},
                },
              },
              mapsValuesKeys: {},
              arraysValuesKeys: {},
            },
          },
          mapsValuesKeys: {},
          arraysValuesKeys: {},
        },
        obj: {
          shouldBeObject: {
            nestedShouldBeObject: 'not an object',
          },
        },
        brokenField: 'shouldBeObject.nestedShouldBeObject',
      },
      {
        keys: {
          topLevelFields: [],
          nestedObjectsKeys: {
            shouldBeObject: {
              topLevelFields: [],
              nestedObjectsKeys: {
                nestedShouldBeObject: {
                  topLevelFields: [{ fieldName: 'field1', fieldPath: 'shouldBeObject.nestedShouldBeObject.field1' }],
                  nestedObjectsKeys: {},
                  mapsValuesKeys: {},
                  arraysValuesKeys: {},
                },
              },
              mapsValuesKeys: {},
              arraysValuesKeys: {},
            },
          },
          mapsValuesKeys: {},
          arraysValuesKeys: {},
        },
        obj: {
          shouldBeObject: 'not an object',
        },
        brokenField: 'shouldBeObject',
      },
      {
        keys: {
          topLevelFields: [],
          nestedObjectsKeys: {
            shouldBeObject: {
              topLevelFields: [{ fieldName: 'field1', fieldPath: 'shouldBeObject.field1' }],
              nestedObjectsKeys: {},
              mapsValuesKeys: {},
              arraysValuesKeys: {},
            },
          },
          mapsValuesKeys: {},
          arraysValuesKeys: {},
        },
        obj: {
          shouldBeObject: [{ field1: 'something' }],
        },
        brokenField: 'shouldBeObject',
      },
      {
        keys: {
          topLevelFields: [],
          nestedObjectsKeys: {},
          mapsValuesKeys: {
            shouldBeMap: {
              topLevelFields: [{ fieldName: 'field1', fieldPath: 'shouldBeMap.*.field1' }],
              nestedObjectsKeys: {},
              mapsValuesKeys: {},
              arraysValuesKeys: {},
            },
          },
          arraysValuesKeys: {},
        },
        obj: {
          shouldBeMap: {
            key1: { field1: 'something' },
            key2: 'not an object',
          },
        },
        brokenField: 'shouldBeMap.key2',
      },
      {
        keys: {
          topLevelFields: [],
          nestedObjectsKeys: {},
          mapsValuesKeys: {
            shouldBeMap: {
              topLevelFields: [{ fieldName: 'field1', fieldPath: 'shouldBeMap.*.field1' }],
              nestedObjectsKeys: {},
              mapsValuesKeys: {},
              arraysValuesKeys: {},
            },
          },
          arraysValuesKeys: {},
        },
        obj: {
          shouldBeMap: {
            key1: [],
          },
        },
        brokenField: 'shouldBeMap.key1',
      },
      {
        keys: {
          topLevelFields: [],
          nestedObjectsKeys: {},
          mapsValuesKeys: {
            shouldBeMap: {
              topLevelFields: [{ fieldName: 'field1', fieldPath: 'shouldBeMap.*.field1' }],
              nestedObjectsKeys: {},
              mapsValuesKeys: {},
              arraysValuesKeys: {},
            },
          },
          arraysValuesKeys: {},
        },
        obj: {
          shouldBeMap: [],
        },
        brokenField: 'shouldBeMap',
      },
      {
        keys: {
          topLevelFields: [],
          nestedObjectsKeys: {},
          mapsValuesKeys: {
            shouldBeMap: {
              topLevelFields: [{ fieldName: 'field1', fieldPath: 'shouldBeMap.*.field1' }],
              nestedObjectsKeys: {},
              mapsValuesKeys: {},
              arraysValuesKeys: {},
            },
          },
          arraysValuesKeys: {},
        },
        obj: {
          shouldBeMap: 'not a map',
        },
        brokenField: 'shouldBeMap',
      },
      {
        keys: {
          topLevelFields: [],
          nestedObjectsKeys: {},
          mapsValuesKeys: {},
          arraysValuesKeys: {
            shouldBeArray: {
              topLevelFields: [{ fieldName: 'field1', fieldPath: 'shouldBeArray[].field1' }],
              nestedObjectsKeys: {},
              mapsValuesKeys: {},
              arraysValuesKeys: {},
            },
          },
        },
        obj: {
          shouldBeArray: {
            0: { field1: 'fake array' },
            1: { field1: 'wow' },
          },
        },
        brokenField: 'shouldBeArray',
      },
      {
        keys: {
          topLevelFields: [],
          nestedObjectsKeys: {},
          mapsValuesKeys: {},
          arraysValuesKeys: {
            shouldBeArray: {
              topLevelFields: [{ fieldName: 'field1', fieldPath: 'shouldBeArray[].field1' }],
              nestedObjectsKeys: {},
              mapsValuesKeys: {},
              arraysValuesKeys: {},
            },
          },
        },
        obj: {
          shouldBeArray: [{ field1: 'this is ok' }, 'this is not ok'],
        },
        brokenField: 'shouldBeArray[1]',
      },
    ]
    for (const c of cases) {
      let success = false
      try {
        await encryptObject(
          c.obj,
          async (obj: { [key: string]: string }) => {
            return utf8_2ua(JSON.stringify(obj))
          },
          c.keys,
          'testObj'
        )
        success = true
      } catch (e) {
        expect(e).to.be.instanceOf(Error)
        console.log((e as Error).message)
        expect((e as Error).message).to.include(` testObj.${c.brokenField} `)
      }
      expect(success, 'Crypt should fail').to.be.false
    }
  })

  it('decrypt should not break arrays of primitive values', async function () {
    const cases = [
      { array: ['abc', 'bcd', 'cde'] },
      { array: [1, 2, 3] },
      { array: [true, false, true] },
      { array: [null, null, null] },
      { array: [undefined, undefined, undefined] },
      { array: [BigInt(1), BigInt(2), BigInt(3)] },
    ]
    for (const c of cases) {
      const decrypted = await decryptObject(c, () => {
        throw new Error('Should not actually be needed for this test')
      })
      expect(decrypted).to.deep.equal(c)
    }
  })
})
