import { DataOwner } from '../icc-data-owner-x-api'

/**
 * Allows to verify the authenticity of public keys.
 * In general there is no guarantee that the public keys stored in the iCure database are authentic, i.e. created by the data owner they are
 * associated to. This is because the database admins or a malicious attacker may have added his own public keys to the data owner's public keys.
 *
 * This interface allows to specify verification strategies for the public keys of data owners. These would usually involve some form of user
 * interaction.
 */
export interface PublicKeyVerifier {
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
   * @return all verified public keys, in spki hex-encoded format.
   */
  verifyDelegatePublicKeys(delegate: DataOwner, publicKeys: string[]): Promise<string[]>

  /**
   * Verifies if the public keys really belong to the current data owner for the api. Note that the keys stored on this device using a
   * {@link KeyStorageFacade} at keys from {@link StorageEntryKeysFactory.deviceKeypairOfDataOwner} are automatically considered as verified public
   * keys for the current data owner, so they will be excluded from this request. Similarly, the answers from previous requests to this method will be
   * cached using a {@link StorageFacade} and they will be excluded from future requests.
   *
   * The verified public keys will be used for:
   * - Creation of new transfer keys
   * - Creation of new exchange keys
   * - Verification of private keys recovered from transfer keys or shamir, to decide if they may be used for encryption, signing and signature
   *   verification (unverified private keys will always be usable for decryption).
   *
   * Usually the user will have to check if he really owns a public key by getting the verified keys on other devices by using
   * {@link KeyManager.getSelfVerifiedKeys}. If a user can't access anymore a device which would have one of the public keys it is not that important:
   * - There would be no benefit in creating a transfer key from that public key which would never be used
   * - The key will still be usable for decryption if it can be recovered from the transfer keys.
   *
   * @param self the data owner for the current user of the api.
   * @param publicKeys public keys requiring verification, in spki hex-encoded format.
   * @return all verified public keys, in spki hex-encoded format.
   */
  verifyOwnPublicKeys(self: DataOwner, publicKeys: string[]): Promise<string[]>
}
