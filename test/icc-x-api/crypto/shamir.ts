import 'isomorphic-fetch'
import { ShamirClass, WebcryptoShamir } from '../../../icc-x-api/crypto/shamir'
import { expect } from 'chai'
import 'mocha'
import { IcureApi, RSAUtilsImpl, ShaVersion, ua2hex } from '../../../icc-x-api'
import {
  createHcpHierarchyApis,
  getEnvironmentInitializer,
  hcp1Username,
  hcp2Username,
  hcp3Username,
  setLocalStorage,
  TestUtils,
} from '../../utils/test_utils'
import initApi = TestUtils.initApi
import { before } from 'mocha'
import { testStorageWithKeys } from '../../utils/TestStorage'
import { webcrypto } from 'crypto'
import { TestCryptoStrategies } from '../../utils/TestCryptoStrategies'
import { FilterChainMaintenanceTask } from '../../../icc-api/model/FilterChainMaintenanceTask'
import { MaintenanceTaskAfterDateFilter } from '../../../icc-x-api/filters/MaintenanceTaskAfterDateFilter'
import { KeyPairUpdateRequest } from '../../../icc-x-api/maintenance/KeyPairUpdateRequest'
import { RSAUtils } from '../../../icc-x-api/crypto/RSA'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { fingerprintV1, fingerprintV1toV2, fingerprintV2 } from '../../../icc-x-api/crypto/utils'

// Data was randomly generated, not based on any real key
const data =
  '77b3bb3ac6852a388b2aea8ba1794e63c95a87d10753afbdf8672b607b0ca7c03b39b30b2303bc417de1c78b326cf52810469914ea7dd8128b9f2e5d8f376cdb16b75a8e9dffb12b7c839d6fcf9ef8b6e220ab7973ad76e057038988d9a084f06a9d83cc9c3ee998ad0fcc317bb6c7a1bed8126ceb8463d59e84b50087d15d293970606cfe61f874e3f4efb182107aa971304a88b9821e74b1e6c88e7d0bb8882ab0ba35591e4e8d829fb973a26b480fe7432537b025c1177077689e86b5ff65b39a9d618e1cd8c129ae2b2a981664074301e9265e9842ec0c9e9a95f27a1066336578e06e3f3373d3a98b3b8182e55accc6795bbe9aaaf758179d09eccecc8a21f9f77e660a99e0e652cf39077ef083020d9c9d479fb6751de39e29feb7bcf9c73ee9e9d25f54683d55a82768f603b910b40ccb006d96c25f23ccf88e620c20d5495e11e83859d38bb5314a763c76149b3bcf6d987e6e98b83583f028fd6cfc363cb544673eb5d6cf5a7f9887d78a5a5d5b0a862ca3127a6d359a1a2ea8f332360fb7c4a8fe855eac200735322cd322eab431e659377ad9f9289a2d97152598333f4ca97e8003bdbc2d8b714a72a3bdd4f1b124674d6c2eda71b59f07f073de030795c562658c1a63e03d7de12f6ff57e328f83e05462c588ec7371af9b19f726f04162db61860e2c40e3d01b46cdab6f38a526ba555d09bdbde5702d6ae977f38e51314b20d333e84e645fc08ccc59be6e87aa349ec30e9b3a6c06c9b58693b8d67e8a7259be86b240431f44fb75c05d6a8578ffced3514fecc10e5ed7a052c85484d8b86276f7cd74a57402d79e0de85cb8006272b4c61d6f71ebe6cb039c0604fd4ab6bf2e5c686c5cb10be41a06087c3a598c6115153ad0ff6fd6644de8838b877b63a1c9ad348806e6e5e4962630ce84926b0596028c9bf4fb78cad55a0c7dac4e1b46eef6f76cea2707afc5499c055e56b9545501029b714cff01e3aea3ae955607b686d21f6c453bd6291627cad9502a1d200deb13ca47f45aae1a88c7ee288d5e59c10ea5aecdd681c1f30b67720ba045c6a1174b4b1bf2ba5af90a22d6be4f281d946666015dda5ad79a20bd0c7c43c4e52ddbe10776464e76ae2e883bc5cd2ba965c775227b3ce482f1f764a95a99888ca68c023a530df6ebe0193742f233db700a100cd568342a3d4bd648ee18b6d1de8a9b7cefdcee7858feb886c013286fbafd489d57a46f70b1b676bf6a7cf74a52f13c6d09a7b23cff8a366e78d35c5c69952445739fe1cf5a5815c111808d731d37f6a33f477cee2dcfbaccba65a43e1e1b5dad4c81549a1ebef5ac1bb5814cdf58ba5849ec66095f1e3bb5a1ea48f9fa746553c15580cf98f1a06f630d0b86b95711f3d9381d50711c1f6b8e63e677c77a21a772b921935ccb17a017ce4955e8fcf8fca4bb72e9c4457bf80c471004083676b1410e697b15db4ae9026b9dd2bc222faf9e68a9e4a2eb7bf1ffbd23b23500b1f97e49f1348f64a467fae59a0d2a34c4a7d084d445a86018a48aedad5b0f7b523e5e1af3d3d66a9323cd4fd1a6f1d78611a85204fb5baf09c5b3c559e6e7b574cec7d3a62d81f3b36c43f93de072fa8477b898e824aa18cf971983f931257dccd902fac7766ef934a2e942dfe6a4bb06b103fba46e77d15e780cc58ccc343b83b310f548f46e8a49ed1750722dade4c9acb8cbc0c0fa0de153'
