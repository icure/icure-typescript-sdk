import { IcureStorageFacade } from '../storage/IcureStorageFacade'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { CryptoPrimitives } from './CryptoPrimitives'
import { hex2ua, jwk2spki, ua2hex } from '../utils'
import { KeyPair } from './RSA'
import { checkStandardPublicKeyTail, fingerprintV1, fingerprintV2, fingerprintV2ToStandardV1 } from './utils'

export class UserSignatureKeysManager {
  constructor(
    private readonly iCureStorage: IcureStorageFacade,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly primitives: CryptoPrimitives
  ) {}

  private signatureKeysCache:
    | {
        fingerprint: string
        keyPair: KeyPair<CryptoKey>
      }
    | undefined = undefined
  private verificationKeysCache = new Map<string, CryptoKey>()

  /**
   * Get a key which can be used to sign data in order to allow verification of the data authenticity in the future.
   */
  async getOrCreateSignatureKeyPair(): Promise<{
    fingerprint: string
    keyPair: KeyPair<CryptoKey>
  }> {
    if (this.signatureKeysCache) return this.signatureKeysCache
    const dataOwnerId = await this.dataOwnerApi.getCurrentDataOwnerId()
    const existing = await this.iCureStorage.loadSignatureKey(dataOwnerId)
    if (existing) {
      const fingerprint = fingerprintV1(jwk2spki(existing.publicKey))
      this.signatureKeysCache = {
        fingerprint,
        keyPair: {
          privateKey: await this.primitives.RSA.importSignatureKey('jwk', existing.privateKey),
          publicKey: await this.primitives.RSA.importVerificationKey('jwk', existing.publicKey),
        },
      }
      return this.signatureKeysCache
    } else {
      const generatedPair = await this.primitives.RSA.generateSignatureKeyPair()
      const exportedPub = ua2hex(await this.primitives.RSA.exportKey(generatedPair.publicKey, 'spki'))
      checkStandardPublicKeyTail(exportedPub)
      const fpV2 = fingerprintV2(exportedPub)
      // For consistency with encryption keys we use fpv1 when saving
      await this.iCureStorage.saveSignatureKeyPair(
        dataOwnerId,
        fingerprintV1(exportedPub),
        await this.primitives.RSA.exportKeys(generatedPair, 'jwk', 'jwk')
      )
      this.verificationKeysCache.set(fpV2, generatedPair.publicKey)
      this.signatureKeysCache = { fingerprint: fpV2, keyPair: generatedPair }
      return this.signatureKeysCache
    }
  }

  /**
   * Get all available keys which can be used to verify the authenticity of a signature which should have been created
   * by the current data owner.
   * @param fingerprint v2 fingerprint of the key to retrieve.
   * @return all available verification keys by fingerprint.
   */
  async getSignatureVerificationKey(fingerprint: string): Promise<CryptoKey | undefined> {
    const cached = this.verificationKeysCache.get(fingerprint)
    if (cached) return cached
    // For consistency with encryption keys we use fpv1 when saving
    const loaded = await this.iCureStorage.loadSignatureVerificationKey(
      await this.dataOwnerApi.getCurrentDataOwnerId(),
      fingerprintV2ToStandardV1(fingerprint)
    )
    if (loaded) {
      const imported = await this.primitives.RSA.importVerificationKey('jwk', loaded)
      this.verificationKeysCache.set(fingerprint, imported)
      return imported
    }
  }
}
