import { KeyPair } from './crypto/RSA'

export class IccRecoveryXApi {
  /**
   * Create recovery data for a keypair and stores it encrypted on the iCure server. This allows the user that created
   * it to recover the keypair at a later time by just providing the string returned by this method to the
   * {@link recoverKeyPair} method.
   *
   * You can also provide an expiration time for the recovery data. If you do so, the recovery data will be deleted
   * automatically after ~{@link lifetimeSeconds} seconds. If you don't provide an expiration time, the recovery data
   * will never expire.
   *
   * This could be used to:
   * - Provide some sort of one-use "recovery codes" to the user, which he can use to recover his keypair if he loses
   *   his device. In this case you should not put any expiration time on the recovery data.
   * - Provide a way for the user to easily "copy" the key from one device to another. In this case you should put a
   *   short expiration time on the recovery data (a few minutes), so that it will automatically be deleted if it is
   *   not used after all.
   *
   * # Important
   *
   * A malicious user that can login as the creator of the recovery data or that can access directly the database
   * containing the recovery data will be able to get the private key of the data owner from the recovery key returned
   * by this method. The result must be kept secret, just like a private key.
   *
   * @param keyPair The keypair that will be available through this recovery data.
   * @param lifetimeSeconds the amount of seconds the recovery data will be available. If not provided, the recovery
   * data will be available until it is deleted.
   * @return an hexadecimal string that is the `recoveryKey` which will allow the user to recover his keypair later or
   * from another device. This value must be kept secret from other users. You can use this value with {@link recoverKeyPair}
   */
  async createKeyPairRecoveryData(keyPair: KeyPair<CryptoKey>, lifetimeSeconds?: number): Promise<string> {
    throw 'TODO'
  }

  /**
   * Recover a keypair from a recovery key created in the past by the {@link createKeyPairRecoveryData} method.
   * @param recoveryKey the result of a past call to {@link createKeyPairRecoveryData}.
   * @param autoDelete if true, the recovery data will be deleted from the server after it could be used successfully.
   * This will prevent the recovery key from being used again.
   * @return the keypair that was given as input to the call of {@link createKeyPairRecoveryData} which returned the
   * provided {@link recoveryKey}.
   */
  async recoverKeyPair(recoveryKey: string, autoDelete: boolean): Promise<KeyPair<CryptoKey>> {
    throw 'TODO'
  }

  /**
   * Create recovery data that allows the delegate {@link delegateId} recover the content of exchange data from the
   * current data owner to the delegate.
   *
   * This can be useful in the following situations:
   * - A user lost access to his old keypair and is asking for access back to his data. This is similar to the
   *   give-access-back mechanism, except that instead of having to verify the public key of the delegate as in the
   *   give-access-back, the delegator has to provide the recovery key to the delegate: the delegator has to properly
   *   identify the delegate instead of validating that the public key belongs to the delegate.
   * - A patient is not yet registered in the system and therefore has no keypair, but the doctor wants to already share
   *   some data with them. The doctor can create some placeholder exchange data, encrypted only with his own key
   *   through the {@link IccPatientXApi.initialiseExchangeDataToNewlyInvitedPatient} method, then create recovery data
   *   for it and share the recovery key with the patient. The moment the patient logs in and creates his keypair he
   *   will use the {@link recoverExchangeData} method to "complete" the placeholder exchange data.
   *
   * @param delegateId id of the delegate that needs access to his exchange data from the current data owner. This can't
   * be the id of the current data owner (you should instead recover the keypair).
   * @param lifetimeSeconds the amount of seconds the recovery data will be available. If not provided, the recovery
   * data will be available until it is deleted.
   * @return an hexadecimal string that is the `recoveryKey` which will allow the delegate to gain access to the exchange data.
   * This value must be kept secret from users other than the current data owner and the delegate.
   * You can use this value with {@link recoverExchangeData}
   */
  async createExchangeDataRecoveryInfo(delegateId: string, lifetimeSeconds?: number): Promise<string> {
    // TODO delegateId must not be current data owner
    throw 'TODO'
  }

  /**
   * Recover the content of exchange data from the delegator that created the recovery data at the provided.
   * {@link recoveryKey} to the current delegate. This will enable the current user to access the exchange data with
   * any of his private keys available on the device from which this method was called.
   *
   * @param recoveryKey the result of a call to {@link createExchangeDataRecoveryInfo} by a delegator.
   */
  async recoverExchangeData(recoveryKey: string): Promise<void> {
    throw 'TODO'
  }

  // TODO delete methods (by recovery key, by recipient) + decide what to do if user tries to delete already deleted recovery data
}
