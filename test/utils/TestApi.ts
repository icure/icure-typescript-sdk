import { Api, Apis } from '../../icc-x-api'
import { KeyPair, RSAUtils } from '../../icc-x-api/crypto/RSA'
import { TestKeyStorage, TestStorage } from './TestStorage'
import { DefaultStorageEntryKeysFactory } from '../../icc-x-api/storage/DefaultStorageEntryKeysFactory'
import { TestCryptoStrategies } from './TestCryptoStrategies'

export const TestApi = async function (
  host: string,
  username: string,
  password: string,
  crypto: Crypto = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : ({} as Crypto),
  keyPair?: KeyPair<CryptoKey>
): Promise<Apis> {
  const initialisedKeys = keyPair ?? (await new RSAUtils(crypto).generateKeyPair())
  return Api(
    host,
    username,
    password,
    new TestCryptoStrategies(initialisedKeys),
    crypto,
    typeof window !== 'undefined' ? window.fetch : typeof self !== 'undefined' ? self.fetch : fetch,
    {
      storage: new TestStorage(),
      keyStorage: new TestKeyStorage(),
    }
  )
}
