import { IcureStorageFacade } from '../storage/IcureStorageFacade'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { CryptoPrimitives } from './CryptoPrimitives'
import { hex2ua, jwk2spki, ua2hex } from '../utils'
import { KeyPair } from './RSA'

export class UserSignatureKeysManager {
  constructor(
    private readonly iCureStorage: IcureStorageFacade,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly primitives: CryptoPrimitives
  ) {}

  private verificationKeysCache = new Map<string, CryptoKey>()

  /**
   * Get a key which can be used to sign data in order to allow verification of the data authenticity in the future.
   */
  async getOrCreateSignatureKeyPair(): Promise<{
    fingerprint: string
    keyPair: KeyPair<CryptoKey>
  }> {
    const dataOwnerId = await this.dataOwnerApi.getCurrentDataOwnerId()
    const existing = await this.iCureStorage.loadSignatureKey(dataOwnerId)
    if (existing) {
      const fingerprint = jwk2spki(existing.publicKey).slice(-32)
      return {
        fingerprint,
        keyPair: await this.primitives.RSA.importKeyPair('jwk', existing.privateKey, 'jwk', existing.publicKey),
      }
    } else {
      const generatedPair = await this.primitives.RSA.generateSignatureKeyPair()
      const fingerprint = ua2hex(await this.primitives.RSA.exportKey(generatedPair.publicKey, 'spki')).slice(-32)
      await this.iCureStorage.saveSignatureKeyPair(dataOwnerId, fingerprint, await this.primitives.RSA.exportKeys(generatedPair, 'jwk', 'jwk'))
      this.verificationKeysCache.set(fingerprint, generatedPair.publicKey)
      return { fingerprint, keyPair: generatedPair }
    }
  }

  /**
   * Get all available keys which can be used to verify the authenticity of a signature which should have been created
   * by the current data owner.
   * @param fingerprint
   * @return all available verification keys by fingerprint.
   */
  async getSignatureVerificationKey(fingerprint: string): Promise<CryptoKey | undefined> {
    const cached = this.verificationKeysCache.get(fingerprint)
    if (cached) return cached
    const loaded = await this.iCureStorage.loadSignatureVerificationKey(await this.dataOwnerApi.getCurrentDataOwnerId(), fingerprint)
    if (loaded) {
      const imported = await this.primitives.RSA.importKey('jwk', loaded, ['verify'])
      this.verificationKeysCache.set(fingerprint, imported)
      return imported
    }
  }
}