const shares = [
  '801231b3513d19f3eaa4dad6cbb40fe4fa000a0df070eda11224feda86242674698a8fa533db9790d9dbc195ca209d012ed20fb1f8c31bb4d27873521036c820f508efd74c566e73975956e54ba00174e6979a6f29ff026a452f8899d5376779020050cd5cc4d05e8c27e545fa6eb4ef25f78df9b4a3ee38ee227b26e41c71356c3408e6da6013ea1981145c7a67d1106f391d78dfd7c8b91d0aebe30901de9646e9db7f74883d05228082b71d0489c9f1214bf8910124e5be4fead82b170faa2d046ef33c27da7a6c1ff8a4c875698eea3f5a1d685ba98674ed69beaa3c2eebce9732ca3c930f5c35a3747953e6ebeae58f976cc090016ecfb5604bf65d0b87ffe4aa5ee6cc57f69b3653397857b41116141b88f3b7942a88eb98dc160d0059267300e351c740461bb440ff329ff3f1abf3b2a75f3b603b6e48165c8c032b0c1b025fed43645af4bcfe9cdfdba00aec8627f82b8c72815a00431acd2b253891085c5f47064bfa015231c62a1711a4ac6792eb39c5c2820e0d6cc2d959874302494add79ac668fa6fb226a25a3b76caafb702eb5cf63ea05e8a5506ea9fcda3530ea22f9bc9602f476868db253cc1ce9b9cd311a67613c90fad0524587ccfb43e1b36133c69e4663b2bc1f157eeda3c7e64c54b17881a485ca6434d09ef6800036fccea47be3f31c21fe015844563015153743df86f98e60f2aef6d5ee7b969818c186160117e524b9b3c2299feb934d0a08f07978447672bf021e15c40d92721694566889df7826631bae3314075e1a1db00767e1d8e7b009c66a3adaf7260c7db97a2244cafca971a7adb5d1babbb115fb178acf08e2d70640bd123538a7f71947b714a38c2b20654feb3b92f261e64481354580570ada0884951ae24684983b1b012ea66901da7f5a0df3057b3f8f0db2519bf2e02c24b109a318d4af4ce5db59f08edad34c8fbd0189c93dd91f73b19c1f6614302d6c94129d7f12671e7c8af884a932932aa59a22442191f806515c5c3facadb6d7f9ab1ae2d178976a1b35b7578a0fed708bba2da6e795a945126d0c9c5e31e945b1e17db4467a2717ccc55dcc03a11325ab5027b613416642bcdc40d9fd495f6939d2cd93bfbaaa81eac6af48ef8e07a8bcf1afc2bc0e1dd5dbfe9622c881c56176e004c0a93faa7ecb0c1aa63d980ee3832ee7ce7d2460618a52471aa2f54477ee97cb23a10c1c183ad243159839c50efacf15ec07961ddd5a7bd68205ea071695486c4801fc77f79372441a353ad23c17397976d4ffd87b5ba2ae189ec496b6de3a6648a90a8a7ba870bcbf307a847205cf3e76222e1cda233a1d96140df29b70480462eb48674925045668c2605efd0777b1fe4aab30a961d3b937bb938962849b9a70fc7def66f837e5a3509fda88e571d631f5aa53d2faa3403a8f9da43ddfd75318721ed6a70c00179696b1ba1ecaa27e7495193cbceffb7e50ff9778ecfa2c0d7525c91b7b9c3e13b9defd5d132eacbdd8d4494bab9b097cd1f0f61356e2635f6428e3d32206d4874c6aa04ee27e3b61495b491d5b855133d9ad19591cfa6a1f58acf101db2427fa4d8eca7dc69dd9c9ebab86d171adbcf1020973ad07b966e6872dd2128e7898c15538695cb80b71a8dace9561b9672639e08406f21a11cefa788c2e950d49fec187d4fb6b4e8ae95763f518c2341d9df697ab7ab87d665eabf28951cbf7aedef2139',
  '802bb4d49a350355bf17d5d888ef07ebb785be0321a99f45052578da97781985baf80a14120a4ca53805efd6a0ec53136a6d5c05192f509216b18f76f09c64338988d3a34e80ca3fc09fbf58adca1229f6e603532415b3e5ded28491c7674d1301e84ab2c80f99e88622d1b1c513f4e305887dd98331e731881b07a31c81a3a7cc1ebae004151b5e7b3aa2ff543fd5c010587ba32ebf72abf3367937d6a661ffbd21fc44f7159c35bee305da1eb588b00f197bbced404b8e099ee5e0d4c6918d5699c406454775efb5b6105eb32fa52ed054f5802fd64941bc6345de8e1a4dc3fcdd332473e398b364c793f0e6a6448c8da5f9556faac7d619ac507107da425cd24e519db5c694a355f1d86b5f73635894b5cb91596f9f58484a35f121af3df11cd1e4381327b50f7e1f965d4b0e5224cf353e8e78e1a3b6a7430d1eaa64488b9c7e0c32be8fa9631c6fbf8ce7bd0b087d53f131227c69da2462a358c626101c0a8ab59b9b55a82c1de8475db77866883934b60ab80ed53b4224a87ce8553d692c7ed3888c5972c7e6ed825845bb25639c98ce68bb0b4426c0d7a08412b423fda3d0efa16e70658bffe6e9803fe38e032048e779ff68fd6123d1fa257239dd7bf97730a79eac8f2f96b25f4ececd851cab99c31099b49d337323eb859242f1e8253a795b5c42886f7ae9cad580706f226180e79004023efb8a7c495971350e5c5773925699d37b92abf232f95cbc547b2ac3fa094f62d360810be979d0ef01ea23a034bb8146778e830f47cbf26ce9a7024fcd1d6d6c361223c9d0aafdeb0a0699da86c80d424ada0365d62edea06bfa9ec09c9729d143bcf75dbbc37cf24b21cd02a4e41f1bb709974a87958d0d8b3f50f500edb2b946523fe85d6a02ebb823c16c42635d1c1dc8c02c9928a31cb23347817658e7cbb8caa6f1cbceeccefb0cb6e2945d443f6f0365468e1bfe119d3a337fd2e844641ec5219be34d94a5377d45f07149499e3cb1cc54d2df0637dd2633f1c7cb4423ba98b087fc8c0372ab2d9a4f4b985f0306815edaf2b94dae983fe7461a462e8d52c5888dae1555d3545db71cd7866daf2cac2d2ef07f820dbec9dddbe88afe6e76fa5f08332c23b74c8146a086a34e757a2f804c9aa5d1a79db6d90e6ceb508f6fda86bf3c073b8747b9f6a995a5ad9e41d5f8544e9e0d8f7e14935b53120c56406845f02893e46bba020243a3ca7139ab2a642ed1da217d3c197de68d14677e40253e777f204473e3010d90d622d19ea7fe72d52ad2cfc798dbe31758ecaec114527e2603da3169128dcdc5db997b1b89a69e04679b303950c02f2c9683ce1b0c71ca1756948276e3cc0c69314b0b218fe5b2b331deb05634fa279053e202c9a54e4a1525752f6dc024f5e613bceb63da013e9b66dfc853ac7805c1ea1c998df9d6dd5ea06dccffd2e56adc126ea007c80415a7fbbbeacf57bcd433090b4cf2f062f08f073712272108da2672254a301a8401908dc0832719d90624371b086d5f2a0742b9ddf17b8678de11b83fad7934e30c65ad14bce2c695bb11229ccb357c3f72ec84fd84a91c00097e6f4df74f3a260fb383af46d163e0564750bf73e0babb4578fc0121d349bc115a70c9268d0a39c7926ea8168cb102f15df4e0b734d961e1d54f5e39c0392c097d7377a48872a14d3dd080a2f64841ad6253e6e5f0890edead0d2e7112b1e694a63be',
  '8039921cf0bbb6ce071087bcedf3b218d963889b79a462912dfa598663ea3841190e8602bae16905da1a399d76b47d348bedd2b0887d05811948d49d124f74e00a4d8d1f777e4d93acd45e75dfbcefa4fffaf71e075d26b54c9309782ac8a7f00ba71cd64cf78075e49cbe24c3be57b74c05ebcdb6b4c7b12004256db3cddaefb5f82191d873c7527d3cf89c60a31cf178cbf1c8f5c0318acfdbd9cab32f58b94040a590883ef4a1788b5f44f8263b5f4ab8ce304e121469ebc0783f8958764c246bf1ccd0b6b7741425fa6099e865215c2bdbad591f852e4ca0eca9cd8f3c0f934c62d818fe910ca253dab32df3177e467fc2f5c8af7d517cb645bb8857d717c16259dccc7d2535675985370bd7473e6da9e0397311df0b3bc6fcf30e40a243416d78a8ac7e686c90ed55772313d75a04fd1d226716738b10673eb01aa8eb61a7be5e8b680aed14250c1be86f09a6873c1540a912f83107c2c83216b53c2a02d41929bf564a145ea484ed8207904a592603f8e6cd6435ff7e6fcc76e873dc81ea072d91db43b7eef59a02bfe67f1aebaadace763776cbb05fdf6f7832ea20b9c1634e6b262cf097895bbff0b498864db3be0b2c831b87850fc345c7eeacd6471ff9b1a4216e9f6a7ccfe665b3f7f8c9bb2ac042c9cd07b3ff6b87dbcb836b11a259c59023b756c543772949ca1b5e83186d12bc08a9db3e2d02245741199a12e1256b787dd78a041f72ce5425123b3eec0e9196df5c065bd2391edfb222ff036d5d595e6f71a88d7bfc82dce25a43f2a8a3cfac24e35e5ec73aae6eeb0cc9e79e66d06f01c53df555ad074c454d9066f2db55982d59a74cda516707bed452ba647cd390f343374200e0aa28da34fa6755d4552ff14bd44e263d9bddef5bc1ddbea9cb754302aa28a3ec47932609e3e2035144cffd62b25e4e98401f872e0065c0eec4144428c238b6a868a40d6af2337eb7544e05b1583cf0d96e1b31d6e6f1d1321fda9258766f3e1bb708539c6615fecf84ca7c97ccb31b43af61df9a849c4e50906cb266a3ef78e7be0434dab531957a306f3fde132803e16ee79e4b6834ddd1b9a8a758fb86a44f200cd6b659d878393aa770f5238ddf181e83ee79a98ceaed26cf7c2e0029e7bf2f4bf80986250887386944e39624acd33c8da11de61c44b2a0ec1ab39fe1d612802e7f6c5d3d15a12d3e18995a9b3a92bcfc15b945bd5feb3e3e49ce232b04efb408cd2616481d5764e72ab622155908f1f1227f375d8777aaf066795e2fd2fe185109e1ff75e4381c63725f75bd973f2140cf94a7c76182c862a7c5b842b08fcb6dd630c342fede5a5678b183cc779891fb54d7ca7cf9dce2d375dbfd7d62449aa80e3e91627b3362afa1907fa144fe4ab4c10373dbd3c246549287359838ef4d5d499267b76a30aa9278cd515785c237d5999e5b752e9c3b78d5ccd68e34bee43ae3157ce272f9f764fd33c1b31ea088eb3db6c4deca8274e44cbf3289fd264a832ef3a10af912a0945027a91ac75197881ae5e0248c977e1da3ed032dc0b1c7aa1450a02d8c8bc90d06917aaa058bbd4bf08888919474be98016762d5ad2d24e8bd3a7095f58d64723fde63050c363c577a4f458e2817dc80d7ee2120e1e679f6ac417f0338f75e4a25eb3d1a649f5cc228ef72828aa9132393bbf0e8e7d28844b560f31ad8305a9cea4fd6b25e4a656cac654a47ea8a3d4',
  '804b7acd1c25024cabe3468cb1d9a9b62d9cc506b9acab173873873cf8c11eb89723a0643fa37858e21b85d7d44567b7ac25cc1c60b5d2835fef2071c89b575c893a0f5cc5db6ee8b6868fd4323ae1556574e3092508952ff36aaadc52f19f07ab62ec166cb0e2c53b162a5dfd28b709f16f3c6672ef7dcbb6955811e552afa54b6f0bda5d8ad171c78852877522a90c65990a8bd7a647994ce800565d928f84e2775e88af9991ec7be785b38274cb9ff13a0c8548ca823563920328d36b52250c94c7985d3f501cd3dcbb06e74371ea549695afdd623a61e1dcb3b3048b1f6877f57cdd710c2a6ba435555a13676e85ee635bed1f3b1272db83a5d2c7446fa250bbbe58d86bd46b77a885d5c3531a129b1250639f1abe460c79578f20254b3711197fec3f23e0765e6547d2d841f4b7e909bf7058cd882e957f691a4cd4977f305b2e484aacbf3b1f8eeb6c8bc5b56723b9144a1c5a29a32e93211ef6ac0bf48d5c6175f738b7543163975f03fb8f9ba17bbf0379bf853f3dc03117cc8e6f420544649e6293a3d25608acd282f22e43e88fcca256699989f86204e1d3301fd8730065f80cd6a1874488b7b897933c5f4b3405f0a485cffb8d1cd74f0e0292c717604b5db39fe05c0b50ed21937d5c0f9f903749dcfb96343f1a14e0e08603f792fcf85a2d3110b43ca66d87ed8ef87a38de4b1e6dfa183ebe4fe830afbb6bda48591d9c5f9679563dc2b5e58054706d2d6ee5bd3a4a49a0c96ec44d840be2213022a166554119d3db14a9ed718b4fb0c97061765c626c8a2c966ff49d46a8df4d11240317775712fac30b85083f30ab0e99cda6b1c7cebcbc6aed2f8df5cbfba1f6434cdb36238ca18279832ec1614f6ce47c6b4b998d5b6c988173ab595bfc239fa860735cb117fb480cc2d069aa39e9a9886fc9790228afef2ad08fdfb2b004f0b8758fc0e8dfab8b6fc17757a16537de26023e6be05dc40f9507d69fb28c316522dc734c894462c54618c7b033f7536cec432104eb5449aa61e50446e9b698b264fc33cce60af1601b0c4737e4328c334aeeed33ede2b8eade8723336fcbfe75ca062ea29e9ccd99f05982c4566a6df360e6f1c7d9b9fd106af106bc9c7b96264ce4f3c675345e126477e84e4c72f6a4dc5f4a1d027176bddf4b0323f2f2ceecfdebebf5d3eb87cb26353820927ac0dd00036b6bb08baadbf72984f6819ae86af8bad1f44ef423801683e4f39b0d583c24a3fe8d9e2641a083397fa9b06a9643360de82100aba32fc5251ff81a96b84bb044af38137220f41954197beda08cb7d0ad581a7311b28be59238d541423f300282b270edaf9fa9169f41bc61b42163e818b0ce4be07d37b3b42cbd41a58f8dc346a7ed649b97a5fbf34c5aa4436ba145c5f234c24f1285e882cd19bff4d3581e6ca874aeb79369225f514b7fdaf15d0fa7d128428dacbbc1ef9797fbafceb5a811a748ef8019d44e69852b9346f100966a29e2c9aa04047a09ae8b4f928bba3f4a0e6340a51a111403868c286101c5541aa6a0be2bef4685723f42617b365abbe2be3d88a676c80648a28951354f1508b0473de6f1f59c24bb2e9c0e2545b6c793207b2ebafe78dca6c0054d7c8e23c848873829b707ab8fc24b8416c150f4dc9be9137d9b6d296e13f24a2e5f1ad45ef07736b9f5068a11a7efcdf089acd21f175f9880f3eb008e112db5f870fc18470',
  '80595c0576abb7d713e414e8d4c51c45437af39ee1a156c310aca6600c533f7c34d52c7297485df80004539c021d49904da542a9f1e7879050167b9a2a48478f0aff51e0fc25e944dacd6ef9404c1cd86c6817440640007f612b2735bf5e75e4a12dba72e848fb5859a845c8fb85145db8e2aa72476a5d4b1e8a7adf4a1ed6ed328990ab81ec0d7dc18e08e441be603d0d0a80e00cd904b87005a0ab381bb6c21f16075cd0b2f978bd8fdf2d64e77870b49bb909eb98ddd281cc9ef78ef5b5e47e66f252c8ce9287724f5138cd84b1e5d8e9bb82ababf60e111f1ac4471e6ea418642d211a1123d462a11c19d8323d7725b9604db83ea8f5be99b01848c9fae94397b619a1d065fd4500d88997f73e74620e7bcbb564fe157ff59e8d0fcad4854ca5e37c807a3d15b09784f8b05c71c922c19cdc473a5813225b5ab4fc1834950b9b7cf19c29fb4c26ed4f08037118e862ffa5d22cde717ec839b05085b631ea53cffd513a270b26880f3d80b313a34abe4cf1ef0cd565fb018b551dcca88eaac33d9a87358966fb457f2c35213611cbdecdccbcda14161f676acb1df36e1c9c11b3c432448a349b3235e1c81ce83411d8c2e9a5d8f6b51fa10e68ad929799fbf1eeca5e0c5df019e12d540aee4721da8f23341b8c820cb4b35278beb947990e159f449152c4ce1e05388e1ba7e5c9db4133be326151fdfb1931853e9f97ff94fe0fe4b2bb9288c089424948f9fa1f28eba38e22aa749c9b9a5c33ebe6c61cc87edfcc83bb76c6d023e76cfa61bde5e5639c63c715ed04c6c86511308ba16b3e4aad72a41bf0203dac0bdae793d2cb37628204a9b54f2a4c916631eb4fd3d26008883438376ea3c73628543e79f8101769c529a9086b1f47754d47c446e922025c5a21766d4206f79888d279557cfbe8ad79baf8d3d008bc4786a101e43f49d972fce83c8fd745e47865897e842cce6c7a16a0a47fbea6a4154d185173ec6300a5a74c4fa88ac39a908a23cf921b88c49e52af4219b09d7fe26e3208d8aec6074cadbf08dea94364d75d57b13e43c93cfe0f60c7fc60ac0f33861e75e8ab53a294b8a428e45549b644f8202ad67fb17bc811b2cb7f5c8cce7d00475ecb7279763a6bec88c19d0f3239e1d199c1e057e1272d88dd5e71fb8f5cd1dfc199b953577cf7c8a25cd80ddfa98de8854ac3b15346277e2f7fa4aa78d5b9634675247e25b5c2654ee903c6f54341735108a8b15c388dcd50b345fc1626df0de819a564361ca44adf5fc6f97a0304f7a6d9de7d38bf64f4cb73a6729dc9ed3bcee78658ea20f0c35684c442f59c004964dedcd2c0eec2ce5704da62122226d1f0971d4804d4d63b80ce343978adc018c292d5e43dd32ef20b04b4be74994e9432a23417bc4d85102d8bd02dd614f1c3004cd8743bbca95ee249340636cbf5b5e7042af64ab51d26b1a4e35c078da2de6e9e4dd0f1687f567e1689de51f7fbc1b5aaba7690e1a490ab2f6de1a7f8b2bd4a035ff741748ca8c55629b695da023a566d124e3d53439238a83489e52392efcc97f007c301c0507373998e3301af3ffed6a8c5a4d21fd965b115be02570283fcd5771d50e67cf35e6c45f704b7361cf09b99414eb76e6401765b02ae21df989cf149d8c0995e76317bcc99e0e8637d8fe36565f199003ea440053bbcac654963f85b4bd2d980166d5027df4f6be7e653f0c203d1823441a',
]

