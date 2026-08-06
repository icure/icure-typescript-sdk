import { createHcpHierarchyApis, createNewHcpApi, getEnvironmentInitializer, setLocalStorage, TestUtils } from '../utils/test_utils'
import { randomUUID, webcrypto } from 'crypto'
import { expect, use as chaiUse } from 'chai'
import 'isomorphic-fetch'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { IcureApi, ShaVersion } from '../../icc-x-api'
import { IccPatientApi } from '../../icc-api'
import { HealthcareParty } from '../../icc-api/model/HealthcareParty'
import { Patient } from '../../icc-api/model/Patient'
import { User } from '../../icc-api/model/User'
import { testStorageWithKeys } from '../utils/TestStorage'
import { TestCryptoStrategies } from '../utils/TestCryptoStrategies'
import * as chaiAsPromised from 'chai-as-promised'
import initMasterApi = TestUtils.initMasterApi

chaiUse(chaiAsPromised)

setLocalStorage(fetch)

let env: TestVars

let hierarchyApis: Awaited<ReturnType<typeof createHcpHierarchyApis>>

/*
 * A legacy (v7-native) owner fixture: an RSA keypair plus the ciphertexts (self and to-parent
 * exchange keys, delegation/encryption keys, encryptedSelf) produced once by the legacy SDK v7
 * (@icure/api 7.1.32) via test-scripts/generate-csm-814-legacy-patient.ts. The owner creates a
 * patient with one secret id and immediately shares it with a parent P - this is the "patient
 * already has a secret id, already shared with a delegate such as a parent" precondition of
 * CSM-814. None of these ciphertexts are derived from the owner's/parent's ids, only from the
 * keys, so the ids can (and should) be generated fresh at test time to avoid conflicts when
 * running the suite multiple times against the same (non-wiped) backend - see
 * legacyAesExchangeKeys/legacyPatientBase below, which weave the fixture's fixed ciphertexts
 * together with test-time-generated ids.
 *
 * Each entry in aesExchangeKeys is keyed by a "fingerprint" - the last 32 hex chars of a public
 * key's spki representation, not a cryptographic hash of anything - identifying which private key
 * can decrypt that entry. A self exchange key (A->A) only needs A's own fingerprint. An exchange
 * key towards someone else (A->P) has two entries: one decryptable by the recipient (P's
 * fingerprint), one decryptable by the sender's own key as a personal backup copy (A's own
 * fingerprint again, the same value already used for the self exchange key below).
 */
interface LegacyOwnerFixture {
  privateKey: string
  publicKey: string
  selfFingerprint: string
  selfExchangeKey: string
  toParentFingerprint: string
  toParentExchangeKey: string
  toParentExchangeKeyOwnCopy: string
  selfDelegationKey: string
  toParentDelegationKey: string
  selfEncryptionKey: string
  toParentEncryptionKey: string
  encryptedSelf: string
}

const pPrivateKey =
  '308204bf020100300d06092a864886f70d0101010500048204a9308204a50201000282010100ba2cd9058441dccb3238ab4725e6536e7d8daba3a3590e226c350c84cd421b3f8cf63e4deb90eff1d7264f3d1facad0dc46e26237bd9afe476c992b1913ace05b3b5531f1d5d2618d01d7201c88b18eccfb16876a3cba3d1a928530de9e19f37a25ef41c069a7527493c603771ea638e5667c98cca585b99c91161e8eeccd17b58c649c156dcbbe02f0140565a1ea08ff72ef4466a3967e50b93a83d6a82084a40d050776b0a3bcafe3d0cdd4c56bf673d905b9fc800b146b990a2a33d0f1575c1c724c629d2c4978125e769631f6c5b86d7db1e4dbcf26edd2e383dd28bc3df7853581b5555fdc09b1a85e7a6b7b1981d63abf2e29c315d03f4e4e0dd735d25020301000102820100204165e645484df32c83d1f4f535870df515c6ff866d06fc62c7fc1fc41a287365be4204290486f5dd0347a63ce7236267be77c01d14959b5d1346659a56585c778aba58813362c6d8c3c93d52dbfa9908d0e15af0bcf6e87bc8bf3f015ef44164d1d3b449569866929331ce595fb518f3926ec2844a33b09cbbf4bd31266e4286b60f156d6ba2bf9dd429725d705c92b2ef9167cddea39a479629e400f8c6469b17facff14c4823b3d14a4bbbb739f4360e0635b443cd30ba6f35c260aa3ce6bbc4e6aa0e430061e464e8a5b5feac05ade105acebbbf39d7f31c6de9005fa701289688ee1c8892babab209d443f40c5da201aacaaa16d6b8163cc7c43cea54f02818100fb269017878b8f7ba9ddfa021a4a7996cf35259db2230e72404fdf8e3572cb56ba17af365b1c7c5550ab6a1be72a37a8f6acb2456b4252461f979c2a9b54e90e9e1de40d9a4f187b270bfa0818b9bc0afcc9a2145ba8767d55f5361b18c9c2e78597ed11e351447df68c7ce0118ef447873dd82783cb538cb011ead98c7ec4c702818100bdc51c817f4ca90e4786336f518b7c5d88042bb898bcfa28b6e54847ca9161497c7e9eef03ae5c618e7a5ab5720c77408f3c0950bf36b649fc7d4c8dcb01b032694d97d14e80550d2088c359f2da6ea41eb85dad76a4918e1aa548e0b3a2b8cefb80c3211c724c8404d7b5aaeeb63ff4b980468f32fbedad2ebc2a9489e00ab302818100c60d3df9e020d5305edf36852bf868f3dd48faf5e58131a6354307771c7cff0ed047571b55341c7426de5619d4ec7ce2184c4d74e2c5751de951e48bd0dc5fc0f03d80169e061bb71a2e9ea87ddf1203d41ea95ac6810d977f0e94f13f55f406215a924fd5e3c35055f9a98c052ca74434c93748c9ecb06134839ca09be36807028181008cc2fcd6017af79b23eaa3945ac440479070a78d919dfb60dfe94aa815d5a8783de41e37e45f1d1f2ff409fcb4d01254ccea176ed1a6dfa819a5477795b176e4adbf647158ed5029208cd17a92ecfb4cb98cbfcfbf456ac22179a0892c35f32774de99dea19f16aa867d0abff3b933cf6f197b3d14f051e837d6532f42e5f08902818100f80e6a6fdaf6e1a8292868bc386cfc8804451502b747b92ca506ad459537e8e7e0b58fd648836da034ef0ef59c81c3819913060408f9d7e6ec533ff39331914a9db2476dfe498e22c1774892c1d979f5ad1396d172edd416fb0467e5ae340c93c11ab47732c184c3a6e90df1e6a39742b401b02fa2fde1f7d50ec8b8a1dc9157' // pragma: allowlist secret
