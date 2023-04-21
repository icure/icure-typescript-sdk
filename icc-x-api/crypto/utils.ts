// Uses fp as node names
import { acyclic, graphFromEdges, StronglyConnectedGraph } from '../utils/graph-utils'
import { DataOwner, DataOwnerTypeEnum, DataOwnerWithType, IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { RSAUtils } from './RSA'
import { hex2ua } from '../utils'
import { Patient } from '../../icc-api/model/Patient'
import { ExtendedApisUtils } from './ExtendedApisUtils'
import { CryptoPrimitives } from './CryptoPrimitives'
import { EncryptedEntityWithType } from '../utils/EntityWithDelegationTypeName'
import { IccPatientApi } from '../../icc-api'
import { ShareMetadataBehaviour } from './ShareMetadataBehaviour'
import { EntityShareRequest } from '../../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum

/**
 * @internal this function is meant only for internal use and may be changed without notice.
 * Get the public keys of a data owner, same as {@link dataOwnerApi.getHexPublicKeysOf}.
 * @param dataOwner
 */
export function hexPublicKeysOf(dataOwner: DataOwner) {
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
  const publicKeys = Array.from(hexPublicKeysOf(dataOwner))
  const edges: [string, string][] = []
  Object.entries(dataOwner.transferKeys ?? {}).forEach(([from, tos]) => {
    Object.keys(tos).forEach((to) => {
      edges.push([from.slice(-32), to.slice(-32)])
    })
  })
  return acyclic(
    graphFromEdges(
      edges,
      publicKeys.map((x) => x.slice(-32))
    )
  )
}

/**
 * @internal this function is meant only for internal use and may be changed without notice.
 * Get a map for converting public keys fingerprint to full public keys for the provided data owner.
 * @param dataOwner a data owner.
 * @return a map to convert fingerprints of the data owner into full public keys.
 */
export function fingerprintToPublicKeysMapOf(dataOwner: DataOwner): { [fp: string]: string } {
  const publicKeys = Array.from(hexPublicKeysOf(dataOwner))
  const res: { [fp: string]: string } = {}
  publicKeys.forEach((pk) => {
    res[pk.slice(-32)] = pk
  })
  return res
}

/**
 * @internal this function is meant only for internal use and may be changed without notice.
 * Load many public keys in spki format.
 * @param rsa the rsa service
 * @param publicKeysSpkiHex public keys in spki format, hex encoded.
 * @return public keys as crypto keys by their fingerprint.
 */
export async function loadPublicKeys(rsa: RSAUtils, publicKeysSpkiHex: string[]): Promise<{ [publicKeyFingerprint: string]: CryptoKey }> {
  return Object.fromEntries(
    await Promise.all(publicKeysSpkiHex.map(async (x) => [x.slice(-32), await rsa.importKey('spki', hex2ua(x), ['encrypt'])]))
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
  if (self.type === DataOwnerTypeEnum.Patient) {
    const patient = new Patient(self.dataOwner)
    const patientWithType: EncryptedEntityWithType = { entity: patient, type: 'Patient' }
    const availableSecretIds = await xapi.secretIdsOf(patientWithType, undefined)
    if (availableSecretIds.length) {
      return self
    } else {
      if (xapi.hasEmptyEncryptionMetadata(patient)) {
        // This should not really happen, usually some user will have already initialised the patient and its encryption metadata.
        const updatedPatient = await xapi.entityWithInitialisedEncryptedMetadata(patient, 'Patient', undefined, undefined, true, true, {})
        return await dataOwnerApi.updateDataOwner(
          IccDataOwnerXApi.instantiateDataOwnerWithType(updatedPatient.updatedEntity, DataOwnerTypeEnum.Patient)
        )
      } else {
        const updatedPatient = await xapi.simpleShareOrUpdateEncryptedEntityMetadata(
          { entity: patient, type: 'Patient' },
          patient.id!,
          ShareMetadataBehaviour.IF_AVAILABLE,
          ShareMetadataBehaviour.NEVER,
          [cryptoPrimitives.randomUuid()],
          RequestedPermissionEnum.FULL_WRITE,
          (x) => patientApi.bulkSharePatients(x)
        )
        return { dataOwner: updatedPatient.updatedEntityOrThrow, type: DataOwnerTypeEnum.Patient }
      }
    }
  } else {
    return self
  }
}
