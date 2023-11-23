import { KeyPair } from './RSA'
import { RecoveryDataUseFailureReason } from './RecoveryDataEncryption'

/**
 * Allows to recover user keypairs using builtin recovery mechanisms.
 * This interface includes recovery methods that require some input from your application (e.g. a recovery key created from a different device).
 * Other recovery methods (such as transfer keys) are used automatically by the sdk when available and don't require any input from your application.
 */
export interface KeyPairRecoverer {
  /**
   * Recover a keypair using a recovery key created in the past using the {@link IccRecoveryXApi.createRecoveryInfoForAvailableKeyPairs} method.
   * @param recoveryKey the result of a past call to {@link IccRecoveryXApi.createRecoveryInfoForAvailableKeyPairs}.
   * @param autoDelete if true, the recovery data will be deleted from the server after it could be used successfully.
   * This will prevent the recovery key from being used again.
   * @return an object containing a single `success` associated to an object in the form dataOwnerId -> publicKeySpki -> keyPair, where:
   * - The `dataOwnerId` keys are the ids of the data owner which created the recovery data and his parents, if the recovery data contains also the
   *   parents keys
   * - The `publicKeySpki` keys are all public key pairs for the data owner, in hex-encoded spki format (full, no fingerprint)
   * - The `keyPair` is the imported privateKey + publicKey.
   *
   * OR an object containing a single `failure` associated to a {@link RecoveryDataUseFailureReason} if the recovery data could not be used to
   * perform the operation.
   */
  recoverWithRecoveryKey(
    recoveryKey: string,
    autoDelete: boolean
  ): Promise<{ success: { [dataOwnerId: string]: { [publicKeySpki: string]: KeyPair<CryptoKey> } } } | { failure: RecoveryDataUseFailureReason }>
}
