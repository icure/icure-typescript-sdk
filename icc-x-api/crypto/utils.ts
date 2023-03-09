// Uses fp as node names
import { acyclic, graphFromEdges, StronglyConnectedGraph } from '../utils/graph-utils'
import { DataOwner, DataOwnerTypeEnum, DataOwnerWithType, IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { RSAUtils } from './RSA'
import { hex2ua } from '../utils'
import { HealthcareParty } from '../../icc-api/model/HealthcareParty'
import { Patient } from '../../icc-api/model/Patient'
import { Device } from '../../icc-api/model/Device'
import { EntitiesEncryption } from './EntitiesEncryption'
import { CryptoPrimitives } from './CryptoPrimitives'
import { Delegation, EncryptedEntityStub } from '../../icc-api/model/models'
import { setEquals } from '../utils/collection-utils'
import { SecurityMetadata } from '../../icc-api/model/SecurityMetadata'

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
  entitiesEncryption: EntitiesEncryption,
  cryptoPrimitives: CryptoPrimitives
): Promise<DataOwnerWithType> {
  const self = await dataOwnerApi.getCurrentDataOwner()
  if (self.type === DataOwnerTypeEnum.Patient) {
    const patient: Patient & DataOwner = self.dataOwner
    const availableSecretIds = await entitiesEncryption.secretIdsOf(patient)
    if (availableSecretIds.length) {
      return self
    } else {
      const updatedPatient =
        Object.entries(patient.encryptionKeys ?? {}).length || Object.entries(patient.delegations ?? {}).length
          ? await entitiesEncryption.entityWithExtendedEncryptedMetadata(
              // If there is already something initialise only a new delegation to self
              patient,
              patient.id!,
              [cryptoPrimitives.randomUuid()],
              [],
              []
            ) // else initialise also encryption keys
          : await entitiesEncryption.entityWithInitialisedEncryptedMetadata(patient, undefined, undefined, true).then((x) => x.updatedEntity)
      return await dataOwnerApi.updateDataOwner({
        dataOwner: updatedPatient,
        type: DataOwnerTypeEnum.Patient,
      })
    }
  } else {
    return self
  }
}

/**
 * Verifies that two encrypted stubs are equivalent.
 */
export function encryptedStubEquals(a: EncryptedEntityStub, b: EncryptedEntityStub): boolean {
  if (a.encryptedSelf !== b.encryptedSelf) return false
  if (!setEquals(new Set(a.secretForeignKeys), new Set(b.secretForeignKeys))) return false
  if (!delegationLikeEquality(a.delegations, b.delegations)) return false
  if (!delegationLikeEquality(a.encryptionKeys, b.encryptionKeys)) return false
  if (!delegationLikeEquality(a.cryptedForeignKeys, b.cryptedForeignKeys)) return false
  return securityMetadataEquals(a.securityMetadata, b.securityMetadata)
}

function securityMetadataEquals(a: SecurityMetadata | undefined, b: SecurityMetadata | undefined): boolean {
  if (!!a !== !!b) return false
  throw new Error('TODO')
}

function delegationLikeEquality(a: { [s: string]: Delegation[] } | undefined, b: { [s: string]: Delegation[] } | undefined): boolean {
  if (!setEquals(new Set(Object.keys(a ?? {})), new Set(Object.keys(b ?? {})))) return false
  for (const [k, aDelegations] of Object.entries(a ?? {})) {
    const bDelegations = (b ?? {})[k]
    if (
      !aDelegations.every(
        (da) =>
          !!bDelegations.find(
            (db) => da.key === db.key && da.delegatedTo === db.delegatedTo && da.owner === db.owner && setEquals(new Set(da.tags), new Set(db.tags))
          )
      )
    )
      return false
  }
  return true
}
