import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'
import { JwtAuthService } from './JwtAuthService'
import { NoAuthService } from './NoAuthService'
import { BasicAuthService } from './BasicAuthService'
import Header = XHR.Header
import XHRError = XHR.XHRError

export class EnsembleAuthService implements AuthService {
  private currentState: string | null
  private error: Error | null = null
  private stateMap: { [key: string]: { state: AuthService | null; next: string | null } }

  constructor(
    private readonly jwtAuth: JwtAuthService | null,
    private readonly sessionAuth: NoAuthService,
    private readonly basicAuth: BasicAuthService
  ) {
    this.stateMap = {
      start: { state: null, next: 'jwt' },
      jwt: { state: this.jwtAuth, next: 'session' },
      session: { state: this.sessionAuth, next: 'basic' },
      basic: { state: this.basicAuth, next: null },
    }
    this.currentState = 'start'
  }

  async getAuthHeaders(): Promise<Array<Header>> {
    this.currentState = !!this.currentState ? this.stateMap[this.currentState].next : this.currentState

    if (!!this.currentState) {
      // If I have a state I return the headers, otherwise I return empty headers
      // And delegate the responsibility of handling the error to the next call
      return !!this.stateMap[this.currentState].state
        ? this.stateMap[this.currentState].state!.getAuthHeaders().catch((e) => {
            if (e instanceof XHRError && e.statusCode === 417) {
              throw e
            }
            // If I get an error, it is also responsibility of the next call, but I give a warning
            console.warn(e.message)
            this.error = e

            return []
          })
        : Promise.resolve([])
    } else if (!!this.error) {
      // If I have no more states, I throw the last error or a default one
      throw this.error
    } else {
      throw new Error('Cannot authenticate')
    }
  }

  invalidateHeader(error: Error): void {
    this.error = error
    if (!!this.currentState) {
      this.stateMap[this.currentState].state?.invalidateHeader(error)
    }
  }
}
