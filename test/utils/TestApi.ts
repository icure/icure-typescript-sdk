import { IcureApi, IcureApiOptions, KeyPair, RSAUtils, ShaVersion } from '../../icc-x-api'
import { TestKeyStorage, TestStorage } from './TestStorage'
import { TestCryptoStrategies } from './TestCryptoStrategies'
import 'isomorphic-fetch'

export const TestApi = async function (
  host: string,
  username: string,
  password: string,
  crypto: Crypto = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : ({} as Crypto),
  keyPair?: KeyPair<CryptoKey>,
  options: IcureApiOptions = {}
): Promise<IcureApi> {
  const initialisedKeys = keyPair ?? (await new RSAUtils(crypto).generateKeyPair(ShaVersion.Sha256))
  return IcureApi.initialise(
    host,
    {
      username,
      password,
    },
    new TestCryptoStrategies(initialisedKeys),
    crypto,
    typeof window !== 'undefined' ? window.fetch : typeof self !== 'undefined' ? self.fetch : fetch,
    {
      ...{
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      },
      ...options,
    }
  )
}
