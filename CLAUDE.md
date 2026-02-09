# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the iCure TypeScript SDK - a client library for the iCure healthcare platform. The SDK provides encrypted healthcare data management with sophisticated cryptographic delegation and access control mechanisms.

## Build Commands

### Development
- `yarn build` - Compile TypeScript to JavaScript (outputs to `dist/`)
- `yarn test` - Run all tests with nyc coverage (60s timeout)
- `yarn prepare` - Full build pipeline: clean dist, compile, generate package.json, and test webpack build
- `yarn clean` - Run cleanup script via ts-node

### Testing
- Run specific test: `mocha "test/path/to/test.ts" --require ts-node/register --require source-map-support/register --timeout=60000`
- Run test pattern: `mocha "test/**/*pattern*.ts" --require ts-node/register --timeout=60000`

## Architecture

### Two-Layer Structure

**icc-api/** - Auto-generated base API layer
- Contains `IccXxxApi` classes (e.g., `IccPatientApi`, `IccContactApi`)
- Generated from OpenAPI specifications via Swagger Codegen
- Simple request/response handling with no encryption logic
- Located in `icc-api/api/` (APIs) and `icc-api/model/` (models)

**icc-x-api/** - Extended API layer with cryptography
- Contains `IccXxxXApi` classes (e.g., `IccPatientXApi`, `IccContactXApi`)
- Wraps base APIs with encryption, delegation management, and access control
- Implements healthcare-specific crypto patterns (delegations, encrypted fields)
- Main entry point: `icc-x-api/index.ts` exports `IcureApi` and `IcureBasicApi`

### Key Subsystems

**Cryptography System** (`icc-x-api/crypto/`)
- `CryptoPrimitives` - Low-level crypto operations (AES, RSA, HMAC)
- `UserEncryptionKeysManager` - Manages keypairs for current user and parent hierarchy
- `ExchangeKeysManager` - Manages encryption keys for data exchange between data owners
- `ExchangeDataManager` - Handles encrypted exchange data for secure delegations
- `SecureDelegationsManager` - Creates and manages secure delegations with access control
- `CryptoStrategies` - Customizable hooks for key recovery and verification

**Authentication** (`icc-x-api/auth/`)
- `NoAuthenticationProvider` - No auth headers (uses SESSION cookies)
- `BasicAuthenticationProvider` - HTTP Basic authentication
- `JwtAuthenticationProvider` - JWT token management with automatic refresh
- `EnsembleAuthenticationProvider` - Falls back through multiple auth methods
- `SmartAuthProvider` - Dynamic secret provider with automatic token refresh

**Storage** (`icc-x-api/storage/`)
- `StorageFacade` - Generic string storage interface
- `KeyStorageFacade` - Cryptographic key storage interface
- `LocalStorageImpl` - Browser localStorage implementation
- `IcureStorageFacade` - Unified storage for keys and data

### Encryption Model

iCure uses a complex delegation-based encryption scheme:

**Delegations** - Link encrypted documents to patients
- Patient stores encrypted secretForeignKeys: `{ A->A: <ABCD>_{AA}, A->B: <ABCD>_{AB} }`
- Contact stores those keys in clear: `SecretForeignKeys: ["ABCD"]`
- This allows finding all contacts for a patient

**CryptedForeignKeys** - Link documents back to patients
- Contact stores encrypted patient ID: `{ A->A: <1234>_{AA}, A->B: <1234>_{AB} }`
- This allows finding the patient for a contact

**EncryptionKeys** - Protect document content
- Each document has encrypted keys for actual data encryption
- Multiple data owners can have access via different encrypted copies

**HcPartyKeys** - Manage delegation keys
- Stored in the delegating HCP's document
- Format: `{ A: [<{AA}>_A], B: [<{AB}>_A, <{AB}>_B] }`
- HCP A gives delegation to HCP B using these keys

### Entity Types

**Encrypted entities**: Patient, Contact (with Services), HealthElement, Document, Form, Invoice, CalendarItem, AccessLog, Message, Topic, MaintenanceTask

**Encrypted field configuration**: Each entity type has configurable encrypted fields defined in `EncryptedFieldsConfig` (see `icc-x-api/index.ts`). Default configurations are in `EncryptedFieldsConfig.Defaults`.

## Testing Patterns

Tests are organized by component:
- `test/icc-api/` - Base API tests
- `test/icc-x-api/` - Extended API tests
- `test/icc-x-api/crypto/` - Cryptography tests
- `test/icc-x-api/auth/` - Authentication tests
- `test/utils/` - Test utilities and fakes

Use `@icure/test-setup` for test fixtures and environment setup.

## Code Style

- Prettier configured: no semicolons, 150 char width, single quotes
- TypeScript strict mode enabled
- Format on commit via pretty-quick pre-commit hook

## Important Notes

- All crypto operations must go through `CryptoPrimitives` for platform compatibility
- Multi-group support: users can belong to multiple groups, API instances are group-specific
- Parent hierarchy: data owners can have parent relationships affecting key management
- Anonymous delegations: some data owners require anonymous delegation patterns

## Package Manager

Uses Yarn 3.8.7 (specified in packageManager field)