const pPublicKey =
  '30820122300d06092a864886f70d01010105000382010f003082010a0282010100ba2cd9058441dccb3238ab4725e6536e7d8daba3a3590e226c350c84cd421b3f8cf63e4deb90eff1d7264f3d1facad0dc46e26237bd9afe476c992b1913ace05b3b5531f1d5d2618d01d7201c88b18eccfb16876a3cba3d1a928530de9e19f37a25ef41c069a7527493c603771ea638e5667c98cca585b99c91161e8eeccd17b58c649c156dcbbe02f0140565a1ea08ff72ef4466a3967e50b93a83d6a82084a40d050776b0a3bcafe3d0cdd4c56bf673d905b9fc800b146b990a2a33d0f1575c1c724c629d2c4978125e769631f6c5b86d7db1e4dbcf26edd2e383dd28bc3df7853581b5555fdc09b1a85e7a6b7b1981d63abf2e29c315d03f4e4e0dd735d250203010001' // pragma: allowlist secret

const aFixture: LegacyOwnerFixture = {
  privateKey:
    '308204bd020100300d06092a864886f70d0101010500048204a7308204a30201000282010100c35a740119a64b265b8524e44c2a548efc21b088f8df2575a6a89bf0f0a7c9fb7888ba3719d5433032d4a3c1290fc525e6874523c841aa43367a3bbb015f1b2e1b3b2cdd323369a9df80768a5583fb6b2b01ebe601d680e0ad2cb5cf8d853a49df2f95cb6cd0caf9eb9cb59d6161dd7fbd4a980166ec1972808b57ad75721ae9988b85fe23b7278f3efeb530805da70b7afd1f7a017bc0da2f75ff2df15240b57b29d4c178599d3b7324ff6e3016792695a5725f3cc9475d69fc8181f66587d3382906a912c7a1f28485fe98b2faf06cb6c2877d1195f1147543a52ab919b912f3b2d7ee867715ba7faafd25522f091d4bfa00682f43aa5def879985d651862302030100010282010005b2cb447a25f68fd2f9cf302ed7634375aff3e46fc208346676a2d6aab33f13c5b36cebf38c75815febce950af549b4d49e5bb8a5fc485faa8b0c7197eef2c7856c6df8e56d484d44bd0c782926a222c13fe832fbb28a9fa990bb9c8d9af62ed00f8b95c201ee5e9c21579c148a6df9bb3a844e655d1586f206c4ecab7e10b24123ec6a9cc3089472dc3be93eb8af256ceefd5f609e020eb85bbf53aaf91dc0306df33321b2e4688320f3834d3b9e074545206ec18c3b011273edcddbc6135f2af9d71b6b41a2c331c96a08c90a24109b94a33e6a9c8905977a32ac25e78b16f9f6b27f5b66f6103de723ecc72a0db40b400408684da8143475317688298b3902818100fef04b985e01df81e290ab75db0836b662eb23b846908caff9c8e76da29280412cc713223234c6eab3a3d0f908a005343c11846addb672b999250763a4d2a76f67e83a2d9120d433a734a098320ec3afdfc082e3c27e3d06e12ab0dcef4d9a466727f3e7e2446d0fcf4908dd6784eb121f4e2fe72da118ee2945d2d547d9a65902818100c42aa765b54fa65e73f277b6c8e90a8b5f1186fd5cd57ffedfa0e535efa58e2b6832e466d119f669e0e1644f5f12ebd0298eaa995a96dc72574a19277e9e030dcf052136d3e811ea8db145b5d9dd11a097794dbf74015952eb1a04d96882e26dc23eafbd455bdad7e01fee889c713213c724f0bbc68ecaa997c34b126a8af8db0281801768f5681e69c99e61b1ab2cfd59f9bc31c529d8881249f8f6d4edfb714c469eb57fea4fdf905d1bbc3734bf497d783cddaf361ba21458e09621825632126df19af706309cfd08bf5d8145a5f422caf161788a0c6415b780e438495960581dec8d186c1b44f9c7920614cccd97edeab01553d6ae41d0633bab6a8ffba9c760b102818019c0efd12e889272fc0ded219626e23781f7af1d3c3edb5afec904ce9bf3c442769f97d4d7c6eccee1b33594260b39e24e52689b518554d3be1a004b6b181b96888347e506d504e5224d0fb5dc3065cc0b96e55a2944b4116ac433b6c73dc7b4593819a263a4b78a77e6394ebe1b2e53e2653b25abdfbb43a0a5070a17eabed902818100e27ed14daac47b6edbf202468e4aa43b9a8caca188235a7bf492ee3bdf72300f1d53cf3f5d09f1496000fa5b26e486f5c9d3e93e830dbbd409ddb67a07240d6bd25d0cadbc9ba9ade07144ee6b9ed05cb5d1e1c069098f661db6cd1e355a65bb3b2a28bbf16711f38afa3c9c8da28d4261bf9536a50b9368c7e7aec217e4aa91', // pragma: allowlist secret
  publicKey:
    '30820122300d06092a864886f70d01010105000382010f003082010a0282010100c35a740119a64b265b8524e44c2a548efc21b088f8df2575a6a89bf0f0a7c9fb7888ba3719d5433032d4a3c1290fc525e6874523c841aa43367a3bbb015f1b2e1b3b2cdd323369a9df80768a5583fb6b2b01ebe601d680e0ad2cb5cf8d853a49df2f95cb6cd0caf9eb9cb59d6161dd7fbd4a980166ec1972808b57ad75721ae9988b85fe23b7278f3efeb530805da70b7afd1f7a017bc0da2f75ff2df15240b57b29d4c178599d3b7324ff6e3016792695a5725f3cc9475d69fc8181f66587d3382906a912c7a1f28485fe98b2faf06cb6c2877d1195f1147543a52ab919b912f3b2d7ee867715ba7faafd25522f091d4bfa00682f43aa5def879985d65186230203010001', // pragma: allowlist secret
  selfFingerprint: '43aa5def879985d65186230203010001', // pragma: allowlist secret
  selfExchangeKey:
    '8a7cd219e185ba9ec3f47afeb5a8bd0e446f162bb69c74459b63ffb17af7ce55e33bdce2ac609734592b80241866599922cfc69f9d934a4cecb079c5f23d17e0604115b118946c72739b901c98af54ccbad4e53af24de9f989c39f9d60f39d88a974d6c8aa82f42385693db64ee76ea32cad323c2bd106fda80f9b681f113671876fa2f53f84113cb54a5e67db2a7faa882250b28568755feca69302f2d71f42d76fd63313e4db52f7b32a90c0b5633fc23ac4ed0c0e1861610be6e57980e3ede9de1998f467752938001ad2d89c3705b364545edda4f807fff7ed2abeffa8dbfca82952602209db0d026a6f64d7652847b6ddc0e32dd95547412cb0eaf86ad2', // pragma: allowlist secret
  toParentFingerprint: '9c315d03f4e4e0dd735d250203010001', // pragma: allowlist secret
  toParentExchangeKey:
    'b1cfd3684b474ced80cf5cbb651f1228d0700c49ceda07e9b0a675d94ca737d3b93531881fdd68b65c97f0fd26b30a05346a0c194a23a90a809af31eb93c52f3d830f163e226b876c1eee4104d85be524ca35a8732243df381be8553713f3c987f1ee0cf04e8b9bb56d501012435722a634755e7aafae892f341feb61c9b6aafe36b1b425c3b0af770cba8de52ab861336f17c0ccea67b4b9b24b5fd46768876ea58764af11ff9a644777038087812519a2ef64425bf863ffb9091c5530aa5905e60224fa03eac99ff994b0727fda1dbb68200496d46df6b312255ae86614f99b47f5b5330567ee73f232aa1008ad48f434f179a4cd6ddd9c20d39058de4b453', // pragma: allowlist secret
  toParentExchangeKeyOwnCopy:
    '1531714e09925bf4864063efb6f7f8a6d9ae522568f1fe4eda5722fdb88cc8caaba6f1e791d97d269c8ccbd40a0ca6d7163a99aa160831c7beb571f1c21819c23b6211bb2ee2f745701bebb2492db5e77b210669e32bf9cc98f7e681b092da6b207aa40564c93be462c148a8a9e7876e4a0989937e135dfbfe0bb7539cd01ceef4da45e3e087b3b6bce89561c8e35c7962ff411a0fef01eda721bd01ec4b7efe12742fc22fe2c96d5c7176620ed0897dc0d1e7151d6c2ac9688c9b0fde3e03ff445814dcb60f52c8f0f59b2b414d2859324d5201637e78236352bf12bda0b134026b05b4b6948dfd20f859979b97141d13675766c08bef058ebb7c3a277b9e7b', // pragma: allowlist secret
  selfDelegationKey:
    'f1b055534b35feb503ca2ce44e160b7b899bb2550789e409d212639cf536409eab05555fe38ee1c42d0eec740336c0a44cb6ca23b58f273e96a6d526711737bc8476fc4b630cd237373547cfc648c222d4fe22589c0baa9c8e3c5c0498e8efb9', // pragma: allowlist secret
  toParentDelegationKey:
    'd298bad5544a61db3c796a7da8924fcd7545886c6431b8d5a1032a017dd211c7fef10ea6559671c8af8b3492656b4b999328e2420df2b6cb2833aca3ad02dfb11b633442f6a0a44abfbda8ec54785213b5bf38e1bcc30cc1a39051749238c954', // pragma: allowlist secret
  selfEncryptionKey:
    '46f02bcd460442dbfdc911b64f633cac3d81e6a2baaf3bca8f31c6ce86827d89be14a47fe3a466c51515ee439cc020384836789d72e3fa6dc1a09f23798ea6719af2a1da67bc3bd496bca7c9d1ae03482aa5a6e9d0a7dfd6954aac15f82b2b91', // pragma: allowlist secret
  toParentEncryptionKey:
    '21b7a2b03e63f5858a7cd7ffba8e3577daca71961a6095eb1d273156001f3023a629c41acff4b8d570c450429648b385d1b542343e0dd7e8241fea45b84af4938739daacfe882e2801f321b9ec95434983834642b75c5be4e75c731d661f1983', // pragma: allowlist secret
  encryptedSelf: 'HAQoMr0VAX9CrU1fBKzWSfUsXham+TFtlUSbb7e3iA0=', // pragma: allowlist secret
}

