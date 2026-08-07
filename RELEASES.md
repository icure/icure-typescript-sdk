# @icure/api v8 releases

> Release notes for the GitHub releases of `@icure/api`, one entry per NPM version, oldest first.
> Entries without a status marker are published on GitHub and left untouched by `bun scripts/create-releases.ts`.
> To act on an entry, mark its header: `## [MISSING] x.y.z (date)` = release to be created,
> `## [TERSE] x.y.z (date)` = existing release whose description will be replaced by the one below.

## 8.0.0-RC.1 (2023-09-21)

<!-- tag: 8.0.0-RC.1 | target: 44096e5ca98c5eeef57d217c0ef42554bafbec54 | prerelease: true -->

- Misc changes
- Refactor icc-crypto-x-api.ts attributes
- Update xapi utils
- Reduce calls to crypto strategies exchange data manager when creating new keys: use already verified keys for creation of exchange data to members of data owner hierarchy
- Partially done with xapis
- Fix encryption keys manager, removed unnecessary methods for creation of old exchange keys
- Fix remaining xapis + index
- Add missing dependency
- Fix some test compilation issues
- Fix compilation issues of delegate-ci-to-patient-with-missing-keys-test.ts
- Fix compilation issues of jwt-concurrency-test.ts
- Fix some bugs + compilation
- More fixes + updates to tests
- Fix user-encryption-keys-manager-test.ts
- Fix patient-user.ts
- Update legacy data support test
- Included latest changes from kraken
- Fix AccessLogApi compilation issue

## 8.0.0-RC.2 (2023-10-23)

<!-- tag: 8.0.0-RC.2 | target: cc53fca03d7a0c5be374af2bb6a22312e6767cec | prerelease: true -->

