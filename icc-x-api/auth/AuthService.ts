import { XHR } from '../../icc-api/api/XHR'

export interface AuthService {
  /**
   * This method returns the headers needed to authenticate the user.
   * It can throw an error if is not possible to get the headers.
   * @return an array of headers for authentication.
   */
  getAuthHeader(): Promise<Array<XHR.Header> | null>
}
