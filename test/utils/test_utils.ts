import { User } from '../../icc-api/model/User'
import { hex2ua, IccCryptoXApi } from '../../icc-x-api'
import { IccDataOwnerXApi } from '../../icc-x-api/icc-data-owner-x-api'

export namespace TestUtils {
  export async function initKey(dataOwnerApi: IccDataOwnerXApi, cryptoApi: IccCryptoXApi, user: User, privateKey: string) {
    const id = dataOwnerApi.getDataOwnerOf(user)!
    await cryptoApi.loadKeyPairsAsTextInBrowserLocalStorage(id, hex2ua(privateKey)).catch((error: any) => {
      console.error('Error: in loadKeyPairsAsTextInBrowserLocalStorage')
      console.error(error)
    })
  }
}