- Add missing export
- Messaging system (#94)
- Attempts to fix fetch highlight errors
- Fixed keys usage on decryptServices
- Added linkedHealthElements and linkedServices to Topic
- Removed useless fields
- Added missing PaginatedListTopic export
- Fix task enum typing
- Improve picture handling in HCP
- Added matchMessagesBy
- Fixed addParticipantWithTopic decryption before returning
- Add headers for request autofix anonymity.
- Update x apis to not autofill author/responsible on client side for users requiring anonymous delegations + test
- Additional tests for confidential entities
- Fixed getAndTryDecryptDocumentAttachment
- Added missing export for Topic and Message filters
- Fixed missing decryption on setMessagesReadStatus result
- Support delegations de-anonymization

## 8.0.0-RC.3 (2023-10-27)

<!-- tag: 8.0.0-RC.3 | target: c75f9d5ee53206ffaa4ccb4964ea64c0276dbec5 | prerelease: true -->

- Added MessageAttachment (#107)
- Added IccRoleApi on v8 (#101)
- Update delete methods (#109)
- Small fix to test
- Fix verification key reloading + test

## 8.0.0-RC.4 (2023-11-06)

<!-- tag: 8.0.0-RC.4 | target: 5c2e9fc4008ca0fb83960b52152c02c60e88ec94 | prerelease: true -->

- Add user system metadata
- Reintroduce test util method mistakenly removed
- Change exchange data verification to allow more flexibility for give-access-back / recovery of exchange data content
- Move internal base apis to separate package
- Add recovery data base api
- Add get all insurances endpoint
- Use shared signature key in exchange data + re-secure with signature public keys fp appearing in it
- Exposed JWT
- Revert "Exposed JWT"
- Exposed JWT from JwtBridgedAuthService.ts

## 8.0.0-RC.5 (2023-11-09)

<!-- tag: 8.0.0-RC.5 | target: a55bb7f16077676f9aaab4156189357fe3952dbb | prerelease: true -->

- Added new createMessageInTopic endpoint (#113)

## 8.0.0-RC.6 (2023-11-21)

<!-- tag: 8.0.0-RC.6 | target: 41fa4b8ec403b69c4832eee620cbe05c34bc9477 | prerelease: true -->

- Add authentication details to basic apis
- Update JWT Bridged Auth Service
- Get user by phone number (#117)

## 8.0.0 (2024-01-09)

<!-- tag: 8.0.0 | target: a84873b9d9dacd8531e63b77b4588b5e1aa5f20d | prerelease: false -->

- Add smart auth provider (#118)
- Use autofill author in service
- Support third party token in smart auth provider
- Added functions to create an admin user (#121)
- Recovery x api (#122)
- Added JWT support for Kmehr websocket (#116)
- Added an anonymous endpoint to retrieve medical locations for a given group (#123)
- Clean cache of access control keys on new exchange data creation
- Calculate delegation parent in client-side
- Fix the 409 when a short token is created in the getSecret during the modification of the logged user
- Make api initialisation OSS friendly + update 2fa tests to use new enable 2fa method
- Bumped test lib version
- Make smart auth provider compatible with lite backend
- Update tests for lite compatibility + fix circular dependency causing test run issues
- Changed publicInformations value type from `any` to `string`

## 8.0.1 (2024-01-09)

<!-- tag: 8.0.1 | target: 531addc9b10287557a7bd5316b1001549002a1fc | prerelease: false -->

- Fix issues with data sharing for non-hierarchical hcps

## 8.0.2 (2024-01-19)

<!-- tag: 8.0.2 | target: c03abbb3b738d3688f9df23936306bc70ff47977 | prerelease: false -->

- Added referenceRange (#126)
- Replaced add and remove roles with set and reset (#128)
- Allow to provide initial jwt to api initialisation

## 8.0.3 (2024-01-19)

<!-- tag: 8.0.3 | target: 38472cfa6a24f70823b8832bd5e0a9610ab27f0d | prerelease: false -->

- Fix initial token not being used

## 8.0.4 (2024-01-25)

<!-- tag: 8.0.4 | target: 0370707da8f0d549d61da36b4d3d6052c1fe5005 | prerelease: false -->

- Enforce HMAC key size through parameter
- Add hmac key size checks
- Changed the way how the getAllInsurance url is built

## 8.0.5 (2024-01-25)

<!-- tag: 8.0.5 | target: 3ea0c3fae735182d82b1ced578552a2273a61c5d | prerelease: false -->

- Added missing fields on CodeStub and ReferenceRange

## 8.0.6 (2024-01-25)

<!-- tag: 8.0.6 | target: d51102305caf80fee5d13031ba1eac0bfb4f8c4c | prerelease: false -->

Maintenance release (version bump only).

## 8.0.7 (2024-01-25)

<!-- tag: 8.0.7 | target: c0fbec6c369d0801223444cfba6d450599cfa1d2 | prerelease: false -->

- Updated exports

## 8.0.8 (2024-01-25)

<!-- tag: 8.0.8 | target: 612bd102747ac2da81e0b065a36b239058092758 | prerelease: false -->

- Export entity type name

## 8.0.9 (2024-01-29)

<!-- tag: 8.0.9 | target: 38921375547781bd703111f663704c398e019520 | prerelease: false -->

- ShaVersion and EntityWithDelegationType are now enums. Export some missing types

## 8.0.10 (2024-01-30)

<!-- tag: 8.0.10 | target: b6d3edc233e24be3f2e1914994c38f481808cfb3 | prerelease: false -->

- Use fingerprint v2 for verification keys
- Use fingerprintv1 instead of slice(-32)

## 8.0.11 (2024-01-30)

<!-- tag: 8.0.11 | target: c33eb6b766c18306fb05afe1ef3ca09638c48745 | prerelease: false -->

- Export missing function on index

## 8.0.12 (2024-01-30)

<!-- tag: 8.0.12 | target: 64ba9f46853e6e5ee6d5aaf4647c64c0f7b9c2f2 | prerelease: false -->

- Fix inconsistent fingerprint version in exchange data map

## 8.0.13 (2024-01-31)

<!-- tag: 8.0.13 | target: a12704cd4142fb09771ada9dfc794b143a14f3c1 | prerelease: false -->

- Fix get hcp by ids method
- Fix double group switch issue

## 8.0.14 (2024-02-02)

<!-- tag: 8.0.14 | target: 7e9d043b6febb567a3a0b74a4660108f05edbe0a | prerelease: false -->

- Fix broken tests and update doc
- Avoid switching if the chosen group is the same as the current group + provide current group as input to the group selector

## 8.0.15 (2024-02-05)

<!-- tag: 8.0.15 | target: 166f9cd6657bdf85fbce4dfde3ba681068a4f92f | prerelease: false -->

- Add missing paginated list exports from model
- Remove obsolete icc document x api methods

## 8.0.16 (2024-02-13)

<!-- tag: 8.0.16 | target: 4a3575216075662abc9ef6b80a02f80232632a5c | prerelease: false -->

- Plural referenceRanges (#129)

## 8.0.17 (2024-02-14)

<!-- tag: 8.0.17 | target: 363445abd1126ef6b8aa064e85ecd512618a04ef | prerelease: false -->

- Added notes to Contact (#130)

## 8.0.18 (2024-02-16)

<!-- tag: 8.0.18 | target: 34e0b086fed22824ad8f8ddf28c89506ebac175a | prerelease: false -->

- Added content-type header in BeRestulImportAPI (#131)

## 8.0.19 (2024-02-19)

<!-- tag: 8.0.19 | target: a1d5997c9938cfe86cc002d1e881891640518d25 | prerelease: false -->

- Create decrypt document attachment as method

## 8.0.20 (2024-03-04)

<!-- tag: 8.0.20 | target: ee02a223840d33e70467eff94b30b3efceb21863 | prerelease: false -->

- Fix issue with legacy delegation migration when migration is performed by a relative of the original entity creator
- Small fix on issues when a new user for an existing patient logs in for the first time
- Fixed dataOwnerIds used during decryption of encryptionKeys (#133)
- Updated pagination endpoints (#134)

## 8.0.21 (2024-03-12)

<!-- tag: 8.0.21 | target: d6ef40df0792320da359df7d6c5226be7fc7d5e7 | prerelease: false -->

Maintenance release (version bump only).

## 8.0.22 (2024-03-12)

<!-- tag: 8.0.22 | target: cfbaa244ac49dd1fc08a80c03c8352b90992eb11 | prerelease: false -->

- Small fix on get codes + added tests (#135)

## 8.0.23 (2024-03-28)

<!-- tag: 8.0.23 | target: 36266bb2b28161742c3c3a8788bc5598642de6e0 | prerelease: false -->

- Fix issue with decryptServices

## 8.0.24 (2024-04-18)

<!-- tag: 8.0.24 | target: 151c5805fec0c4b3643a53b65a3ba62ba6e1b39b | prerelease: false -->

- Fix issue with creation of unnecessary transfer keys
- JWT provider will retry on failure (#138)

## 8.0.25 (2024-04-26)

<!-- tag: 8.0.25 | target: 5f652b997848655fe4dbae42edf917dbb100a42f | prerelease: false -->

- Use interface for crypto primitives
- Fix maintenance task api tests
- Remove article tests (no more controller) + Update classification template test
- Fix medical location tests
- Add support for react native cryptography through expo-kryptom

## 8.0.26 (2024-04-26)

<!-- tag: 8.0.26 | target: e3bc38bd8e7d73a6eeb5ee2cb234057ecebaeb83 | prerelease: false -->

- Fix initialize to accept also crypto primitives + rename implementation to

## 8.0.27 (2024-04-29)

<!-- tag: 8.0.27 | target: 97449a3d890788ea9e50ffa9dd68b1d70882dbb6 | prerelease: false -->

- Fix webcrypto usage in native crypto

## 8.0.28 (2024-04-29)

<!-- tag: 8.0.28 | target: c7429843b845b1fbdcefa9ebff5ad62cbac39e36 | prerelease: false -->

- Updated dependencies

## 8.0.29 (2024-04-29)

<!-- tag: 8.0.29 | target: 406447838d4c091228020e79396b7073fd812f4e | prerelease: false -->

- Fixed export of keys

## 8.0.30 (2024-05-15)

<!-- tag: 8.0.30 | target: 3f7560580fdc08f61e939fc865fee7f35e07d070 | prerelease: false -->

- Switched get by hcp patient methods
- Added byIds method where missing and updated existing ones

## 8.0.32 (2024-05-16)

<!-- tag: 8.0.32 | target: ae31ce8a2cf041556b85668debd24a37cc3e5a3e | prerelease: false -->

- Small compilation fix
- Allow for querying of document templates without having to also load all attachments

## 8.0.33 (2024-05-17)

<!-- tag: 8.0.33 | target: 070b44eb2c8c8c5cdcd941bf5483f23e72f8d6e5 | prerelease: false -->

- Cleanup
- V8 - Removed session from BekmehrXApi websocket methods (#142)

## 8.0.34 (2024-05-22)

<!-- tag: 8.0.34 | target: 7a21b58fb6392b65eb328db18cc0c1f10b97dfab | prerelease: false -->

- Added jwtGetter to SmartAuthService (#144)

## 8.0.35 (2024-05-22)

<!-- tag: 8.0.35 | target: b1f22b13e0811766a408844c570be7518bd3e9c5 | prerelease: false -->

- Added jwtGetter to Ensemble and added tests

## 8.0.36 (2024-05-23)

<!-- tag: 8.0.36 | target: 6abf48fbed9443242271349068c116c6dad95732 | prerelease: false -->

- Update jwt parameter in websocket to proper query parameter

## 8.0.37 (2024-07-03)

<!-- tag: 8.0.37 | target: 361b5b7e9b6919f2819212787e24ccbf1f5abd02 | prerelease: false -->

- Feat: Added Medication's expirationDate field (#145)
- Ci: Version bump

## 8.0.38 (2024-07-16)

<!-- tag: 8.0.38 | target: 798359b70de249ca4a716bebaf54e867e2d59a60 | prerelease: false -->

- Add identifier to user

## 8.0.39 (2024-07-22)

<!-- tag: 8.0.39 | target: 798359b70de249ca4a716bebaf54e867e2d59a60 | prerelease: false -->

Maintenance release (version bump only).

## 8.0.40 (2024-07-23)

<!-- tag: 8.0.40 | target: ed5edf5074007c4c0f8b18b49ae81e943301ede2 | prerelease: false -->

- Add missing export to index
- Add basic api

## 8.0.41 (2024-07-25)

<!-- tag: 8.0.41 | target: db08fef5eedc1445e3eae86e1c0c162d5f307783 | prerelease: false -->

- Add new partnerships

## 8.0.42 (2024-07-31)

<!-- tag: 8.0.42 | target: f7ad566ca08aceb08b9f7362cbb8f77a3dcd1867 | prerelease: false -->

- Improve smart auth (#148)

## 8.0.43 (2024-07-31)

<!-- tag: 8.0.43 | target: f92a9eb02447cc12c7342e826359de28be0b8af9 | prerelease: false -->

- Implement get icure tokens for smart auth

## 8.0.44 (2024-08-01)

<!-- tag: 8.0.44 | target: 0144f8b4f0c21d31d32e6201beb689939dc3f68b | prerelease: false -->

- Added Contact's participants field (#146)
- Export some public crypto utils methods

## 8.0.45 (2024-08-01)

<!-- tag: 8.0.45 | target: d56c335bb9764726d970cd68c9f96c0e9e136f16 | prerelease: false -->

Maintenance release (version bump only).

## 8.0.46 (2024-08-06)

<!-- tag: 8.0.46 | target: 431e4b8b98f82bb903369367ca70569630643d59 | prerelease: false -->

- Fix endpoints towards v2 in v8
- Feat: Added Contact's encounterLocation (#151)

## 8.0.47 (2024-08-13)

<!-- tag: 8.0.47 | target: 914494e244c216741eb1958eeb6d930b916085a1 | prerelease: false -->

- Use constructor in paginated row

## 8.0.48 (2024-08-22)

<!-- tag: 8.0.48 | target: ec59fda37f328d830c2dcfc27d635cb1ac11432d | prerelease: false -->

- Added reference field to Valorization (#155)

## 8.0.49 (2024-09-11)

<!-- tag: 8.0.49 | target: 579b771850d4de3b6d5e6f3f2c08aaca5596f8c9 | prerelease: false -->

- Fixed typo
- Improve recovery api test
- Changed property name (#156)

## 8.0.50 (2024-09-12)

<!-- tag: 8.0.50 | target: fe37627d58a56fca0e57ee4039477cb024658b43 | prerelease: false -->

- Always create secret ids for entities

## 8.0.51 (2024-09-24)

<!-- tag: 8.0.51 | target: 3949d723aa1f5830cc2f2f5437f2f6ca7de29b9e | prerelease: false -->

- Added ExternalViewFilter hierarchy (#147)

## 8.0.53 (2024-10-15)

<!-- tag: 8.0.53 | target: 3949d723aa1f5830cc2f2f5437f2f6ca7de29b9e | prerelease: false -->

Maintenance release (version bump only).

## 8.0.56 (2024-10-16)

<!-- tag: 8.0.56 | target: d8a7d0f749eb377f648da4c270848791749eb4de | prerelease: false -->

- Updated SAM
- Added deprecation annotations and alternatives (#157)

## 8.0.57 (2024-10-17)

<!-- tag: 8.0.57 | target: 2e134dc0f4dcfc11e24683e010827db435cd8d72 | prerelease: false -->

Maintenance release (version bump only).

## 8.0.58 (2024-10-18)

<!-- tag: 8.0.58 | target: c0a8b02de11df5488ddd5e59251858029dc1f5e6 | prerelease: false -->

- Fix payload on get by patient + published 8.0.57

## 8.0.59 (2024-10-21)

<!-- tag: 8.0.59 | target: 9625f410a1117de24e5c6d969a140e394fc475d1 | prerelease: false -->

- Fixed return type
- Fix: Fixed return type of findByHCPartyPatientSecretFKeys (#158)

## 8.0.60 (2024-10-22)

<!-- tag: 8.0.60 | target: 5af9f4c3bd6640cfa686801e5c2608f3363d551b | prerelease: false -->

- Published 8.0.59
- Add checkPassword using login
- Hotfix: wrong url in get documents by data owner patient
- Published 8.0.60

## 8.0.61 (2024-11-04)

<!-- tag: 8.0.61 | target: 353181f59ab632c4fa8317f642b81d44dd209a75 | prerelease: false -->

- Fixed content-type (#159)

## 8.0.62 (2024-11-12)

<!-- tag: 8.0.62 | target: 4cf7b65a4758c55eeea63621ba6f087470f5561a | prerelease: false -->

- Published 8.0.61
- Feat: Added tags, codes and identifiers to Address (#160)
- Added license report probe (#161)
- Removed old workflow
- Chore: Version bump

## 8.0.63 (2024-11-14)

<!-- tag: 8.0.63 | target: d16052217fdb192c8cc56f86325b671f2207d12c | prerelease: false -->

- Added doc (#162)

## 8.0.64 (2024-11-18)

<!-- tag: 8.0.64 | target: 3f06a2e7fe6e6deb8afa2cce32795450769548aa | prerelease: false -->

- Published 8.0.63
- Fixed cache on icc-hcparty-x-api (#163)

## 8.0.65 (2024-11-20)

<!-- tag: 8.0.65 | target: 8faff0bd4dc96a10998e17043c73af1f65961420 | prerelease: false -->

- Chore: Version bump
- Batch decryption (#165)
- Drop separate signature key for exchange data

## 8.0.66 (2024-11-21)

<!-- tag: 8.0.66 | target: 8ef90016f40bff3283c193122f439231b479737b | prerelease: false -->

Maintenance release (version bump only).

## 8.0.67 (2024-11-22)

<!-- tag: 8.0.67 | target: f0bde5563e678ffa5b90dd55cc5aba4e17ce8ac7 | prerelease: false -->

- Add support for previous kraken-lite version
- Removed OTT in websocket

## 8.0.68 (2024-11-22)

<!-- tag: 8.0.68 | target: 61b0f674dcc220578f25f4490107980a860a5218 | prerelease: false -->

Maintenance release (version bump only).

## 8.0.69 (2024-11-28)

<!-- tag: 8.0.69 | target: dbad30ed87b553468987fc14ca2db02d47efb0a6 | prerelease: false -->

- Set version as 0 by default in medication scheme

## 8.0.70 (2024-12-03)

<!-- tag: 8.0.70 | target: 0df0dfb5aeb2e65e95c326c13eb84d428e90a437 | prerelease: false -->

- Update api initialization to work even with deleted data owners in hcpartykeys
- Update version

## 8.0.71 (2024-12-13)

<!-- tag: 8.0.71 | target: 939210ff19d0ecd31eadb25be2b8262e76d02807 | prerelease: false -->

- Fix: Auto-fix patient after creation (#167)

## 8.0.72 (2024-12-17)

<!-- tag: 8.0.72 | target: 8109525a2ff433736a8d8a4ea0f7d900f3ae6de1 | prerelease: false -->

- Chore: Version bump
- Add debug log for smart auth provider

## 8.0.73 (2024-12-19)

<!-- tag: 8.0.73 | target: eee437bd0cf6af0a2ad98989bdf7bcab7472daf0 | prerelease: false -->

- Fix check digits in v8

## 8.0.74 (2024-12-20)

<!-- tag: 8.0.74 | target: 71b6e9f7e45c1ae80cb92e32df77fa404d748587 | prerelease: false -->

- Changed property name to reflect DiaryNoteExportInfoDto v2 (#171)
- Prevented useless request (#172)
- Added changelog and version bump
- Removed changelog file

## 8.0.75 (2024-12-20)

<!-- tag: 8.0.75 | target: 4ed86074df4facf80c54448def3d9c44d22fcbe7 | prerelease: false -->

- Change back to encryptionDecryptionKeys

## 8.0.76 (2025-01-07)

<!-- tag: 8.0.76 | target: 0952b6e1ab39c6ccf925ca9d4fadde3a0722d836 | prerelease: false -->

- Support fake aesExchangeKeys public keys entries

## 8.0.77 (2025-01-14)

<!-- tag: 8.0.77 | target: 61ba4871258584087441eae8b42e17f033ecb274 | prerelease: false -->

- Fixed behaviour of getHealthcareParties due to change in backend (#175)

## 8.0.78 (2025-01-14)

<!-- tag: 8.0.78 | target: 9e2b50d281379bb37cd13b9dcd924c661170cc70 | prerelease: false -->

- Published 8.0.77
- Improved catch condition

## 8.0.79 (2025-01-20)

<!-- tag: 8.0.79 | target: 645187373a9d66e4a0bca7eef5f486bf8f9cc605 | prerelease: false -->

- Cache encrypted exchange keys, decrypt lazily

## 8.1.0 (2025-01-20)

<!-- tag: 8.1.0 | target: 8b40d289f1ffb0b0a8c76600ddb2bea4146806b8 | prerelease: false -->

- Add secret id use option
- Better secret id use options typing
- Better calendar item linking methods

## 8.1.1 (2025-01-22)

<!-- tag: 8.1.1 | target: f41cd8eea91928e10803d74217cddf05c5167246 | prerelease: false -->

- Added null check on binary value

## 8.0.80 (2025-01-23)

<!-- tag: 8.0.80 | target: 89031517388eb52b080015560418a23edce1a479 | prerelease: false -->

- Added null check on binary value

## 8.1.2 (2025-01-30)

<!-- tag: 8.1.2 | target: 24874e0b03cdfb3b936bcc74963e862560b3fbb4 | prerelease: false -->

- Add secret id use option
- Better secret id use options typing
- Better calendar item linking methods
- Added null check on binary value
- Published 8.1.1
- Additional test
- Added new SAM and Invoice endpoints (#176)

## 8.1.3 (2025-01-31)

<!-- tag: 8.1.3 | target: 472a2ff3c33c6d9d08e22226c8c99e61d44b65fc | prerelease: false -->

- Published 8.1.2 (#177)
- Add bulk get users
- Remove patientId from accesslog newInstance

## 8.1.4 (2025-02-06)

<!-- tag: v8.1.4 | target: e9347804c797299604ea2dcc363a6fddbd8ffc4c | prerelease: false -->

- Remove references to `patientId` in `AccessLog` (obsolete)
- `newInstance` method without patient for `AccessLog`
- Fix to filters model

## 8.1.5 (2025-02-10)

<!-- tag: 8.1.5 | target: 4b2f7a8d6e3afdaaf58c86dd8050aaf1edf8ca8d | prerelease: false -->

- Initialize api will not wait for exchange keys to be fully loaded before returning

## 8.1.6 (2025-02-17)

<!-- tag: 8.1.6 | target: 6e6a944f48cb11ec546aea85985a2beeedd894ca | prerelease: false -->

- Deprecated `IccFormApi.getFormTemplatesByGuid` method (to be removed in 8.2)
- Deprecated `IccTarificationApi.findTarifications` method (to be removed in 8.2)
- Support for generic crypto actor hierarchies

## 8.1.7 (2025-02-17)

<!-- tag: 8.1.7 | target: 417f1998f7aaab2d75aa3dbb264f9c99d2afbd17 | prerelease: false -->

- Add missing fields for Sam

## 8.1.8 (2025-02-18)

<!-- tag: 8.1.8 | target: 8d2444a659403089b59ad4855235fe60a0fe887b | prerelease: false -->

- Fixed encoding of big payloads in BeKmehrApi websocket: it was using a legacy method that was not encoding the content in utf-8, but in a masked utf-16.

## 8.1.9 (2025-02-18)

<!-- tag: 8.1.9 | target: 6553b5da925bd94e7f05a9031b438934a3956eab | prerelease: false -->

- Support for data created from keyless API

## 8.2.0 (2025-02-18)

<!-- tag: 8.2.0 | target: 28df2c6e7f3ab3f203465722ebe3f9c174b759c8 | prerelease: false -->

- New feature: keyless api mode https://github.com/icure/icure-typescript-sdk/pull/180

This update shouldn't have any breaking changes unless you use the keyless API mode. If you want to use keyless API mode make sure that all users in the environment are up-to-date (kraken-lite and @icure/api dependencies)

## 8.2.1 (2025-02-25)

<!-- tag: 8.2.1 | target: 0136fed200869e1483161da757ff8c77bea1ed61 | prerelease: false -->

- Fix: keyless api mode is now only available to anonymous data owners

## 8.2.2 (2025-03-07)

<!-- tag: 8.2.2 | target: 0662e22bab79a81d01c841cf58c9819616755155 | prerelease: false -->

Internal change: added automatic redirection of requests toward kmehr and sam to bypass the proxy done at the kraken level.

- Requests to `api.icure.cloud` will be redirected to `sam.icure.cloud` and `kmehr.icure.cloud`
- Requests to `nightly.icure.cloud` will be redirected to `sam-nightly.icure.cloud` and `kmehr-nightly.icure.cloud`
- Requests on localhost will never be redirected

## 8.2.3 (2025-03-07)

<!-- tag: 8.2.3 | target: e2c1a70c6aa4eb47cc8befe0c2046518c6d37abf | prerelease: false -->

hotfix: an import was wrongly added in `ExchangeDataManager.ts` that was breaking webpack:

```
import * as console from 'node:console'
```

The import was wrongly added by the IDE and as the changes in the file were very big in #180, it went unnoticed.

## 8.2.4 (2025-03-19)

<!-- tag: 8.2.4 | target: fc8dc1eb1af8958dc715f4c033c658269850af1c | prerelease: false -->

- Hotfix: removed useless import that was crashing webpack
- Added webpack compilation to yarn prepare
- Better doc, fixed repositories location

## 8.2.5 (2025-03-19)

<!-- tag: 8.2.5 | target: fc8dc1eb1af8958dc715f4c033c658269850af1c | prerelease: false -->

Maintenance release (version bump only).

## 8.2.6 (2025-03-19)

<!-- tag: 8.2.6 | target: fc8dc1eb1af8958dc715f4c033c658269850af1c | prerelease: false -->

Maintenance release (version bump only).

## 8.2.7 (2025-03-19)

<!-- tag: v8.2.7 | target: fc8dc1eb1af8958dc715f4c033c658269850af1c | prerelease: false -->

Recover corrupted JSONs by supporting native JS encoding when decoding document attachments.

Supersedes versions 8.2.4, 8.2.5, 8.2.6

## 8.2.8 (2025-04-02)

<!-- tag: 8.2.8 | target: 6ca91b559da6ae21821f95b65a254142607dd734 | prerelease: false -->

Add option `ignoreAutoDelegations` to `newInstance` methods

## 8.2.9 (2025-04-02)

<!-- tag: 8.2.9 | target: 770beb4f58be342f5896fa4adf282889568465d7 | prerelease: false -->

- Fix inverted conditions

## 8.3.1 (2025-04-10)

<!-- tag: 8.3.1 | target: b4691defd5a39048c8fcc4d0acdb321c75134443 | prerelease: false -->

## **BREAKING CHANGE** Fix TimeTable that should never have been encryptable in the first place.

Migration guide:

1. Import IccTimeTableApi instead of IccTimeTableXApi
2. replace timeTableApi.newInstance(new TimeTable({...})) by new TimeTable({...})
3. replace IccTimeTableXApi methods by corresponding IccTimeTableApi methods

## Add an endpoint enableFasAuthenticationForUser in user

This endpoints takes a BE FAS token and will consider the user to accept authentification with such token in the future by registering their SSIN in the identifier of the user.

## 8.2.10 (2025-04-16)

<!-- tag: 8.2.10 | target: b4691defd5a39048c8fcc4d0acdb321c75134443 | prerelease: false -->

_The commit this version was published from was never pushed to the repository. The release tag points at the previous version; the changes of this version are listed in the next version’s release notes._

## 8.3.2 (2025-04-16)

<!-- tag: 8.3.2 | target: 86d5f1af1f7cef09a225af7103036153d4fed6ff | prerelease: false -->

- Add method for be.fas registration and made timetable non encryptable
- Add all documents filter

## 8.2.11 (2025-04-18)

<!-- tag: 8.2.11 | target: f20444149a80dd15cb404a49c4c76a3a143484c3 | prerelease: false -->

- Automatic key recovery can also use parent keys

## 8.3.3 (2025-04-18)

<!-- tag: 8.3.3 | target: 96c0a6917e746f1dbab66760f696b739cbd715c0 | prerelease: false -->

- Improvement: automatic key recovery can also use parent keys

## 8.3.4 (2025-04-29)

<!-- tag: 8.3.4 | target: a6270cd128195f63f90db2321004fdc69c9b5a78 | prerelease: false -->

- Use parent keys when auto-recovering also before crypto strategies recover
- Exposes listPatientsSortedByName method + more doc

## 8.3.5 (2025-05-28)

<!-- tag: 8.3.5 | target: 9175e37d75c5bb6b7959f711469048a16f1a5170 | prerelease: false -->

- Lenient Content.binaryValue check: ignore empty objects

## 8.3.6 (2025-06-04)

<!-- tag: 8.3.6 | target: 4788b20680431b4ecec5e767b45b2c1e4cf0ac11 | prerelease: false -->

- Add digital-id and icure-cloud login options (#185)

## 8.4.0 (2025-06-05)

<!-- tag: 8.4.0 | target: 7544ea0ff336b9caf032fbda90783dcc7e37c4b4 | prerelease: false -->

- Fix tests
- Make document and message encryptable (#184)

## 8.4.1 (2025-06-24)

<!-- tag: 8.4.1 | target: eda11a070fb2a197b606781dfce7e9cda0f2abd3 | prerelease: false -->

- Add missing applicationId property and modifyApplicationId endpoint

## 8.4.2 (2025-07-07)

<!-- tag: 8.4.2 | target: 8f2f8c34a991514857fe2fd8c3aacfc06f795a9c | prerelease: false -->

- Make constructor idempotent when decoding ArrayBuffers + bump to 8.4.2

## 8.4.3 (2025-07-07)

<!-- tag: 8.4.3 | target: 010eab35bb54d4af76ec14a93394072e8604daa7 | prerelease: false -->

- Fix bad delete in Content constructor

## 8.4.4 (2025-07-07)

<!-- tag: 8.4.4 | target: 010eab35bb54d4af76ec14a93394072e8604daa7 | prerelease: false -->

Maintenance release (version bump only).

## 8.4.5 (2025-07-08)

<!-- tag: 8.4.5 | target: 0049593cb87d1cb746c99fe04a52432821861533 | prerelease: false -->

Maintenance release (version bump only).

## 8.4.6 (2025-07-11)

<!-- tag: 8.4.6 | target: e3a9c00605a7940f52a6d8fd2b08aa44c9fc4c4c | prerelease: false -->

- Add loginIdentifiers to user's metadata
- Fix: In icc-contact-x-api, make localize support uppercase languages (#188)
- Chore: Version bump

## 8.4.7 (2025-07-24)

<!-- tag: 8.4.7 | target: 6bd57898d77bc3ed3286b14c3e38214882747b8e | prerelease: false -->

- Added ValueWithPrecision

## 8.4.8 (2025-07-30)

<!-- tag: 8.4.8 | target: c727f20b110fa0401eb1214079798528d2f8e720 | prerelease: false -->

- Do not fail when we try to decrypt several times the exact same entity

## 8.4.9 (2025-08-25)

<!-- tag: 8.4.9 | target: 849fdca7c2ebf512833db9134c684a68da12a27d | prerelease: false -->

- Change to invoicing code

## 8.4.10 (2025-08-25)

<!-- tag: 8.4.10 | target: e976b283ed163ac5a4697d625b77abdd5c0497e0 | prerelease: false -->

- Added MessageByHcPartyTransportGuidFilter

## 8.4.11 (2025-08-25)

<!-- tag: 8.4.11 | target: d3a5c1371a5f081ffd82e8d872885eb4001db6be | prerelease: false -->

- Published 8.4.10

## 8.4.12 (2025-08-29)

<!-- tag: 8.4.12 | target: 04e3291f49d7c5723172e206e8afc0ee908e59cf | prerelease: false -->

- Fixed name
- Update tests
- Add revoke be.fas endpoint

## 8.4.13 (2025-08-29)

<!-- tag: 8.4.13 | target: 97a8b4e10157c1965e4f00d06b7c187287e50957 | prerelease: false -->

- Added method to get amp names by CNK

## 8.4.14 (2025-09-02)

<!-- tag: 8.4.14 | target: d41bcc55ed8865f6117816e2266f5cb136620901 | prerelease: false -->

- Published 8.4.13

## 8.4.15 (2025-09-05)

<!-- tag: 8.4.15 | target: 6c4e152a8944c0d4f41dcf0035900ee0f0b5f494 | prerelease: false -->

- Added purge document method
- Add new filters for services by month/patient and tag/code prefix

## 8.5.0 (2025-09-05)

<!-- tag: 8.5.0 | target: c0bcd0386c012f9934e15906dca108edeab1c0eb | prerelease: false -->

- Published 8.4.15
- Make application settings encryptable

## 8.5.1 (2025-09-10)

<!-- tag: 8.5.1 | target: 03863c9f1a16f57151e15295af840ca0fd397ace | prerelease: false -->

- Published 8.5.0
- Fix logging of never awaited rejected promise to console
- Published 8.5.1

## 8.5.2 (2025-09-19)

<!-- tag: v8.5.2 | target: 71377ee1d0d6ecbe2a160638e5c97b83067f788a | prerelease: false -->

**Full Changelog**: https://github.com/icure/icure-typescript-sdk/compare/8.4.7...v8.5.2

## 8.5.3 (2025-09-25)

<!-- tag: 8.5.3 | target: 71377ee1d0d6ecbe2a160638e5c97b83067f788a | prerelease: false -->

_The commit this version was published from was never pushed to the repository. The release tag points at the previous version; the changes of this version are listed in the next version’s release notes._

## 8.5.4 (2025-09-26)

<!-- tag: 8.5.4 | target: 9d39896740355b1b245972559cef0bcf62967c45 | prerelease: false -->

- Published 8.5.2
- Add missing filters

## 8.5.5 (2025-10-02)

<!-- tag: v8.5.5 | target: 8a9ee0cb0795eb57e13d0ac89fb4b45977a7fc8d | prerelease: false -->

- Add missing export for application settings X api
- Add service by hcparty tag/code prefix
- Published 8.5.5

## 8.5.6 (2025-10-03)

<!-- tag: v8.5.6 | target: bfb4c1478cb2cbf08ebe11396bb5201fa977391e | prerelease: false -->

- Try to get attachment of documents if not present in provided information during a SMF decryption session
- Publish version 8.5.6

## 8.5.7 (2025-10-09)

<!-- tag: 8.5.7 | target: a462c95a30d44b0d27e74a90373b0471d07de4fa | prerelease: false -->

- Add batch methods for tarification/code
- Publish new version

## 8.5.8 (2025-10-14)

<!-- tag: v8.5.8 | target: 15393e2e5ba619f0bddc72b31dd2dc425cdf6874 | prerelease: false -->

- Add missing ApplicationSettings to encrypted entity
- Publish version 8.5.8

## 8.5.9 (2025-10-17)

<!-- tag: 8.5.9 | target: 4bd02a8c77c6ce16f747f9239d1e1963ed5b5e58 | prerelease: false -->

- Add insurances batch endpoints

## 8.5.10 (2025-10-28)

<!-- tag: 8.5.10 | target: 7b990eb316fae2af769d0d2933ed7796e663e4dc | prerelease: false -->

- Add matchBy for codes and tarification (add AllPricingFilter).

## 8.5.11 (2025-10-30)

<!-- tag: 8.5.11 | target: 62def0d06fa3288fd04ca2212d76fa28dd907753 | prerelease: false -->

- Add missing filter and bump version

## 8.5.12 (2025-10-30)

<!-- tag: v8.5.12 | target: ed3da57fd8a79fd37dc3a068b63a1c6974b1f838 | prerelease: false -->

**Full Changelog**: https://github.com/icure/icure-typescript-sdk/compare/v8.5.2...v8.5.12

## 8.5.13 (2025-11-04)

<!-- tag: v8.5.13 | target: cfed91df7e6d50d21bc9916acc0920358a1c36e5 | prerelease: false -->

**Full Changelog**: https://github.com/icure/icure-typescript-sdk/compare/v8.5.12...v8.5.13

## 8.5.14 (2025-11-07)

<!-- tag: 8.5.14 | target: 07c64ce10dd17d304c5a65c12bfb4865d2209265 | prerelease: false -->

- Bump version to 6.5.13
- Feat: Added Medication stockLocation field (#189)
- Chore: Version bump

## 8.6.0 (2025-11-21)

<!-- tag: 8.6.0 | target: 3bf54e5151808890bbb7bde1b69b2275c4542a26 | prerelease: false -->

- Feat: Added Contact's participantList (#190)
- Chore: Version bump

## 8.6.1 (2025-11-21)

<!-- tag: 8.6.1 | target: f7b409eb65b337e192d54b7f889c46718ceab5ff | prerelease: false -->

- Fix: Corrected hcpId type from String to string in ContactParticipant
- Chore: Bump version to 8.6.1

## 8.6.2 (2025-12-15)

<!-- tag: v8.6.2 | target: 5eea7e3234eb4d798896d8d4a22fc6f75ad7e754 | prerelease: false -->

- Add shortcuts to access accessLog, icure and pricing apis from the basic api

## 8.6.3 (2025-12-15)

<!-- tag: v8.6.3 | target: 3129797edf407c3706d2bf9d2c8e0f7feef9c2af | prerelease: false -->

<!-- Release notes generated using configuration in .github/release.yml at release/v8 -->

## What's Changed

### New Features 🎉

- feat: Added Medication stockLocation field by @LotuxPunk in https://github.com/icure/icure-typescript-sdk/pull/189
- feat: Added Contact's participantList by @LotuxPunk in https://github.com/icure/icure-typescript-sdk/pull/190
- improvement: Add AccessLog, Pricing and iCure apis in basic apis

**Full Changelog**: https://github.com/icure/icure-typescript-sdk/compare/v8.5.13...v8.6.2

## 8.6.4 (2026-01-09)

<!-- tag: 8.6.4 | target: 08f4a33c07758563a39ac57c09b9a7643d3c17cb | prerelease: false -->

- Add deprecation for createdDate
- Add new filters for health elements
- Type safe buffers, fix ua2ab when buffer view has offset
- Bump version to 8.6.3

## 8.6.5 (2026-02-04)

<!-- tag: 8.6.5 | target: 4e5f1f2d70b6862d9d0b91a86cc5d2160e588df7 | prerelease: false -->

- Expose cryptoActorProperties in CryptoActor entities
- Allow to override default behaviour of recovered key is always trusted

## 8.6.6 (2026-02-09)

<!-- tag: 8.6.6 | target: 2b2945f782d58b185702258e1e8a183d43dd55c3 | prerelease: false -->

- Add form template InGroup and batch operations with tests
- Add JSDoc documentation and update test infrastructure

## 8.6.7 (2026-02-17)

<!-- tag: 8.6.7 | target: a30336fbdb23c3f6f10a5c00863f473ea49cfcb4 | prerelease: false -->

- Add getFormTemplatesBySpecialtyInGroup API method and test

## 8.6.8 (2026-02-20)

<!-- tag: 8.6.8 | target: 09ee8bb68457786eef84321b46dddb70d997fe27 | prerelease: false -->

- Idempotent re-encryption (#192)
- Add getFormTemplatesBySpecialtyInGroup API method and test
- Add ChapterParagraph class and integrate with Reimbursement model
- Added match and matchInGroup for AccessLogs

## 8.6.9 (2026-02-25)

<!-- tag: 8.6.9 | target: 0b8b7a6e1705da11ecbab08770f120cac2174d86 | prerelease: false -->

- Published 8.6.8
- Add missing FormApi to BasicApis interface and IcureBasicApiImpl

## 8.6.10 (2026-03-16)

<!-- tag: v8.6.10 | target: 988e8451191d3827a51ab22dc4ec8881869194b5 | prerelease: false -->

<!-- Release notes generated using configuration in .github/release.yml at release/v8 -->

## What's Changed

### Other Changes ⚙️

- Idempotent re-encryption by @trema96 in https://github.com/icure/icure-typescript-sdk/pull/192
- Add raw option for form templates and domain property to Tarification by @aduchate in https://github.com/icure/icure-typescript-sdk/pull/193

**Full Changelog**: https://github.com/icure/icure-typescript-sdk/compare/v8.6.3...v8.6.10

## 8.6.11 (2026-03-19)

<!-- tag: 8.6.11 | target: e6c77f508740abe28bcf87169f65f44b554ef85e | prerelease: false -->

- Add resolve codes conflicts endpoint

## 8.6.12 (2026-04-01)

<!-- tag: 8.6.12 | target: 6402058744100db420362c4e00e3bd740a554b88 | prerelease: false -->

- Added missing parameters to start SAM patch

## 8.6.13 (2026-04-02)

<!-- tag: 8.6.13 | target: a196d8157e2fc0ed476d8fa5160aaa1e0708ad89 | prerelease: false -->

- Fix Idempotent re-encryption breaking when a value in the encryptedSelf object or its child is explicitly set to null

## 8.6.14 (2026-04-07)

<!-- tag: 8.6.14 | target: 01462a1dce475188d4703f609735a089c7e83dc3 | prerelease: false -->

- Add missing filterServicesByWithUser and patientIdOfService

## 8.6.15 (2026-04-13)

<!-- tag: 8.6.15 | target: 0666e6511d5455229febef340c32c93e3f4f3dea | prerelease: false -->

- Add exact-match service filters and date range support for prefix filters

## 8.6.17 (2026-04-14)

<!-- tag: 8.6.17 | target: f0f9af4569101d076d199d42f13b2c2644d0ce0f | prerelease: false -->

- Allow for response headers collection

## 8.6.18 (2026-04-14)

<!-- tag: 8.6.18 | target: f0f9af4569101d076d199d42f13b2c2644d0ce0f | prerelease: false -->

Maintenance release (version bump only).

## 8.6.19 (2026-04-14)

<!-- tag: 8.6.19 | target: 57e8816e513742e814feda84b0190a22176fd692 | prerelease: false -->

- Allow for timing of filter through headers collection
- Fix fetchImpl passing

## 8.7.0 (2026-04-17)

<!-- tag: 8.7.0 | target: 8ca4d598db3157d350d0c0385447323e2582c163 | prerelease: false -->

- Add receipt attachments, LZMA compression for receipts and documents, and remove heavy dependencies
- Refactor code to simplify data processing for ICD and ICPC collections
- Extracted icdChapters() and icpcChapters() as standalone functions in icc-x-api/utils/code-util.ts, taking the reference data as a parameter instead of reading this.icd10/this.icpc2 - Simplified IccCodeXApi methods to one-line delegates: Promise.resolve(icdChapters(listOfCodes, this.icd10)) - Add tests
- Simplify imports
- Fix doc
- Fix publish

## 8.7.1 (2026-04-23)

<!-- tag: 8.7.1 | target: 0207bc7ac64e3f5c144cb68506716b58861b272c | prerelease: false -->

- Fix toMoment

## 8.7.2 (2026-05-11)

<!-- tag: 8.7.2 | target: c96e7cddc82682c96aabc8b3be5c90b1f72f4de8 | prerelease: false -->

- Convert moment format strings in toMoment

## 8.7.3 (2026-05-13)

<!-- tag: 8.7.3 | target: 460d60a4636caaa06f397a443dd40ef10765da2d | prerelease: false -->

- Make formatting lenient to undefined/null

## 8.8.0 (2026-06-16)

<!-- tag: 8.8.0 | target: 3b29f95f06011e269b03bce31d919266259f0418 | prerelease: false -->

- Added methods to solve conflicts (#195)
- Bumped version to 8.8.0

## 8.8.1 (2026-06-16)

<!-- tag: 8.8.1 | target: 3b29f95f06011e269b03bce31d919266259f0418 | prerelease: false -->

Maintenance release (version bump only).

## 8.8.2 (2026-06-17)

<!-- tag: 8.8.2 | target: 4c70dc2f556874dbb44ac7c9158230e4ad702007 | prerelease: false -->

- Accept numbers and strings for date encode and time encode

## 8.8.3 (2026-06-18)

<!-- tag: 8.8.3 | target: 73983e51249b934173ec1be899f5880328fd8f7f | prerelease: false -->

Maintenance release (version bump only).

## 8.8.4 (2026-06-18)

<!-- tag: 8.8.4 | target: dff0db262c4d3a966803b9cc0de95633f69aa876 | prerelease: false -->

- Make date utils more resilient, fix build on esbuild and bump version

## 8.8.5 (2026-06-23)

<!-- tag: 8.8.5 | target: 0f726b78fe20713247aac94a7709d61f1f917b0e | prerelease: false -->

- Updated getConflictsForEntity endpoint

## 8.8.6 (2026-06-25)

<!-- tag: 8.8.6 | target: 776d305f87ff4d69a69bba73d6a6c5509e8b2387 | prerelease: false -->

- Make date utils more compatible/resilient and bump version

## 8.9.0 (2026-06-26)

<!-- tag: 8.9.0 | target: f5b39f00774e1ad45e312fb18f5b000ec92c036e | prerelease: false -->

- Added auto solve conflicts method

## 8.9.1 (2026-07-08)

<!-- tag: 8.9.1 | target: 30b843ac293588f60c8dd1c7c8ce1e509d63cb2e | prerelease: false -->

- Force content type application/octet-stream for receipt attachments
- Minor improvements to attachment compression: avoid double copy if input is a shared array buffer

## 8.9.2 (2026-07-10)

<!-- tag: 8.9.2 | target: ccb62d6d00adc098f99d0bd8364356403f1437b8 | prerelease: false -->

- Do not throw on undecrypted receipt attachments when the receipt has no encryption metadata

## 8.8.7 (2026-07-14)

<!-- tag: 8.8.7 | target: 352c1f4e26ce3781c463b47f17b6a8982ee719f0 | prerelease: false -->

- Fixed ArrayBuffer issue in cloneDeep (backport to 8.8)

## 8.9.3 (2026-07-14)

<!-- tag: 8.9.3 | target: bb53b894d61ddd9466f80d0ef12036b058f14019 | prerelease: false -->

- Fixed ArrayBuffer issue in cloneDeep

## 8.10.0 (2026-07-15)

<!-- tag: 8.10.0 | target: f77a9278f39c47ab761a2d1bcb2a7c870134675f | prerelease: false -->

- Added `returnNonDecrypted` option to receipt attachment decryption methods: when set, an attachment that should have been encrypted but could not be decrypted is returned as is instead of throwing. Note: the new parameter is inserted before `validator`, so callers passing a validator positionally to `getAndDecryptReceiptAttachment` or `getAndDecryptReceiptDataAttachment` must be updated.
- Added tests for cloning of objects with ByteArray structures

## 8.10.1 (2026-07-22)

<!-- tag: 8.10.1 | target: 1d6c319a17a90efa583b402f9dbd7a6caecc26b8 | prerelease: false -->

- Removed manual Content-Length header from receipt attachment upload

## 8.10.2 (2026-07-22)

<!-- tag: 8.10.2 | target: 4591273cdc38253dcac7586e6b230f8e74951302 | prerelease: false -->

- Added contentLength/contentType query parameter hints to receipt attachment uploads

## 8.11.0 (2026-08-06)

<!-- tag: 8.11.0 | target: cdf08904d917301187c84d0b24b28d32a3a53133 | prerelease: false -->

- Add new optimizations to "share" methods to avoid adding redundant delegations when possible: the SDK will now try to decrypt all delegations that are directly accessible to the target delegates and readable to the current SDK (directly or indirectly); any data of the share request already accessible through those delegations will be ignored, and if all data is already accessible to all delegates the share request will be a no-op
- Expose omitEncryptionKeysOfFrom in method of baseMergePatient: now used explicitly in merge patient method, no change since kraken consider it as true by default if not provided


## 8.12.0 (2026-08-07)

<!-- tag: 8.12.0 | target: 82f00619afc7717d490d1be28a601749bf6ed0ca | prerelease: false -->

- Added HealthElementByAssociationIdFilter and HealthElementByQualifiedLinkFilter
- Added HealthElementQualifiedLink and corresponding property in HealthElement
