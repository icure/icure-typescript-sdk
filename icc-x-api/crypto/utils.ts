// Uses fp as node names
import { acyclic, graphFromEdges, StronglyConnectedGraph } from '../utils/graph-utils'
import { DataOwner, DataOwnerWithType, IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { RSAUtils, ShaVersion } from './RSA'
import { hex2ua } from '../utils'
import { Patient } from '../../icc-api/model/Patient'
import { ExtendedApisUtils } from './ExtendedApisUtils'
import { CryptoPrimitives } from './CryptoPrimitives'
import { EncryptedEntityWithType } from '../utils/EntityWithDelegationTypeName'
import { IccPatientApi } from '../../icc-api'
import { ShareMetadataBehaviour } from './ShareMetadataBehaviour'
import { EntityShareRequest } from '../../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { HealthcareParty } from '../../icc-api/model/HealthcareParty'
import { Device } from '../../icc-api/model/Device'

/**
 * @internal this function is meant only for internal use and may be changed without notice.
 * Get the public keys of a data owner that are generated using SHA-256 OAEP.
 * @param dataOwner
 */
export function hexPublicKeysWithSha256Of(dataOwner: DataOwner) {
  return new Set([...(dataOwner.publicKeysForOaepWithSha256 ?? [])].filter((pubKey) => !!pubKey) as string[])
}

/**
 * @internal this function is meant only for internal use and may be changed without notice.
 * Get the public keys of a data owner, same as {@link dataOwnerApi.getHexPublicKeysOf}.
 * @param dataOwner
 */
export function hexPublicKeysWithSha1Of(dataOwner: DataOwner) {
  return new Set([dataOwner.publicKey, ...Object.keys(dataOwner.aesExchangeKeys ?? {})].filter((pubKey) => !!pubKey) as string[])
}

/**
 * @internal this function is meant only for internal use and may be changed without notice.
 * Get the transfer key graph for a data owner. Node names are the public key fingerprints of the data owner's keys, and an edge represents a key
 * which can be retrieved from another key using the transfer keys.
 * @param dataOwner a data owner.
 * @return a graph representing the possible key recovery paths using transfer keys for hte provided data owner.
 */
export function transferKeysFpGraphOf(dataOwner: DataOwner): StronglyConnectedGraph {
  const publicKeys = Array.from([...hexPublicKeysWithSha1Of(dataOwner), ...hexPublicKeysWithSha256Of(dataOwner)])
  const edges: [string, string][] = []
  Object.entries(dataOwner.transferKeys ?? {}).forEach(([from, tos]) => {
    Object.keys(tos).forEach((to) => {
      edges.push([fingerprintV1(from), fingerprintV1(to)])
    })
  })
  return acyclic(
    graphFromEdges(
      edges,
      publicKeys.map((x) => fingerprintV1(x))
    )
  )
}

/**
 * @internal this function is meant only for internal use and may be changed without notice.
 * Get a map for converting public keys fingerprint to full public keys for the provided data owner.
 * @param dataOwner a data owner.
 * @param shaVersion gets only the keys that are generated with this SHA version (default: 'sha-1').
 * @return a map to convert fingerprints of the data owner into full public keys.
 */
export function fingerprintToPublicKeysMapOf(dataOwner: DataOwner, shaVersion: ShaVersion): { [fp: string]: string } {
  const publicKeys = shaVersion === 'sha-1' ? Array.from(hexPublicKeysWithSha1Of(dataOwner)) : Array.from(hexPublicKeysWithSha256Of(dataOwner))
  const res: { [fp: string]: string } = {}
  publicKeys.forEach((pk) => {
    res[fingerprintV1(pk)] = pk
  })
  return res
}

/**
 * @internal this function is meant only for internal use and may be changed without notice.
 * Load many public keys in spki format.
 * @param rsa the rsa service
 * @param publicKeysSpkiHex public keys in spki format, hex encoded.
 * @param shaVersion the version of the Sha algorithm used in the keys generations. ()
 * @return public keys as crypto keys by their fingerprint.
 */
export async function loadPublicKeys(
  rsa: RSAUtils,
  publicKeysSpkiHex: string[],
  shaVersion: ShaVersion
): Promise<{ [publicKeyFingerprint: string]: CryptoKey }> {
  return Object.fromEntries(
    await Promise.all(publicKeysSpkiHex.map(async (x) => [fingerprintV1(x), await rsa.importKey('spki', hex2ua(x), ['encrypt'], shaVersion)]))
  )
}

/**
 * @internal This method is intended only for internal use and may be changed without notice.
 * Creates a delegation for the current data owner if the data owner is an encrypted entity and there is no delegation to himself.
 * @return the updated self.
 */
export async function ensureDelegationForSelf(
  dataOwnerApi: IccDataOwnerXApi,
  xapi: ExtendedApisUtils,
  patientApi: IccPatientApi,
  cryptoPrimitives: CryptoPrimitives
): Promise<DataOwnerWithType> {
  const self = await dataOwnerApi.getCurrentDataOwner()
  if (self.type === 'patient') {
    const patient = new Patient(self.dataOwner)
    const patientWithType: EncryptedEntityWithType = { entity: patient, type: 'Patient' }
    const availableSecretIds = await xapi.secretIdsOf(patientWithType, undefined)
    if (availableSecretIds.length) {
      return self
    } else {
      if (xapi.hasEmptyEncryptionMetadata(patient)) {
        // This should not really happen, usually some user will have already initialised the patient and its encryption metadata.
        const updatedPatient = await xapi.entityWithInitialisedEncryptedMetadata(patient, 'Patient', undefined, undefined, true, true, {})
        return await dataOwnerApi.updateDataOwner(IccDataOwnerXApi.instantiateDataOwnerWithType(updatedPatient.updatedEntity, 'patient'))
      } else {
        const updatedPatient = await xapi.simpleShareOrUpdateEncryptedEntityMetadata(
          { entity: patient, type: 'Patient' },
          false,
          {
            [patient.id!]: {
              shareEncryptionKeys: ShareMetadataBehaviour.IF_AVAILABLE,
              shareOwningEntityIds: ShareMetadataBehaviour.NEVER,
              shareSecretIds: [cryptoPrimitives.randomUuid()],
              requestedPermissions: RequestedPermissionEnum.FULL_WRITE,
            },
          },
          (x) => patientApi.bulkSharePatients(x)
        )
        return { dataOwner: updatedPatient.updatedEntityOrThrow, type: 'patient' }
      }
    }
  } else {
    return self
  }
}

/**
 * @internal This method is intended only for internal use and may be changed without notice.
 * Search a public key in the data owner and returns the corresponding SHA version used to generate it or undefined if not found.
 * @param dataOwner the data owner.
 * @param publicKey the public key.
 * @return 'sha-1', 'sha-256', undefined
 */
export function getShaVersionForKey(dataOwner: Patient | HealthcareParty | Device, publicKey: string) {
  return dataOwner.publicKey === publicKey || Object.keys(dataOwner.aesExchangeKeys ?? {}).includes(publicKey)
    ? 'sha-1'
    : !!dataOwner.publicKeysForOaepWithSha256?.includes(publicKey)
    ? 'sha-256'
    : undefined
}

/**
 * @internal this function is meant only for internal use and may be changed without notice.
 * Calculates the fingerprint from the hexadecimal representation of a SPKI key. The fingerprint is calculated as the last 16 bytes (32 characters)
 * of the SPKI key.
 * @param key the hexadecimal representation of the SPKI key.
 * @return the fingerprint.
 */
export function fingerprintV1(key: string): string {
  return key.slice(-32)
}

/**
 * @internal this function is meant only for internal use and may be changed without notice.
 * Calculates the fingerprint from the hexadecimal representation of a SPKI key. The fingerprint is calculated as the last 16 bytes (32 characters) from which the
 * last 5 (10 characters) are removed because they are a constant of the SPKI format.
 * @param key the hexadecimal representation of the SPKI key.
 * @return the fingerprint.
 */
export function fingerprintV2(key: string): string {
  return key.slice(-32, -10)
}

/**
 * @internal this function is meant only for internal use and may be changed without notice.
 * Converts the fingerprint of a key from a V1 format to a V2 format.
 * @param fp the fingerprint of the key in the V1 format.
 * @return the fingerprint of the key in the v2 format.
 */
export function fingerprintV1toV2(fp: string): string {
  return fp.slice(0, -10)
}

/**
 * @internal this function is meant only for internal use and may be changed without notice.
 * @param fp the fingerprint.
 * @return true if the fingerprint is in V1 format, false otherwise.
 */
export function fingerprintIsV1(fp: string): boolean {
  return fp.length === 32
}

/**
 * @internal this function is meant only for internal use and may be changed without notice.
 * @param fp the fingerprint.
 * @return true if the fingerprint is in V2 format, false otherwise.
 */
export function fingerprintIsV2(fp: string): boolean {
  return fp.length === 22
}
