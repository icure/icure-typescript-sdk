# icc-api CHANGELOG

## 2.0.0

- [FEATURE] [#86](https://github.com/taktik/icc-api/pull/86) - BREAK Add icc-helement-x-api services managing encryption/decryption
- [FEATURE] [#86](https://github.com/taktik/icc-api/pull/86) - Every dataOwner is now supported for encryption/decryption services (not only HCP anymore)
- [FEATURE] [a3318e7477b929a00bc8227080fa424cd2896d6b](https://github.com/taktik/icc-api/commit/a3318e7477b929a00bc8227080fa424cd2896d6b) - Add getGroupsStorageInfos API in IccGroupApi
- [FEATURE] [a3318e7477b929a00bc8227080fa424cd2896d6b](https://github.com/taktik/icc-api/commit/a3318e7477b929a00bc8227080fa424cd2896d6b) - Add getUserSyncInfo API in IccIcureApi

### Breaking changes for [#86](https://github.com/taktik/icc-api/pull/86)

icc-helement-x-api now includes API services managing encryption/decryption. Just like other APIs, icc-helement-api services not managing encryption
throw an Error in order to force the usage of the corresponding new APIs.

In the next table, you will find all deleted services and their corresponding substitute

| Previous service                                                                        | New service                                                                                                        |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `createHealthElement(body?: HealthElement)`                                             | `createHealthElementWithUser(user: User, body?: HealthElement)`                                                    |
| `createHealthElements(body?: Array<HealthElement>)`                                     | `createHealthElementsWithUser(user: models.User, bodies?: models.HealthElement[])`                                 |
| `getHealthElement(healthElementId: string)`                                             | `getHealthElementWithUser(user: models.User, healthElementId: string)`                                             |
| `getHealthElements(body?: models.ListOfIds)`                                            | `getHealthElementsWithUser(user: models.User, body?: models.ListOfIds)`                                            |
| `newHealthElementDelegations(healthElementId: string, body?: Array<models.Delegation>)` | `newHealthElementDelegationsWithUser(user: models.User, healthElementId: string, body?: Array<models.Delegation>)` |
| `findHealthElementsByHCPartyPatientForeignKeys(hcPartyId: string, secretFKeys: string)` | `findHealthElementsByHCPartyPatientForeignKeysWithUser(user: models.User, hcPartyId: string, secretFKeys: string)` |
| `modifyHealthElement(body?: HealthElement)`                                             | `modifyHealthElementWithUser(user: models.User, body?: HealthElement)`                                             |
| `modifyHealthElements(body?: Array<HealthElement>)`                                     | `modifyHealthElementsWithUser(user: models.User, bodies?: HealthElement[])`                                        |