const bFixture: LegacyOwnerFixture = {
  privateKey:
    '308204bd020100300d06092a864886f70d0101010500048204a7308204a30201000282010100bca9f007e74c4f256437e5d81b0dd7d2a5c1c934dbe15968b0201415f7611f816d742da515f707433b70b8c2cf0fd0e1fad7ff55805e059126778d79759b1467ed41594881ca9ec69a5972280eb296191b4e6e641b4810df34fbca1cae31b1622db4e932b2b94ac4cbc2ecdfab979ae60ea9824a7e809cd539c3f28a6a2589a91277281082ab892e0f726b1cebed61c68bdfd4c93f8c48a285e875dbfb90a46a1a168b2b25e2115edfcf27040703212b8a76b4d206aab0bed4235b023a2ef415be40cf32864d2fb0e8313a16e98b4a1e0777035203f926b51456bb0441e20119631f7e4cd3ef5e1307fb48312a5c646e2a8105ecbe6a290a809fb18a0d170e59020301000102820100271bed339e397de0a8ed437ab06506bbd67b9ceb95b719b32f6b7eee6cc917e05b21adc29e9286516415825f73cffa03965dc742e0a8dceb91774fff0127a42bc50d7a6622edaf4b493cc882d0452a034b5b4f5bf621d2c98a70b59d8b68a6b64cf6472f28c86b5cef465997263977b5400dd881fbc64a7c930c710f4b60bbafd30a6ead5a6184a01b9fd4fcd5d5a4be5e89442b7f80897e35443f159da6de1f911c14324afea504f505ae95f84c2b0a4c5e142b32a1c7ac0415d165c77fda2cf5e696d5b7c937abc5afa002cf58c85ed6af540ce388488371e3903ad48444d1dca3a5d93912b44a94a9d21f0523986829cd752a5538b30c91ccf5696906339702818100e2352b516e5f0e44ecbf6361be811897e287318095827420c96e63d3e2adb2712386066dacc7962280bbc8890d02f97afb9816bab1cb1b5339d6def2e2b9cbb7ae2223528b0a04298f02546b629f232ba2bbd5f290c6552196c0f4dc4814e407d499444e874c9da04213a7249ecc5c327e4309d23cfd0d8947d7daddc9cc431302818100d582efe894ce249859262c0a27867c87e8b6fbe417b2bc27fd1542873d76582000b31c10f4c41074df8a175c97eabe08bd112a3503951939d28cd393c93465f619ed4e5b90aa4d4e5bc919a6c0bba298ad8f00dc317594ab545fb808ed2084bbfaad5631fd279c7adb9ae6e55874e0aceb4591e7a3ac82d8f84e80206a882a6302818100ba3dd86a751ae21eb1656a27a1b79c4e00fe1a2da9eafc3dba5a9eea66e967cf6ad60018f0766b1001399a83ec2894cb42b61790a2ad7cd3eafd141699c12b0f11d99d876a5e56caf8a98c63d590fc5e02dfefe8847626c53edfa33a724670f05983cf0f70aa0de55241e80d68890d27ad78f86f1633aa9f6a7d37ffff13a3ed0281807f064d50e3e6d8a2c2b71110617f836b202a6d25c06b97c17ab24148506aadf72c3363093b75c20ca64973a8a4c1059a1151baf89b4f03190188c2ff737ef702395e9375aa5587748cead19601a8200e1183b89147e39a356c171e58412b4d8cc0908b6d661d40dd5ef58355031155f1ca6f3364ca5d81e32fa7145734ca19dd028180491522dd3c2eb7b1e612c5bb0c321e910e4037bbe88e4221d8d5d3fc95915acab6404c08a5360723b057342152213c12707fde00beb43c7113b8f7150f88c80eca521867f49c9ebd37f3d3c32ac76bcb521f15d01921dac0bdadee2b248db73471b53bbce26cbbc50a4c0772d982dfa1984addbb560a58eb7f02a55484d09a13', // pragma: allowlist secret
  publicKey:
    '30820122300d06092a864886f70d01010105000382010f003082010a0282010100bca9f007e74c4f256437e5d81b0dd7d2a5c1c934dbe15968b0201415f7611f816d742da515f707433b70b8c2cf0fd0e1fad7ff55805e059126778d79759b1467ed41594881ca9ec69a5972280eb296191b4e6e641b4810df34fbca1cae31b1622db4e932b2b94ac4cbc2ecdfab979ae60ea9824a7e809cd539c3f28a6a2589a91277281082ab892e0f726b1cebed61c68bdfd4c93f8c48a285e875dbfb90a46a1a168b2b25e2115edfcf27040703212b8a76b4d206aab0bed4235b023a2ef415be40cf32864d2fb0e8313a16e98b4a1e0777035203f926b51456bb0441e20119631f7e4cd3ef5e1307fb48312a5c646e2a8105ecbe6a290a809fb18a0d170e590203010001', // pragma: allowlist secret
  selfFingerprint: '6a290a809fb18a0d170e590203010001', // pragma: allowlist secret
  selfExchangeKey:
    '2e0e20a809aa336805ad7f933d4dbc4a18194d130b89d01369c48330e90ea845f2c960077a33721004cc759921759e2d3b302ec6989889a6e76863fa8a24dea33f8d0543fc975a16642d7a5508a1a2216e10d776bec61bb1a64ab1716af8d8e1348525c404bc57a0f33978faca9bb59df571279aec39f028ba49966a8faec7c376143c8e753c19d89da739d3e9d52ec1e25418c5d1d8c2b677c02fe2587b8e6cfcf14a84909b6e9759cc4f60beebd9d087b438d2fe2ee98b64a86cb24ec7c7ff32686773c53a5ee9374770764a70e662926af23e9595f5bdd0e9b6e9b420aa46764f2fe1583b06c46fd3991a60baa5faa191d141631b76540d05ac99f918c8f2', // pragma: allowlist secret
  toParentFingerprint: '9c315d03f4e4e0dd735d250203010001', // pragma: allowlist secret
  toParentExchangeKey:
    'a47381e623617b9f36272d0e9a9f7f3eb28232f10894d0d097d590399abf95a37a54a72fb063112bb0947828ce88a81e772aac1eac2fc31c3ea8e295c93319a08453ace46c863f389f3d7ce57d55c2642db4ffc8edf28d8bd957a80b940991ef237286df32e4cffc6efcf70f0c3b3a8f733742173dc0219f4a193dcd64c29e393d3c0ab4b21d69732c409bbe905ef460befda36b309d4097a63847db9fbfbebecf23eb768f3aed08d156f518ef9efc18ba5670312184d6f08ff4d20f5205aad6bc24bcd1b05cc92d14f7a0fc1c410b77a67b4619ac921f2fc96d2dbb779f5b029bd2f2a6894ae69f7b2047158936e009c5755ac5805b0fc8cf08ea84dd2d4d75', // pragma: allowlist secret
  toParentExchangeKeyOwnCopy:
    '91719b9311f00e8ea8880b5a4a2da4ca8e35e26d5f46d6640df5ad1bb4f61051547f90cf16c06b1480e5c73862920f33da8081c468d343c054b177e9b9b9680642fdb6dcdb49ad0a1fd0dde979bc2e5154781228d46cbcd2ad33756e372459eb2267fd6bdaba4cacb2f345acef94251521cc5320cd22606398163cd6f40e3d7b1be6832017513960bc4c24490b9f11458958ccc9ae376eee8501374a540c91ec60a98e6d3c9132288e032b7143f75c33b790a499e40052511e7cc282e8a20e59454df29cc3332296ce583d35fbf145ba9ab2268c30fb105df5ee291aa90b33a90a15f9b891294b1c952748d65031d00b2a7db17712f171bb6190a9483c47360e', // pragma: allowlist secret
  selfDelegationKey:
    '93a5601d3fd899ac9a7493f7222be465f77ee7925cc6fbf0ece66f799aaab0b19b80f9998ed1c738bf5672468a3de2cb6d6f2493a601c28dafcdbba8a50d0a1c67e70bd3a7786e423cba7601fa851b9b29ba15f8c5c97e92dd6bec338599c0a9', // pragma: allowlist secret
  toParentDelegationKey:
    '815d54c92b2a4b18194698c31343aa40ebe5f525b1fa1d178150fe50f5f39125ac400580d2a37df486c505960348d6ab9f8fa3e7ce94bccd23dc8622e5c285be2b0eed7b0142e00bfe81d8840eb64aad3eaa0b47373eecd78024f4c47b86bde3', // pragma: allowlist secret
  selfEncryptionKey:
    '11aa5c306539cae18625164724d4a7141be0bb5ebc888b9c6255f2aa6c93f7e96b1b5c38a0355a82d0d9667a3d4606eb73d733b02581a6f1cbc4dda9c71ee831ce5648be7f06443a830872974b73cfac6e6d5b0aaa04ecd186a2551f73203b10', // pragma: allowlist secret
  toParentEncryptionKey:
    '24fd6f9e63f75cbe7ee8d3d5b8c18befda21dc35b4cfed0860434ff296e10023534da97b00d5a09372c7264ac44c45a20f5c2a1858515f75a70a922009228c1245d6401ef1f9f7a30cf63f6db765ddfb7e12f27243691ff6c5116931c9479e6c', // pragma: allowlist secret
  encryptedSelf: 'zqX7C7Jxgm0Kx0XMByQqnn/F3QSD3wJabtxBX2bMM1U=', // pragma: allowlist secret
}

