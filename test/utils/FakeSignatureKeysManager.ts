import { KeyPair } from '../../icc-x-api/crypto/RSA'
import { UserSignatureKeysManager } from '../../icc-x-api/crypto/UserSignatureKeysManager'
import { CryptoPrimitives } from '../../icc-x-api/crypto/CryptoPrimitives'
import { ua2hex } from '../../icc-x-api'

export class FakeSignatureKeysManager extends UserSignatureKeysManager {
  constructor(private readonly _primitives: CryptoPrimitives) {
    super(null as any, null as any, _primitives)
  }

  private signatureKeypair: { fingerprint: string; keyPair: KeyPair<CryptoKey> } | undefined
  private extraKeys: Map<string, CryptoKey> = new Map()

  async getSignatureVerificationKey(fingerprint: string): Promise<CryptoKey | undefined> {
    if (this.signatureKeypair?.fingerprint === fingerprint) {
      return this.signatureKeypair.keyPair.publicKey
    } else return this.extraKeys.get(fingerprint)
  }

  async getOrCreateSignatureKeyPair(): Promise<{ fingerprint: string; keyPair: KeyPair<CryptoKey> }> {
    if (!this.signatureKeypair) {
      const keyPair = await this._primitives.RSA.generateSignatureKeyPair()
      const fingerprint = ua2hex(await this._primitives.RSA.exportKey(keyPair.publicKey, 'spki')).slice(-32)
      this.signatureKeypair = { keyPair, fingerprint }
    }
    return this.signatureKeypair!
  }

  async addVerificationKey(key: CryptoKey): Promise<string> {
    const fingerprint = ua2hex(await this._primitives.RSA.exportKey(key, 'spki')).slice(-32)
    this.extraKeys.set(fingerprint, key)
    return fingerprint
  }

  clearKeys() {
    this.extraKeys.clear()
    this.signatureKeypair = undefined
  }
}
