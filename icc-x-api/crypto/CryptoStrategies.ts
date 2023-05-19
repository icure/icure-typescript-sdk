import { KeyPair } from './RSA'
import { CryptoPrimitives } from './CryptoPrimitives'
import { DataOwnerWithType } from '../../icc-api/model/DataOwnerWithType'
import { CryptoActorStubWithType } from '../../icc-api/model/CryptoActorStub'

/**
 * Allows to customise the behaviour of the crypto api to better suit your needs.
 *
 * An important task which should be done in these crypto strategies is public key verification: in general there is no guarantee that the public keys
 * stored in the iCure database are authentic, i.e. created by the data owner they are associated to. This is because the database admins or a
 * malicious attacker may have added his own public keys to the data owner's public keys.
 * Sharing any kind of data using unverified public keys could potentially cause a data leak: this is why when creating new exchange keys or when
 * creating recovery data only verified keys will be considered. For decrypting existing data instead unverified keys will be used without issues.
 */
export interface CryptoStrategies {
  /**
   * Method called during initialisation of the crypto API to validate keys recovered through iCure's recovery methods and/or to allow recovery of
   * missing keys using means external to iCure.
   * On startup the iCure sdk will try to load all keys for the current data owner and its parent hierarchy: if the sdk can't find some of the keys
   * for any of the data owners (according to the public keys for the data owner in the iCure server) and/or the sdk could recover some private keys
   * but can't verify the authenticity of the key pairs this method will be called.
   * The recovered and verified keys will automatically be cached using the current api {@link KeyStorageFacade} and {@link StorageFacade}
   *
   * The input is an array containing an object for each data owner part of the current data owner hierarchy. The objects are ordered from the data
   * for the topmost parent of the current data owner hierarchy (first element) to the data for the current data owner (last element). Each object
   * contains:
   * - dataOwner: the data owner entity that this object refers to
   * - unknownKeys: all public keys (in hex-encoded spki format) of `dataOwner` for which the authenticity status (verified or unverified) is unknown
   *   (no result was cached from a previous api instantiation and the key was not generated on the current device).
   * - unavailableKeys: all public keys (in hex-encoded spki format) of `dataOwner` for which the sdk could not recover a private key. May overlap
   *   (partially or completely) with `unknownKeys`.
   *
   * The returned value must be an object associating to each data owner id an object with:
   * - `recoveredKeys`: all recovered keys (will be automatically considered as verified), by fingerprint.
   * - `keyAuthenticity`: an object associating to each public key fingerprint its authenticity. Note that if any of the keys from `unknownKeys` is
   *   completely missing from this object the key will be considered as unverified in this api instance (same as if associated to false), but this
   *   value won't be cached (will be again part of `unknownKeys` in future instances.
   * @param keysData all information on unknown and unavailable keys for each data owner part of the current data owner hierarchy.
   * @param cryptoPrimitives cryptographic primitives you can use to support the process.
   * @return all recovered keys and key authenticity information, by data owner.
   */
  recoverAndVerifySelfHierarchyKeys(
    keysData: {
      dataOwner: DataOwnerWithType
      unknownKeys: string[]
      unavailableKeys: string[]
    }[],
    cryptoPrimitives: CryptoPrimitives
  ): Promise<{
    [dataOwnerId: string]: {
      recoveredKeys: { [keyPairFingerprint: string]: KeyPair<CryptoKey> }
      keyAuthenticity: { [keyPairFingerprint: string]: boolean }
    }
  }>

  /**
   * The correct initialisation of the crypto API requires that at least 1 verified (or device) key pair is available for each data owner part of the
   * current data owner hierarchy. If no verified key is available for any of the data owner parents the api initialisation will automatically fail,
   * however if there is no verified key for the current data owner you can instead create a new crypto key.
   * @param self the current data owner.
   * @param cryptoPrimitives cryptographic primitives you can use to support the process.
   * @return depending on which values you return the api initialisation will proceed differently:
   * - If this method returns true a new key will be automatically generated by the sdk.
   * - If this method returns a key pair the crypto api loads the key pair and considers it as a device key.
   * - If this method returns false the initialisation will fail with a predefined error.
   * - If this method throws an error the initialisation will propagate the error.
   */
  generateNewKeyForDataOwner(self: DataOwnerWithType, cryptoPrimitives: CryptoPrimitives): Promise<KeyPair<CryptoKey> | boolean>

  /**
   * Verifies if the public keys of a data owner which will be the delegate of a new exchange key do actually belong to the person the data owner
   * represents. This method is not called when the delegate would be the current data owner for the api.
   *
   * The user will have to obtain the verified public keys of the delegate from outside iCure, for example by email with another hcp, by checking the
   * personal website of the other user, or by scanning verification qr codes at the doctor office...
   *
   * As long as one of the public keys is verified the creation of a new exchange key will succeed. If no public key is verified the operation will
   * fail.
   * @param delegate the potential data owner delegate.
   * @param publicKeys public keys requiring verification, in spki hex-encoded format.
   * @param cryptoPrimitives cryptographic primitives you can use to support the process.
   * @return all verified public keys, in spki hex-encoded format.
   */
  verifyDelegatePublicKeys(delegate: CryptoActorStubWithType, publicKeys: string[], cryptoPrimitives: CryptoPrimitives): Promise<string[]>
}