function legacyAesExchangeKeys(fixture: LegacyOwnerFixture, ownId: string, parentId: string): HealthcareParty['aesExchangeKeys'] {
  return {
    [fixture.publicKey]: {
      [ownId]: { [fixture.selfFingerprint]: fixture.selfExchangeKey },
      [parentId]: {
        [fixture.toParentFingerprint]: fixture.toParentExchangeKey,
        [fixture.selfFingerprint]: fixture.toParentExchangeKeyOwnCopy,
      },
    },
  }
}

function legacyPatientBase(fixture: LegacyOwnerFixture, ownId: string, parentId: string, firstName: string): Patient {
  return {
    id: randomUUID(),
    firstName,
    lastName: 'Doe',
    delegations: {
      [ownId]: [{ owner: ownId, delegatedTo: ownId, key: fixture.selfDelegationKey }],
      [parentId]: [{ owner: ownId, delegatedTo: parentId, key: fixture.toParentDelegationKey }],
    },
    encryptionKeys: {
      [ownId]: [{ owner: ownId, delegatedTo: ownId, key: fixture.selfEncryptionKey }],
      [parentId]: [{ owner: ownId, delegatedTo: parentId, key: fixture.toParentEncryptionKey }],
    },
    encryptedSelf: fixture.encryptedSelf,
  }
}

