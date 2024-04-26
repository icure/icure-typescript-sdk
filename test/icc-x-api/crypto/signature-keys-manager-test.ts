import { UserSignatureKeysManager } from '../../../icc-x-api/crypto/UserSignatureKeysManager'
import { IcureStorageFacade } from '../../../icc-x-api/storage/IcureStorageFacade'
import { TestKeyStorage, TestStorage } from '../../utils/TestStorage'
import { DefaultStorageEntryKeysFactory } from '../../../icc-x-api/storage/DefaultStorageEntryKeysFactory'
import { FakeDataOwnerApi } from '../../utils/FakeDataOwnerApi'
import { CryptoPrimitives, WebCryptoPrimitives } from '../../../icc-x-api/crypto/CryptoPrimitives'
import { webcrypto } from 'crypto'
import { DataOwnerTypeEnum } from '../../../icc-api/model/DataOwnerTypeEnum'
import { ua2hex } from '../../../icc-x-api'
import { expect } from 'chai'
import { fingerprintV1, fingerprintV2 } from '../../../icc-x-api/crypto/utils'

describe('SignatureKeysManager', () => {
  it('should be able to store a key pair in local storage and reload it', async () => {
    const iCureStorage = new IcureStorageFacade(new TestKeyStorage(), new TestStorage(), new DefaultStorageEntryKeysFactory())
    const primitives = new WebCryptoPrimitives(webcrypto as any)
    const dataOwnerApi = new FakeDataOwnerApi({ id: primitives.randomUuid(), type: DataOwnerTypeEnum.Hcp })
    const manager1 = new UserSignatureKeysManager(iCureStorage, dataOwnerApi, primitives)
    const pair1 = await manager1.getOrCreateSignatureKeyPair()
    const manager2 = new UserSignatureKeysManager(iCureStorage, dataOwnerApi, primitives)
    const pair2 = await manager2.getOrCreateSignatureKeyPair()
    const private1 = ua2hex(await primitives.RSA.exportKey(pair1.keyPair.privateKey, 'pkcs8'))
    const private2 = ua2hex(await primitives.RSA.exportKey(pair2.keyPair.privateKey, 'pkcs8'))
    expect(private1).to.equal(private2)
    const public1 = ua2hex(await primitives.RSA.exportKey(pair1.keyPair.publicKey, 'spki'))
    const public2 = ua2hex(await primitives.RSA.exportKey(pair2.keyPair.publicKey, 'spki'))
    expect(public1).to.equal(public2)
    const verification1 = ua2hex(await primitives.RSA.exportKey((await manager1.getSignatureVerificationKey(fingerprintV2(public1)))!, 'spki'))
    const verification2 = ua2hex(await primitives.RSA.exportKey((await manager2.getSignatureVerificationKey(fingerprintV2(public1)))!, 'spki'))
    expect(verification1).to.equal(public1)
    expect(verification2).to.equal(public1)
  })
})
