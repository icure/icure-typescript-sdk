import { User } from '../../icc-api/model/User'
import { hex2ua, IccCryptoXApi, IccUserXApi } from '../../icc-x-api'

export namespace TestUtils {
  export async function initKey(userApi: IccUserXApi, cryptoApi: IccCryptoXApi, user: User, privateKey: string) {
    let id = userApi.getDataOwnerOf(user)!
    await cryptoApi.loadKeyPairsAsTextInBrowserLocalStorage(id, hex2ua(privateKey)).catch((error: any) => {
      console.error('Error: in loadKeyPairsAsTextInBrowserLocalStorage')
      console.error(error)
    })
  }
}