/**
 * Creates a data owner with a caller-provided (fixed or freshly generated) RSA keypair, an
 * optional parent and aesExchangeKeys (for legacy fixture owners), and an initialised api for it.
 * extraKeys lets the returned api locally hold another data owner's key too (e.g. the shared
 * parent's), simulating a device/session with access to multiple keys.
 */
async function createFixedKeyDataOwner(
  testSetupApi: IcureApi,
  id: string,
  opts: {
    firstName: string
    privateKey: string
    publicKey: string
    parentId?: string
    aesExchangeKeys?: HealthcareParty['aesExchangeKeys']
    autoDelegations?: string[]
    extraKeys?: { dataOwnerId: string; privateKey: string; publicKey: string }[]
  }
): Promise<{ api: IcureApi; user: User }> {
  await testSetupApi.healthcarePartyApi.createHealthcareParty({
    id,
    firstName: opts.firstName,
    lastName: 'Doe',
    parentId: opts.parentId,
    publicKey: opts.publicKey,
    aesExchangeKeys: opts.aesExchangeKeys,
  })
  const login = `csm814-${opts.firstName.toLowerCase()}-${randomUUID()}`
  const password = randomUUID()
  await testSetupApi.userApi.createUser({
    id: randomUUID(),
    name: login,
    status: User.StatusEnum.ACTIVE,
    login,
    passwordHash: password,
    healthcarePartyId: id,
    autoDelegations: opts.autoDelegations ? { all: opts.autoDelegations } : undefined,
    email: `${login}@icure.com`,
  })
  const storage = await testStorageWithKeys([
    { dataOwnerId: id, pairs: [{ keyPair: { privateKey: opts.privateKey, publicKey: opts.publicKey }, shaVersion: ShaVersion.Sha1 }] },
    ...(opts.extraKeys ?? []).map((k) => ({
      dataOwnerId: k.dataOwnerId,
      pairs: [{ keyPair: { privateKey: k.privateKey, publicKey: k.publicKey }, shaVersion: ShaVersion.Sha1 }],
    })),
  ])
  const api = await IcureApi.initialise(env.iCureUrl, { username: login, password }, new TestCryptoStrategies(), webcrypto as any, fetch, {
    storage: storage.storage,
    keyStorage: storage.keyStorage,
    entryKeysFactory: storage.keyFactory,
  })
  const user = await api.userApi.getCurrentUser()
  return { api, user }
}

/** Creates a patient the normal (v8) way and immediately shares its secret id with parentId. */
async function createV8PatientSharedWithParent(ownerApi: IcureApi, ownerUser: User, parentId: string, firstName: string): Promise<Patient> {
  const created = await ownerApi.patientApi.createPatientWithUser(
    ownerUser,
    await ownerApi.patientApi.newInstance(ownerUser, { firstName, lastName: 'Doe' })
  )
  const secretIds = await ownerApi.patientApi.decryptSecretIdsOf(created)
  return await ownerApi.patientApi.shareWithMany(created, { [parentId]: { shareSecretIds: secretIds } })
}

/** Inserts a legacy (v7-native, already shared with parentId) patient directly from its fixture. */
async function createV7PatientSharedWithParent(
  ownerApi: IcureApi,
  fixture: LegacyOwnerFixture,
  ownerId: string,
  parentId: string,
  firstName: string
): Promise<Patient> {
  return new IccPatientApi(env.iCureUrl, {}, ownerApi.authApi.authenticationProvider, fetch).createPatient(
    legacyPatientBase(fixture, ownerId, parentId, firstName)
  )
}

/**
 * Creates a fresh hcp (random keypair) and makes it a child of parentId, to establish the existing
 * relationship that operations such as mergePatients require between data owners in order to
 * authorize the operation (an entirely unrelated hcp gets a 403).
 *
 * By default this does NOT give the child a locally-held copy of the parent's key
 * (disableParentKeysInitialisation skips the startup check that would otherwise require one): in
 * tests where we only care about the authorization relationship, we don't want the child to also
 * be able to reach anything shared with the parent through a locally-cached parent key, which
 * would muddy visibility assertions.
 * Pass holdParentKey: true for tests that specifically want to exercise genuine hierarchical
 * inheritance (a child that has actually verified/cached its parent's key, like a properly
 * provisioned device in the same care organisation - as opposed to the confidentiality checks
 * elsewhere in this suite, which intentionally avoid this).
 */
async function createChildOfParent(
  testSetupApi: IcureApi,
  parentId: string,
  parentKeys?: { privateKey: string; publicKey: string }
): Promise<{ api: IcureApi; user: User; id: string }> {
  const info = await createNewHcpApi(env)
  await testSetupApi.healthcarePartyApi.modifyHealthcareParty({
    ...(await testSetupApi.healthcarePartyApi.getHealthcareParty(info.credentials.dataOwnerId)),
    parentId,
  })
  const storage = await testStorageWithKeys([
    {
      dataOwnerId: info.credentials.dataOwnerId,
      pairs: [{ keyPair: { privateKey: info.credentials.privateKey, publicKey: info.credentials.publicKey }, shaVersion: ShaVersion.Sha1 }],
    },
    ...(parentKeys ? [{ dataOwnerId: parentId, pairs: [{ keyPair: parentKeys, shaVersion: ShaVersion.Sha1 }] }] : []),
  ])
  const api = await IcureApi.initialise(
    env.iCureUrl,
    { username: info.credentials.user, password: info.credentials.password },
    new TestCryptoStrategies(),
    webcrypto as any,
    fetch,
    { storage: storage.storage, keyStorage: storage.keyStorage, entryKeysFactory: storage.keyFactory, disableParentKeysInitialisation: !parentKeys }
  )
  const user = await api.userApi.getCurrentUser()
  return { api, user, id: info.credentials.dataOwnerId }
}

