// Uses fp as node names
import { acyclic, graphFromEdges, StronglyConnectedGraph } from '../utils/graph-utils'
import { DataOwner } from '../icc-data-owner-x-api'

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
  Object.entries(dataOwner.transferKeys ?? {}).map(([from, tos]) => {
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