const crypto = webcrypto as any
setLocalStorage(fetch)

describe('Shamir split', () => {
  it('should return 5 splits', () => {
    const result = new WebcryptoShamir(crypto).share(data, 5, 3)
    expect(result.length).to.equal(5)
  })

  it('should be able to split and recombine a private key', async () => {
    const rsa = new RSAUtilsImpl(crypto)
    const key = ua2hex(await rsa.exportKey((await rsa.generateKeyPair(ShaVersion.Sha256)).privateKey, 'pkcs8'))
    const shamir = new WebcryptoShamir(crypto)
    const splits = shamir.share(key, 4, 3)
    const combined = shamir.combine([splits[1], splits[0], splits[3]])
    expect(combined).to.equal(key)
  })
})

describe('Shamir combine', () => {
  it('should return combined data from all shares', () => {
    expect(new WebcryptoShamir(crypto).combine(shares)).to.equal(data)
  })

  it('should return combined data with some shares', () => {
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 5; j++) {
        expect(new WebcryptoShamir(crypto).combine(shares.filter((x, idx) => idx !== i && idx !== j))).to.equal(data)
      }
    }
  })

  it('should fail miserably because it has not enough shares', () => {
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 5; j++) {
        expect(new WebcryptoShamir(crypto).combine(shares.filter((x, idx) => idx === i && idx === j))).to.equal('')
      }
    }
  })
})

