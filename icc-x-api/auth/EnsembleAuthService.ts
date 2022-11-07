import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'
import { JwtAuthService } from './JwtAuthService'
import { NoAuthService } from './NoAuthService'
import { BasicAuthService } from './BasicAuthService'
import { FailAuthService } from './FailAuthService'
import { IccAuthApi } from '../../icc-api'
import Header = XHR.Header

export class EnsembleAuthService implements AuthService {
  private currentState: string
  private stateMap: { [key: string]: { state: AuthService; next: string } }

  constructor(
    private readonly jwtAuth: JwtAuthService,
    private readonly sessionAuth: NoAuthService,
    private readonly basicAuth: BasicAuthService,
    private readonly failAuth: FailAuthService
  ) {
    this.stateMap = {
      jwt: { state: this.jwtAuth, next: 'session' },
      session: { state: this.sessionAuth, next: 'basic' },
      basic: { state: this.basicAuth, next: 'failure' },
      failure: { state: this.failAuth, next: 'failure' },
    }
    this.currentState = 'jwt'
  }

  async getAuthHeaders(): Promise<Array<Header> | null> {
    const header = this.stateMap[this.currentState].state.getAuthHeaders()
    this.currentState = this.stateMap[this.currentState].next
    return header
  }
}