describe('CSM-814', async function () {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    hierarchyApis = await createHcpHierarchyApis(env)
  })

  it('A user should be able to share a just created patient secret id', async function () {
    const { childApi, childUser, child2Api, child2User, grandCredentials } = hierarchyApis
    const pat = await childApi.patientApi.createPatientWithUser(
      childUser,
      await childApi.patientApi.newInstance(childUser, {
        firstName: 'John',
        lastName: 'Doe',
      })
    )
    const initialSecretIds = await childApi.patientApi.decryptSecretIdsOf(await childApi.patientApi.getPatientWithUser(childUser, pat.id))
    expect(initialSecretIds).to.have.length(1)
    expect(await child2Api.patientApi.decryptSecretIdsOf(await child2Api.patientApi.getPatientWithUser(child2User, pat.id))).to.have.members(
      initialSecretIds
    )
    const newSecretId = randomUUID()
    const allSecretIds = [...initialSecretIds, newSecretId]
    await childApi.patientApi.shareWithMany(pat, {
      [grandCredentials.dataOwnerId]: {
        shareSecretIds: allSecretIds,
      },
    })
    expect(await childApi.patientApi.decryptSecretIdsOf(await childApi.patientApi.getPatientWithUser(childUser, pat.id))).to.have.members(
      allSecretIds
    )
    expect(await child2Api.patientApi.decryptSecretIdsOf(await child2Api.patientApi.getPatientWithUser(child2User, pat.id))).to.have.members(
      allSecretIds
    )
  })

  it('A user should be able to share the secret id of a just created patient and add a new secret id to a legacy patient created by an old sdk version, in the same operation', async function () {
    const testSetupApi = await initMasterApi(env)

    // P, the shared parent of A and B, and the delegate the legacy patient is already shared with.
    const pId = randomUUID()
    const { api: pApi, user: pUser } = await createFixedKeyDataOwner(testSetupApi, pId, {
      firstName: 'Jane',
      privateKey: pPrivateKey,
      publicKey: pPublicKey,
    })

    const aId = randomUUID()
    const { api: aApi, user: aUser } = await createFixedKeyDataOwner(testSetupApi, aId, {
      firstName: 'John',
      privateKey: aFixture.privateKey,
      publicKey: aFixture.publicKey,
      parentId: pId,
      aesExchangeKeys: legacyAesExchangeKeys(aFixture, aId, pId),
      autoDelegations: [pId],
      extraKeys: [{ dataOwnerId: pId, privateKey: pPrivateKey, publicKey: pPublicKey }],
    })
    const patient = await createV7PatientSharedWithParent(aApi, aFixture, aId, pId, 'John')

    // B, a sibling of A under the same parent P. B does not have any direct access to the patient,
    // but has access to P's key (e.g. a shared workstation), so it should be able to decrypt
    // anything shared with P, both before and after the new secret id is added.
    const bInfo = await createNewHcpApi(env)
    await testSetupApi.healthcarePartyApi.modifyHealthcareParty({
      ...(await testSetupApi.healthcarePartyApi.getHealthcareParty(bInfo.credentials.dataOwnerId)),
      parentId: pId,
    })
    const bStorage = await testStorageWithKeys([
      { dataOwnerId: pId, pairs: [{ keyPair: { privateKey: pPrivateKey, publicKey: pPublicKey }, shaVersion: ShaVersion.Sha1 }] },
      {
        dataOwnerId: bInfo.credentials.dataOwnerId,
        pairs: [{ keyPair: { privateKey: bInfo.credentials.privateKey, publicKey: bInfo.credentials.publicKey }, shaVersion: ShaVersion.Sha1 }],
      },
    ])
    const bApi = await IcureApi.initialise(
      env.iCureUrl,
      { username: bInfo.credentials.user, password: bInfo.credentials.password },
      new TestCryptoStrategies(),
      webcrypto as any,
      fetch,
      {
        storage: bStorage.storage,
        keyStorage: bStorage.keyStorage,
        entryKeysFactory: bStorage.keyFactory,
      }
    )
    const bUser = await bApi.userApi.getCurrentUser()

    // P's own login can't yet resolve the pure-legacy (v7-native) delegation directly - that legacy
    // format is only self-service-resolvable by its owner (A) or by a session that already holds
    // the delegate's private key locally (B, standing in for a shared workstation), same as
    // test/icc-x-api/crypto/legacy-metadata-migration-test.ts never checks a bare "p" login against
    // pure legacy data either. Once A performs a real (v8) share below, P's own login resolves fine.
    const initialSecretIds = await aApi.patientApi.decryptSecretIdsOf(await aApi.patientApi.getPatientWithUser(aUser, patient.id!))
    expect(initialSecretIds).to.have.length(1)
    expect(await bApi.patientApi.decryptSecretIdsOf(await bApi.patientApi.getPatientWithUser(bUser, patient.id!))).to.have.members(initialSecretIds)

    const newSecretId = randomUUID()
    const allSecretIds = [...initialSecretIds, newSecretId]
    await aApi.patientApi.shareWithMany(patient, {
      [pId]: { shareSecretIds: allSecretIds },
    })

    expect(await aApi.patientApi.decryptSecretIdsOf(await aApi.patientApi.getPatientWithUser(aUser, patient.id!))).to.have.members(allSecretIds)
    expect(await pApi.patientApi.decryptSecretIdsOf(await pApi.patientApi.getPatientWithUser(pUser, patient.id!))).to.have.members(allSecretIds)
    expect(await bApi.patientApi.decryptSecretIdsOf(await bApi.patientApi.getPatientWithUser(bUser, patient.id!))).to.have.members(allSecretIds)
  })

  describe('mergePatients', function () {
    type Version = 'v8' | 'v7'
    type MergedBy = 'A' | 'B'
    const versions: Version[] = ['v8', 'v7']
    const mergedBys: MergedBy[] = ['A', 'B']
    const variants: { fromVersion: Version; intoVersion: Version; mergedBy: MergedBy }[] = versions.flatMap((fromVersion) =>
      versions.flatMap((intoVersion) => mergedBys.map((mergedBy) => ({ fromVersion, intoVersion, mergedBy })))
    )

    /**
     * Sets up a shared parent P and two sibling hcps A and B (each with their own fixed keypair,
     * both holding P's key locally too, standing in for a shared workstation - so that regardless
     * of which of A/B performs the merge, and regardless of how much direct access the merge
     * propagates to each side, both can fall back on P's key to reach anything shared with P).
     */
    async function setupParticipants(): Promise<{
      testSetupApi: IcureApi
      pId: string
      aId: string
      bId: string
      aApi: IcureApi
      aUser: User
      bApi: IcureApi
      bUser: User
    }> {
      const testSetupApi = await initMasterApi(env)

      const pId = randomUUID()
      await createFixedKeyDataOwner(testSetupApi, pId, { firstName: 'Jane', privateKey: pPrivateKey, publicKey: pPublicKey })

      const aId = randomUUID()
      const { api: aApi, user: aUser } = await createFixedKeyDataOwner(testSetupApi, aId, {
        firstName: 'John',
        privateKey: aFixture.privateKey,
        publicKey: aFixture.publicKey,
        parentId: pId,
        aesExchangeKeys: legacyAesExchangeKeys(aFixture, aId, pId),
        autoDelegations: [pId],
        extraKeys: [{ dataOwnerId: pId, privateKey: pPrivateKey, publicKey: pPublicKey }],
      })

      const bId = randomUUID()
      const { api: bApi, user: bUser } = await createFixedKeyDataOwner(testSetupApi, bId, {
        firstName: 'Jack',
        privateKey: bFixture.privateKey,
        publicKey: bFixture.publicKey,
        parentId: pId,
        aesExchangeKeys: legacyAesExchangeKeys(bFixture, bId, pId),
        autoDelegations: [pId],
        extraKeys: [{ dataOwnerId: pId, privateKey: pPrivateKey, publicKey: pPublicKey }],
      })

      return { testSetupApi, pId, aId, bId, aApi, aUser, bApi, bUser }
    }

    for (const variant of variants) {
      it(`merges a ${variant.fromVersion} patient owned by A into a ${variant.intoVersion} patient owned by B, both shared with the same parent P, merge performed by ${variant.mergedBy}`, async function () {
        const { pId, aId, bId, aApi, aUser, bApi, bUser } = await setupParticipants()

        const pA =
          variant.fromVersion === 'v8'
            ? await createV8PatientSharedWithParent(aApi, aUser, pId, 'John')
            : await createV7PatientSharedWithParent(aApi, aFixture, aId, pId, 'John')
        const pB =
          variant.intoVersion === 'v8'
            ? await createV8PatientSharedWithParent(bApi, bUser, pId, 'Jack')
            : await createV7PatientSharedWithParent(bApi, bFixture, bId, pId, 'Jack')

        const aSecretId = (await aApi.patientApi.decryptSecretIdsOf(pA))[0]
        const bSecretId = (await bApi.patientApi.decryptSecretIdsOf(pB))[0]
        expect(aSecretId).to.not.be.undefined
        expect(bSecretId).to.not.be.undefined
        const allSecretIds = [aSecretId, bSecretId]

        // Re-fetch right before merging: A's autoDelegations (and B's, symmetrically) may still be
        // asynchronously finishing an auto-share in the background after creation, which would
        // otherwise leave us holding a stale rev and make the merge fail with a 409 conflict.
        const freshPA = await aApi.patientApi.getPatientWithUser(aUser, pA.id!)
        const freshPB = await bApi.patientApi.getPatientWithUser(bUser, pB.id!)

        const merger = variant.mergedBy === 'A' ? aApi : bApi
        const otherId = variant.mergedBy === 'A' ? bId : aId
        const mergedInto = await merger.patientApi.mergePatients(freshPA, freshPB)

        // Documented merge metadata: `from` is soft-deleted and points to `into`; `into` records the merge.
        const fromAfterMerge = await aApi.patientApi.getPatientWithUser(aUser, pA.id!)
        expect(fromAfterMerge.deletionDate).to.not.be.undefined
        expect(fromAfterMerge.mergeToPatientId).to.equal(pB.id)
        expect(mergedInto.mergedIds).to.include(pA.id)

        // Per mergePatients' own documentation, the merge alone does not share the merged content
        // with users that only had access to one of the two original entities: the merger (who per
        // the docs gets full access to everything as a result of the merge) has to explicitly share
        // with the other sibling afterwards for both to end up with full access to both secret ids.
        await merger.patientApi.shareWithMany(mergedInto, { [otherId]: { shareSecretIds: allSecretIds } })

        expect(await aApi.patientApi.decryptSecretIdsOf(await aApi.patientApi.getPatientWithUser(aUser, mergedInto.id!))).to.have.members(
          allSecretIds
        )
        expect(await bApi.patientApi.decryptSecretIdsOf(await bApi.patientApi.getPatientWithUser(bUser, mergedInto.id!))).to.have.members(
          allSecretIds
        )
      })
    }
  })

  /*
   * mergePatients only merges the two entities' existing security metadata (secret id/encryption
   * key delegations) server-side, without decrypting anything: whatever a data owner could access
   * on one of the two original patients, it can still access on the merged patient, and nothing
   * more. In particular:
   * - a secret id that was never shared with anyone but its owner (e.g. a confidential secret id)
   *   stays known only to that owner after the merge
   * - a secret id that was shared with a third party (here, a common parent P of A and B) is still
   *   known to that third party after the merge
   * - none of this depends on which of A, B, or a completely unrelated third hcp performs the merge,
   *   since the merger's own identity only matters for re-encrypting the `into` patient's content
   *   for itself, not for the secret id metadata merge itself.
   */
  describe('mergePatients preserves secret id visibility independently of the merger', function () {
    const mergers = ['A', 'B', 'C'] as const

    for (const merger of mergers) {
      it(`keeps every secret id visible to exactly the data owners it was shared with before the merge, regardless of who performs it (merged by ${merger})`, async function () {
        const testSetupApi = await initMasterApi(env)
        const pInfo = await createNewHcpApi(env)
        const pId = pInfo.credentials.dataOwnerId
        // A, B and the merger C are all children of the same parent P: mergePatients (like most
        // write operations) is only authorized between data owners that have some existing
        // relationship, so an entirely unrelated hcp couldn't perform the merge at all - C stands
        // in for "anyone else in the same care organisation", not a random stranger.
        const aInfo = await createChildOfParent(testSetupApi, pId)
        const bInfo = await createChildOfParent(testSetupApi, pId)
        const cInfo = await createChildOfParent(testSetupApi, pId)

        // PatientA: s1 stays confidential (known only to A), s2 gets shared with the parent P.
        const createdPA = await aInfo.api.patientApi.createPatientWithUser(
          aInfo.user,
          await aInfo.api.patientApi.newInstance(aInfo.user, { firstName: 'John', lastName: 'Doe' })
        )
        const s1 = (await aInfo.api.patientApi.decryptSecretIdsOf(createdPA))[0]
        const s2 = randomUUID()
        const pA = await aInfo.api.patientApi.shareWithMany(createdPA, { [pId]: { shareSecretIds: [s2] } })

        // PatientB: s3 stays confidential (known only to B), s4 gets shared with the same parent P.
        const createdPB = await bInfo.api.patientApi.createPatientWithUser(
          bInfo.user,
          await bInfo.api.patientApi.newInstance(bInfo.user, { firstName: 'Jack', lastName: 'Doe' })
        )
        const s3 = (await bInfo.api.patientApi.decryptSecretIdsOf(createdPB))[0]
        const s4 = randomUUID()
        const pB = await bInfo.api.patientApi.shareWithMany(createdPB, { [pId]: { shareSecretIds: [s4] } })

        const mergerApi = merger === 'A' ? aInfo.api : merger === 'B' ? bInfo.api : cInfo.api
        const freshPA = await aInfo.api.patientApi.getPatientWithUser(aInfo.user, pA.id!)
        const freshPB = await bInfo.api.patientApi.getPatientWithUser(bInfo.user, pB.id!)
        const merged = await mergerApi.patientApi.mergePatients(freshPA, freshPB)

        expect(await aInfo.api.patientApi.decryptSecretIdsOf(await aInfo.api.patientApi.getPatientWithUser(aInfo.user, merged.id!))).to.have.members([
          s1,
          s2,
        ])
        expect(await bInfo.api.patientApi.decryptSecretIdsOf(await bInfo.api.patientApi.getPatientWithUser(bInfo.user, merged.id!))).to.have.members([
          s3,
          s4,
        ])
        expect(await pInfo.api.patientApi.decryptSecretIdsOf(await pInfo.api.patientApi.getPatientWithUser(pInfo.user, merged.id!))).to.have.members([
          s2,
          s4,
        ])
      })
    }
  })

  /*
   * mergePatients forcefully disables merging the `from` patient's encryption key into the `into`
   * patient (the `into` patient keeps only its own, pre-existing encryption key): the method
   * expects callers to be working with decrypted patients, so there is no need to end up with two
   * distinct encryption keys on the merged patient the way kraken would by default.
   * One consequence is a corner case: if the `into` patient's encryption key was never shared with
   * a party that *did* have the `from` patient's encryption key, that party loses the ability to
   * decrypt the merged patient's content (though not its secret ids, which are unaffected and still
   * merge normally) - a followup shareWith/shareWithMany restores it. Sharing only the encryption
   * key (shareSecretIds: []) again with someone who already has it is a harmless no-op, even when
   * the caller isn't the entity's original creator.
   */
  describe('mergePatients does not merge encryption keys, and a follow-up shareWith restores lost access', function () {
    it('drops the encryption key of the from patient, and a shareWith with empty shareSecretIds afterwards fixes decryption for whoever needs it', async function () {
      const testSetupApi = await initMasterApi(env)
      const pInfo = await createNewHcpApi(env)
      const pId = pInfo.credentials.dataOwnerId
      // A and B are children of the same parent P, so that A is authorized to merge B's patient
      // into its own (see the note above about mergePatients requiring an existing relationship).
      // B additionally holds P's key locally (holdParentKey), like a properly provisioned device
      // in the same care organisation, so that anything shared with P is genuinely, automatically
      // reachable by B too - this is what the redundant-reshare check below relies on.
      const aInfo = await createChildOfParent(testSetupApi, pId)
      const bInfo = await createChildOfParent(testSetupApi, pId, { privateKey: pInfo.credentials.privateKey, publicKey: pInfo.credentials.publicKey })

      // PatientA created by hcpA, but for some reason not shared with the parent at all.
      const pA = await aInfo.api.patientApi.createPatientWithUser(
        aInfo.user,
        await aInfo.api.patientApi.newInstance(aInfo.user, { firstName: 'John', lastName: 'Doe', note: 'note from A' })
      )

      // PatientB created by hcpB and properly shared with the parent (secret id + encryption key).
      const createdPB = await bInfo.api.patientApi.createPatientWithUser(
        bInfo.user,
        await bInfo.api.patientApi.newInstance(bInfo.user, { firstName: 'Jack', lastName: 'Doe', note: 'note from B' })
      )
      const bSecretId = (await bInfo.api.patientApi.decryptSecretIdsOf(createdPB))[0]
      const pB = await bInfo.api.patientApi.shareWithMany(createdPB, { [pId]: { shareSecretIds: [bSecretId] } })
      expect(await pInfo.api.patientApi.decryptSecretIdsOf(await pInfo.api.patientApi.getPatientWithUser(pInfo.user, pB.id!))).to.have.members([
        bSecretId,
      ])

      // hcpA merges PatientB into PatientA: PatientB's secret id still gets merged in (unaffected),
      // but PatientA's own encryption key is the only one that survives on the merged patient - so
      // even though the parent could decrypt PatientB's content a moment ago, it now can't decrypt
      // the merged patient's content at all (note comes back undefined), despite still being able to
      // find the merged-in secret id.
      const freshPA = await aInfo.api.patientApi.getPatientWithUser(aInfo.user, pA.id!)
      const freshPB = await bInfo.api.patientApi.getPatientWithUser(bInfo.user, pB.id!)
      const merged = await aInfo.api.patientApi.mergePatients(freshPB, freshPA)

      expect(await pInfo.api.patientApi.decryptSecretIdsOf(await pInfo.api.patientApi.getPatientWithUser(pInfo.user, merged.id!))).to.have.members([
        bSecretId,
      ])
      expect((await pInfo.api.patientApi.getPatientWithUser(pInfo.user, merged.id!)).note).to.be.undefined

      // hcpA shares just the encryption key with the parent to fix this: shareSecretIds is left
      // empty (no new secret id to share) and shareEncryptionKey defaults to IF_AVAILABLE, which
      // applies here since A currently holds the only surviving encryption key. This is a real
      // change (the parent never had access to this specific entity before), so the rev changes.
      const resharedByA = await aInfo.api.patientApi.shareWith(pId, merged, [])
      expect(resharedByA.rev).to.not.equal(merged.rev)

      // Redundant shareWith of an already-shared encryption key, this time performed by B rather
      // than A (the entity's current, and only, encryption key holder): B is a child of the same
      // parent P and genuinely holds P's key locally (like a properly provisioned device in the
      // same care organisation), so B can decrypt the A->P delegation and see that P already has
      // this encryption key directly. This is a harmless no-op - there is nothing new to grant, so
      // the rev stays unchanged, even though B itself never granted this access.
      const reshareAgain = await bInfo.api.patientApi.shareWith(pId, resharedByA, [])
      expect(reshareAgain.rev).to.equal(resharedByA.rev)

      // shareWithMany to a mix of delegates that already have the key (the parent, a no-op) and
      // delegates that don't yet (a fresh, unrelated hcp, a real change) also works cleanly -
      // explicitly (and, for the parent, wastefully) re-granting access that in a real hierarchy
      // might already be inherited, but not harmfully so. Since D's part is a real change, the rev
      // still changes overall, and D can now decrypt the content.
      const dInfo = await createNewHcpApi(env)
      const sharedWithBoth = await aInfo.api.patientApi.shareWithMany(reshareAgain, {
        [pId]: { shareSecretIds: [] },
        [dInfo.credentials.dataOwnerId]: { shareSecretIds: [] },
      })
      expect(sharedWithBoth.rev).to.not.equal(reshareAgain.rev)
      expect((await dInfo.api.patientApi.getPatientWithUser(dInfo.user, sharedWithBoth.id!)).note).to.equal('note from A')
    })
  })
})
