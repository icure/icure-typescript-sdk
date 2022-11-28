/**
 * @internal This class is meant only for internal use and may be changed without notice.
 * Functions to retrieve and update the exchange data between data owners, such as the exchange keys (previously hcPartyKeys).
 * NOTE: Does not handle encryption/decryption of the exchange data.
 */
export class ExchangeDataManager {
  /**
   * @internal
   * @param delegatorId
   * @param delegateId
   */
  async getEncryptedExchangeKeysFor(delegatorId: string, delegateId: string): Promise<{ [publicKeyFingerprint: string]: string }[]> {
    throw 'TODO'
  }

  /**
   * @internal
   * @param delegatorId
   * @param delegateId
   * @param encryptedKey
   */
  async createEncryptedExchangeKeyFor(delegatorId: string, delegateId: string, encryptedKey: { [pubKeyFp: string]: string }) {}

  // Create exchange A -> B

  // Get exchange keys A -> B
}
