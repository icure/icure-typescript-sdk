import 'isomorphic-fetch'
import 'mocha'
import { createNewHcpApi, getEnvironmentInitializer, setLocalStorage, TestUtils } from '../../utils/test_utils'
import { before } from 'mocha'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { CryptoPrimitives, hex2ua, IcureApi, ShaVersion, ua2ab, ua2hex } from '../../../icc-x-api'
import { randomUUID, webcrypto } from 'crypto'
import { HealthcareParty } from '../../../icc-api/model/HealthcareParty'
import { TestApi } from '../../utils/TestApi'
import { he } from 'date-fns/locale'
import { expect } from 'chai'

setLocalStorage(fetch)

describe('SDL in an environment with soft-deleted data owners', async function () {
  this.timeout(600000)
  let env: TestVars
  let masterApi: IcureApi
  let primitives: CryptoPrimitives

  // Test values, not real data
  const pubKeyHex =
    '30820122300d06092a864886f70d01010105000382010f003082010a0282010100a53f247f466c8f4e39d04ac72e260949f66d0e6f0aa2875d670f3d7f6c7f45ecbfe8ce31a26abbca8008d75d135339a739ca3e0ee058b9595722db46701cd0dfbb9ef4f96d1ac337cf78fe4449a26be244020464d44ff0d3bf0b7bcb53666750fa76298e832386eb6e5a6e15d2e366e5c8e53acf0a6ecf20a43fd752f708797e58aaa60ceec23cf3ddc5eacca6630a068ef0e7ea52bfdec756456124610b5bcce6025e2cd4a03eb54a7bc2076531348136671102a89ea3a275147b273bfb17f11b759f20c2068c5ba4fa081cc7087b582300d8acb7c6bcc2b8485290d7c165f855180176662fa08af735e64091086d6d5d1f6a2fb1ccc08799369fcd6d68d8250203010001' // pragma: allowlist secret
  const privKeyHex =
    '308204bd020100300d06092a864886f70d0101010500048204a7308204a30201000282010100a53f247f466c8f4e39d04ac72e260949f66d0e6f0aa2875d670f3d7f6c7f45ecbfe8ce31a26abbca8008d75d135339a739ca3e0ee058b9595722db46701cd0dfbb9ef4f96d1ac337cf78fe4449a26be244020464d44ff0d3bf0b7bcb53666750fa76298e832386eb6e5a6e15d2e366e5c8e53acf0a6ecf20a43fd752f708797e58aaa60ceec23cf3ddc5eacca6630a068ef0e7ea52bfdec756456124610b5bcce6025e2cd4a03eb54a7bc2076531348136671102a89ea3a275147b273bfb17f11b759f20c2068c5ba4fa081cc7087b582300d8acb7c6bcc2b8485290d7c165f855180176662fa08af735e64091086d6d5d1f6a2fb1ccc08799369fcd6d68d8250203010001028201000189beeb385a9652e212e03f4e5ca84579f7b5e4aeb2a893e3fbae54db4babf8f2285692fbb206a171e3a32d889a83b4dcc2d725084d8b1c1bc58548f88e2c1b890187c23293c73163cafa82e43490d080558c78ebc8fab2ddda5b829efa1b0813ecb9a24bf22eb54e47a532aacdd70d587b59bac79c146d7759e8c52aeb774603f4b282e699aca98793aa0086233a8aafc8fad58b62df011f33c1dcc6efdfc9aa51f4f11ea450ba5e02f9b69de33c756f3504ff086d2e58c25db871e3c021ee3720837466bb41d886bd4300eeac41742206110158578315d29a527b520e11ec6f7e98558931bdde63a4402635473244fa9764bb3527ff33473ff08f63b3a94102818100c8032014c593f8aecc15287d3dfd6143c75e8fb27faf7944fa030016b26fa5133d8e0d13a5244bcd6155ba29258a498e44fef239dc75dee9db4756c9a2b2be93cf2c67049ff2b2f5cbf949960e44e3fc56c90a66485ec22079a0eb864100404e0d7ea96f21ced9793633d87c49056be4c507768d51c310f69605befec087bbcd02818100d380b7a8cbc5a87c5d91e1497949acfe3c61671b31bc4c54f2f8e8cd8e709a617b49d1e7d6c0333fbb42af119db8660d1a58165e716b976bebdb12104c0dba951719f8c6711e84b704bcdd80248a767609680e4ff125126a23bbee5362f88d881c5c24c5ff0400edde1dd7044fd0d5d06a9cda33a1004daad7df8aa2eb63a5b90281801d0ab721ccfe8b617628ac546327e373a0034f0230201e8fb16db61995973874eebf2d8ee8afb881fddc20c7d0b79fae94be2015deb90ec10e21f1ac1d7faec46f9496f0c8f8c89b801e965cbf7da94cfe9cfa7197988abf8469a5493d2ef8275d36430bebf0c90b1c9fb2937956dc2fbf9c31ce9b4ca3adea62b334f267c3110281806453facb275e6bbe12e4d0697a0f68f070d40384f2e2cf92bc6f367fcbc1be79df71f51074de577133f33df8ad487ba05b8ecd8d9f5fda44676d53f4471f7c129d12c4dfdd690cab84a3d2aea6a6c7ead62b761e95d57016c93caca101a1c6017af27abf316944c79145b66965333b39d258f568e846ac910e360c1d9c6b788102818100879751ba5fe91d86410037ca9df05b2bb689734af710ab50a75b1aa1083dd596f295d710ba630c9fbfe6dcdedd8f0fca22595f8723376e72721c01275572692ebd2d5b39d5715ea052ed0968a9dabb76f7eef7c4c894a5031ae237772c21b62a43322e324c793fccf8b3abe340ca029e54255ed735549918352f3abaaf0850b7' // pragma: allowlist secret
  const deletedOtherId = 'dc88f05e-6f9f-4203-bc8d-59b1737322f4' // pragma: allowlist secret
  const exchangeKeySelf = '6aac0c669a4423d5fed7c8d5a434ddf70e8f9ab34db8104cf88d810a535f2701' // pragma: allowlist secret
  const exchangeKeyOther = '24a58ab4837d2a7dbed477abf03c87816dfbae113604a1e3d93093194291907e' // pragma: allowlist secret
  function makeTestHcp(props: { includeHcPartyKeys?: boolean; includeAesExchangeKeys?: boolean }): HealthcareParty {
    const hcpId = primitives.randomUuid()
    return new HealthcareParty({
      id: hcpId,
      name: `Test-${primitives.randomUuid()}`,
      hcPartyKeys: props.includeHcPartyKeys
        ? {
            [hcpId]: [
              '785fd227c9a4bb185adea3070fdc571696df3f5e513ba7fe3e5f50b0cf5a449def0cbc7e806a626945c441adcd09feaf6c6bf3da6460347efc620be3b81bdbf3804cabdfdeac3f4d5417db0191a3a1032e57670be7db630256c862db0ed87a67454c8660cb30e7bd8bf3d3ec218dae2107616933e3882200add851ae49cb2ec731f0425f1cea7d69a530d6debff6c60e1663733c946e48ac800a70044ecc32bb5cbe184484e4bb6ac3ad42435e80d6c3d2b8684d1cfff9fe77bdb3fdaae71482f018945d878175a12407af3b9ef245cc6128ea956292f8e7f5e2d74368de42445675326b7e1dbd7990502cb098b1abef8e33f3d353a332912221d0039f787c69', // pragma: allowlist secret
              '785fd227c9a4bb185adea3070fdc571696df3f5e513ba7fe3e5f50b0cf5a449def0cbc7e806a626945c441adcd09feaf6c6bf3da6460347efc620be3b81bdbf3804cabdfdeac3f4d5417db0191a3a1032e57670be7db630256c862db0ed87a67454c8660cb30e7bd8bf3d3ec218dae2107616933e3882200add851ae49cb2ec731f0425f1cea7d69a530d6debff6c60e1663733c946e48ac800a70044ecc32bb5cbe184484e4bb6ac3ad42435e80d6c3d2b8684d1cfff9fe77bdb3fdaae71482f018945d878175a12407af3b9ef245cc6128ea956292f8e7f5e2d74368de42445675326b7e1dbd7990502cb098b1abef8e33f3d353a332912221d0039f787c69', // pragma: allowlist secret
            ],
            'dc88f05e-6f9f-4203-bc8d-59b1737322f4': [
              // pragma: allowlist secret
              '9e8ce2e76f0716a5ff537ea56c6ec7725ed067afc3a8c1eb8ef63f5a6c6de1a901c651c433f558224be3ea6e09748c2dfa535b0d9114a5058126db7803a21ba99dc9877b372e6fbbdacf6d8e3410ee93c985959ab4f0267acf562619fee7723f050542ecfc1642dcf6f5d678994d58d8c83d8be65b5f399af19205777216d9eb28ecbb00c5ce57f253973403845f98b94d86361cccaeb33772aa491b9c1dc1fc95c0a9f74b2d26e895a4ff80d9b32fd318ea42088e6249f027a2b6afe98bd9dece83dc24e454a8a62e78b88952f38a87cdb580dda47c87496e44a5fde0e9886289aeded4a404411a1e28d28fc09fd305f4f43e0bce0c3605eb419b2795be70e7', // pragma: allowlist secret
              '27511848a060104b0b92447df4a6e1a11de92d65892b6d07104eab6add3ce57f664a1fd2431e509818a232e0601f0621ecf35df4492c53b18ceb21747a51cd863852c586fa9f3a0dd4e19b1038540ecc63724115cbb6909793a1ffceea4498dc7ae5e9fd4120912c13b276639036a6d859a2cc836b267aaeb33a876c8d40caa5ae4c5fde2122b1d3107f074ad28c38be6a96b5c899d5fda2e66c8bef4a541c41f177e868d8e521b35be07b96def15a6b15cd5a8d1e6fc2df3ce6fbd280d315082160054d904f71cd8b4d3822a2812a1a5224390ec4591319c0bad98429ccadba3f04f9b602d92a9e95f367bdd03fe5c943d4bc9ea595be27f53797b3d7c00f03', // pragma: allowlist secret
            ],
          }
        : {},
      aesExchangeKeys: props.includeAesExchangeKeys
        ? {
            // pragma: allowlist nextline secret
            '30820122300d06092a864886f70d01010105000382010f003082010a0282010100a53f247f466c8f4e39d04ac72e260949f66d0e6f0aa2875d670f3d7f6c7f45ecbfe8ce31a26abbca8008d75d135339a739ca3e0ee058b9595722db46701cd0dfbb9ef4f96d1ac337cf78fe4449a26be244020464d44ff0d3bf0b7bcb53666750fa76298e832386eb6e5a6e15d2e366e5c8e53acf0a6ecf20a43fd752f708797e58aaa60ceec23cf3ddc5eacca6630a068ef0e7ea52bfdec756456124610b5bcce6025e2cd4a03eb54a7bc2076531348136671102a89ea3a275147b273bfb17f11b759f20c2068c5ba4fa081cc7087b582300d8acb7c6bcc2b8485290d7c165f855180176662fa08af735e64091086d6d5d1f6a2fb1ccc08799369fcd6d68d8250203010001':
              {
                [hcpId]: {
                  // pragma: allowlist secret
                  ccc08799369fcd6d68d8250203010001:
                    '785fd227c9a4bb185adea3070fdc571696df3f5e513ba7fe3e5f50b0cf5a449def0cbc7e806a626945c441adcd09feaf6c6bf3da6460347efc620be3b81bdbf3804cabdfdeac3f4d5417db0191a3a1032e57670be7db630256c862db0ed87a67454c8660cb30e7bd8bf3d3ec218dae2107616933e3882200add851ae49cb2ec731f0425f1cea7d69a530d6debff6c60e1663733c946e48ac800a70044ecc32bb5cbe184484e4bb6ac3ad42435e80d6c3d2b8684d1cfff9fe77bdb3fdaae71482f018945d878175a12407af3b9ef245cc6128ea956292f8e7f5e2d74368de42445675326b7e1dbd7990502cb098b1abef8e33f3d353a332912221d0039f787c69', // pragma: allowlist secret
                },
                'dc88f05e-6f9f-4203-bc8d-59b1737322f4': {
                  // pragma: allowlist secret
                  // pragma: allowlist secret
                  ccc08799369fcd6d68d8250203010001:
                    '9e8ce2e76f0716a5ff537ea56c6ec7725ed067afc3a8c1eb8ef63f5a6c6de1a901c651c433f558224be3ea6e09748c2dfa535b0d9114a5058126db7803a21ba99dc9877b372e6fbbdacf6d8e3410ee93c985959ab4f0267acf562619fee7723f050542ecfc1642dcf6f5d678994d58d8c83d8be65b5f399af19205777216d9eb28ecbb00c5ce57f253973403845f98b94d86361cccaeb33772aa491b9c1dc1fc95c0a9f74b2d26e895a4ff80d9b32fd318ea42088e6249f027a2b6afe98bd9dece83dc24e454a8a62e78b88952f38a87cdb580dda47c87496e44a5fde0e9886289aeded4a404411a1e28d28fc09fd305f4f43e0bce0c3605eb419b2795be70e7', // pragma: allowlist secret
                  // pragma: allowlist nextline secret
                  '0c8b6fa8a116ecfee683b10203010001':
                    '27511848a060104b0b92447df4a6e1a11de92d65892b6d07104eab6add3ce57f664a1fd2431e509818a232e0601f0621ecf35df4492c53b18ceb21747a51cd863852c586fa9f3a0dd4e19b1038540ecc63724115cbb6909793a1ffceea4498dc7ae5e9fd4120912c13b276639036a6d859a2cc836b267aaeb33a876c8d40caa5ae4c5fde2122b1d3107f074ad28c38be6a96b5c899d5fda2e66c8bef4a541c41f177e868d8e521b35be07b96def15a6b15cd5a8d1e6fc2df3ce6fbd280d315082160054d904f71cd8b4d3822a2812a1a5224390ec4591319c0bad98429ccadba3f04f9b602d92a9e95f367bdd03fe5c943d4bc9ea595be27f53797b3d7c00f03', // pragma: allowlist secret
                },
              },
          }
        : {},
      publicKey: pubKeyHex,
    })
  }

  before(async function () {
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    masterApi = await TestUtils.initMasterApi(env)
    primitives = masterApi.cryptoApi.primitives
  })

  async function doLegacyKeysTestWithDeletedDataOwner(hcp: HealthcareParty) {
    const userPw = primitives.randomUuid()
    const user = await masterApi.userApi.createUser({
      id: primitives.randomUuid(),
      email: `${primitives.randomUuid()}@test.icure.com`,
      passwordHash: userPw,
      healthcarePartyId: hcp.id!,
    })
    const hcpKeypair = await primitives.RSA.importKeyPair('pkcs8', ua2ab(hex2ua(privKeyHex)), 'spki', ua2ab(hex2ua(pubKeyHex)), ShaVersion.Sha1)
    const testApi = await TestApi(env.iCureUrl, user.email!, userPw, webcrypto as any, hcpKeypair)
    const selfKeys = await testApi.cryptoApi.exchangeKeys.getDecryptionExchangeKeysFor(hcp.id!, hcp.id!)
    expect(selfKeys.length).to.eq(1)
    const selfKeyHex = ua2hex(await primitives.AES.exportKey(selfKeys[0], 'raw'))
    expect(selfKeyHex).to.eq(exchangeKeySelf)
    const delegateKeys = await testApi.cryptoApi.exchangeKeys.getDecryptionExchangeKeysFor(hcp.id!, deletedOtherId)
    expect(delegateKeys.length).to.eq(1)
    const delegateKeysHex = ua2hex(await primitives.AES.exportKey(delegateKeys[0], 'raw'))
    expect(delegateKeysHex).to.eq(exchangeKeyOther)
  }

  it('hcp with hcPartyKeys to soft-deleted user', async () => {
    const hcp = await masterApi.healthcarePartyApi.createHealthcareParty(makeTestHcp({ includeHcPartyKeys: true }))
    await doLegacyKeysTestWithDeletedDataOwner(hcp)
  })

  it('hcp with aesExchangeKeys to soft-deleted user', async () => {
    const hcp = await masterApi.healthcarePartyApi.createHealthcareParty(makeTestHcp({ includeAesExchangeKeys: true }))
    await doLegacyKeysTestWithDeletedDataOwner(hcp)
  })
})