describe('Shamir key recovery', async function () {
  this.timeout(600000)
  let env: TestVars

  before(async function () {
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('should automatically load recoverable keys on startup', async () => {
    const hierarchyApis = await createHcpHierarchyApis(env)
    const api = hierarchyApis.childApi
    const user = hierarchyApis.childUser
    const notariesApis = [
      await initApi(env, hcp1Username),
      await initApi(env, hcp2Username),
      await initApi(env, hcp3Username),
      hierarchyApis.child2Api,
    ]
    const notariesIds = (await Promise.all(notariesApis.map((x) => x.healthcarePartyApi.getCurrentHealthcareParty()))).map((x) => x.id!)
    const pat = await api.patientApi.initConfidentialSecretId(await api.patientApi.newInstance(user), user)
    const descr = 'Confidential info'
    const confidentialData = await api.healthcareElementApi.createHealthElementWithUser(
      user,
      await api.healthcareElementApi.newInstance(user, pat, { descr }, { confidential: true })
    )
    await api.cryptoApi.shamirKeysManager.updateSelfSplits(
      { [fingerprintV1(hierarchyApis.childCredentials.publicKey)]: { notariesIds, minShares: 3 } },
      []
    )
    const lostKeyStorage = await testStorageWithKeys([
      {
        dataOwnerId: hierarchyApis.grandCredentials.dataOwnerId,
        pairs: [
          {
            keyPair: { privateKey: hierarchyApis.grandCredentials.privateKey, publicKey: hierarchyApis.grandCredentials.publicKey },
            shaVersion: ShaVersion.Sha1,
          },
        ],
      },
      {
        dataOwnerId: hierarchyApis.parentCredentials.dataOwnerId,
        pairs: [
          {
            keyPair: { privateKey: hierarchyApis.parentCredentials.privateKey, publicKey: hierarchyApis.parentCredentials.publicKey },
            shaVersion: ShaVersion.Sha1,
          },
        ],
      },
    ])
    const newKey = await api.cryptoApi.primitives.RSA.generateKeyPair(ShaVersion.Sha256)
    const lostKeyApi = await IcureApi.initialise(
      env.iCureUrl,
      {
        username: hierarchyApis.childCredentials.user,
        password: hierarchyApis.childCredentials.password,
      },
      new TestCryptoStrategies(newKey),
      webcrypto as any,
      fetch,
      {
        storage: lostKeyStorage.storage,
        keyStorage: lostKeyStorage.keyStorage,
        entryKeysFactory: lostKeyStorage.keyFactory,
      }
    )
    const lostUser = await lostKeyApi.userApi.getCurrentUser()
    const lostPatient = await lostKeyApi.patientApi.getPatientWithUser(lostUser, pat.id!)

    async function checkNotRecovered() {
      await lostKeyApi.cryptoApi.forceReload()
      expect(Object.keys(lostKeyApi.cryptoApi.userKeysManager.getDecryptionKeys())).to.have.length(3)
      expect(await lostKeyApi.healthcareElementApi.findBy(lostUser.healthcarePartyId!, lostPatient)).to.be.empty
    }

    async function giveBackAccess(notaryId: number) {
      const notaryApi = notariesApis[notaryId]
      await notaryApi.cryptoApi.forceReload()
      const delegateUser = await notaryApi.userApi.getCurrentUser()
      const notifications = (
        await notaryApi.maintenanceTaskApi.filterMaintenanceTasksByWithUser(
          delegateUser!,
          undefined,
          undefined,
          new FilterChainMaintenanceTask({
            filter: new MaintenanceTaskAfterDateFilter({
              date: new Date().getTime() - 100000,
            }),
          })
        )
      ).rows!.map((x) => KeyPairUpdateRequest.fromMaintenanceTask(x))
      const filteredNotifications = notifications.filter((x) => x.concernedDataOwnerId === lostUser.healthcarePartyId)
      expect(filteredNotifications).to.have.length(1)
      await notaryApi.icureMaintenanceTaskApi.applyKeyPairUpdate(filteredNotifications[0])
    }

    await checkNotRecovered()
    await giveBackAccess(0)
    await checkNotRecovered()
    await giveBackAccess(1)
    await checkNotRecovered()
    await giveBackAccess(2)
    await giveBackAccess(3)
    await lostKeyApi.cryptoApi.forceReload()
    expect(Object.keys(lostKeyApi.cryptoApi.userKeysManager.getDecryptionKeys())).to.have.length(4)
    const retrievedAfterRecovery = await lostKeyApi.healthcareElementApi.findBy(lostUser.healthcarePartyId!, lostPatient)
    expect(retrievedAfterRecovery).to.have.length(1)
    expect(retrievedAfterRecovery[0].descr).to.equal(descr)
  })
})
