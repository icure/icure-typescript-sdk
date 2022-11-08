import { XHR } from '../../icc-api/api/XHR'
import Header = XHR.Header

export interface AuthService {
  /**
   * This method returns the headers needed to authenticate the user.
   * It can throw an error if is not possible to get the headers.
   * @return an array of headers for authentication.
   */
  getAuthHeaders(): Promise<Array<Header>>

  /**
   * If the headers are invalidated, you can set the error to throw
   * the next time the headers are requested.
   * @param error the error to throw
   */
  invalidateHeader(error: Error): void
}
