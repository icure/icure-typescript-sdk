import { PublicKeyVerifier } from './PublicKeyVerifier'
import { KeyPair } from './RSA'

/**
 * Allows to customise the behaviour of the crypto api to better suit your needs.
 */
export interface CryptoStrategies extends PublicKeyVerifier {
  /**
   * The correct initialisation of the crypto API requires that at least 1 verified (or device) key pair is available for the current data owner.
   * If no verified key is available this method will be called, and the result of the initialisation will depend on the result of this method:
   * - If it returns true a new key will be automatically generated. Since the key has been created on this device it is automatically verified.
   * - If it returns a key pair the crypto api loads the key pair and considers it as verified (but not as a key generated on this device).
   * - If it returns false the initialisation will fail with a predefined error.
   * - If it throws an error the initialisation will propagate the error.
   */
  createNewKeyPairIfNoVerifiedKeysFound(): Promise<boolean | KeyPair<CryptoKey>>
}
