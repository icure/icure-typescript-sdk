import { IccAuthApi } from '../../../icc-api'
import { LoginCredentials } from '../../../icc-api/model/LoginCredentials'
import { AuthenticationResponse } from '../../../icc-api/model/AuthenticationResponse'
import { b2a } from '../../../icc-api/model/ModelHelper'
import { XHR } from '../../../dist'
import XHRError = XHR.XHRError
import { expect } from 'chai'
import { JwtBridgedAuthService } from '../../../icc-x-api/auth/JwtBridgedAuthService'
import { JwtError } from '../../../icc-x-api/auth/TokenException'
import { AuthService } from '../../../icc-x-api/auth/AuthService'
import { JwtAuthService } from '../../../icc-x-api/auth/JwtAuthService'

describe('JWT provider resiliency test', () => {
  function generateJwt() {
    return `jwt.${b2a(JSON.stringify({ exp: 1000 }))}.${Math.floor(100000 + Math.random() * 900000)}`
  }

  function generateRefreshJwt() {
    return `refreshJwt.${b2a(JSON.stringify({ exp: new Date().getTime() * 10 }))}.${Math.floor(100000 + Math.random() * 900000)}`
  }

  class FakeAuthApi extends IccAuthApi {
    refreshException: Error | undefined | null
    loginException: Error | undefined | null
    jwt = `jwt.${b2a(JSON.stringify({ exp: 1000 }))}.signature`
    refreshJwt = `refreshJwt.${b2a(JSON.stringify({ exp: new Date().getTime() * 10 }))}.signature`

    constructor() {
      super('', {})
    }

    login(body?: LoginCredentials): Promise<AuthenticationResponse> {
      if (!!this.loginException) {
        throw this.loginException
      }

      this.jwt = generateJwt()
      this.refreshJwt = generateRefreshJwt()
      return Promise.resolve(
        new AuthenticationResponse({
          token: this.jwt,
          refreshToken: this.refreshJwt,
        })
      )
    }

    refreshAuthenticationJWT(refreshJWT: string): Promise<AuthenticationResponse> {
      if (!!this.refreshException) {
        throw this.refreshException
      }

      this.jwt = generateJwt()
      return Promise.resolve(
        new AuthenticationResponse({
          token: this.jwt,
          refreshToken: this.refreshJwt ?? generateRefreshJwt(),
        })
      )
    }
  }

  async function expectThrowOnGetHeaders(service: AuthService): Promise<void> {
    let caught: Error | null = null
    try {
      await service.getAuthHeaders()
    } catch (e) {
      caught = e as Error
    }
    expect(caught).not.to.be.null
    expect(caught).to.be.instanceof(JwtError)
  }

  it('JwtBridgedAuthService - If the login fails for any type of error it is possible to retry', async () => {
    const errors: Error[] = [
      new Error('A generic error'),
      new XHRError('', '', 403, 'FORBIDDEN', new Headers()),
      new XHRError('', '', 503, 'TIMEOUT', new Headers()),
    ]
    for (const e of errors) {
      const fakeAuthApi = new FakeAuthApi()
      const authService = new JwtBridgedAuthService(fakeAuthApi, 'username', 'password')

      fakeAuthApi.loginException = e
      await expectThrowOnGetHeaders(authService)

      fakeAuthApi.loginException = null
      const firstHeader = await authService.getAuthHeaders()
      expect(firstHeader[0].data).to.be.equal(`Bearer ${fakeAuthApi.jwt}`)
    }
  })

  async function jwtBridgedTest(error: Error, loginAfterError: boolean) {
    const fakeAuthApi = new FakeAuthApi()
    const authService = new JwtBridgedAuthService(fakeAuthApi, 'username', 'password')

    fakeAuthApi.refreshException = null
    const firstHeader = await authService.getAuthHeaders()
    const initialJwt = fakeAuthApi.jwt
    const initialRefresh = fakeAuthApi.refreshJwt
    expect(firstHeader[0].data).to.be.equal(`Bearer ${initialJwt}`)

    fakeAuthApi.refreshException = error
    await expectThrowOnGetHeaders(authService)

    fakeAuthApi.refreshException = null
    const secondHeader = await authService.getAuthHeaders()
    const secondJwt = fakeAuthApi.jwt
    const secondRefresh = fakeAuthApi.refreshJwt
    expect(secondHeader[0].data).to.be.equal(`Bearer ${secondJwt}`)
    expect(secondJwt).not.to.be.equal(initialJwt)
    if (loginAfterError) {
      expect(secondRefresh).not.to.be.equal(initialRefresh)
    } else {
      expect(secondRefresh).to.be.equal(initialRefresh)
    }
  }

  it('JwtBridgedAuthService - If the refresh fails for a generic error, it is possible to retry', async () => {
    const error = new Error('A generic error')
    await jwtBridgedTest(error, false)
  })

  it('JwtBridgedAuthService - If the refresh fails for a 500 error, the login is performed again', async () => {
    const error = new XHRError('', '', 500, 'INTERNAL SERVER ERROR', new Headers())
    await jwtBridgedTest(error, false)
  })

  it('JwtBridgedAuthService - If the refresh fails for a 400 error, the login is performed again', async () => {
    const error = new XHRError('', '', 403, 'FORBIDDEN', new Headers())
    await jwtBridgedTest(error, true)
  })

  it('JwtAuthService - If the refresh fails for an error, it is possible to retry', async () => {
    const fakeAuthApi = new FakeAuthApi()
    const error = new Error('A generic error')
    const initialJwt = generateJwt()
    const initialRefresh = generateRefreshJwt()
    const authService = new JwtAuthService(fakeAuthApi, initialJwt, initialRefresh)

    fakeAuthApi.refreshException = error
    await expectThrowOnGetHeaders(authService)

    fakeAuthApi.refreshException = null
    const secondHeader = await authService.getAuthHeaders()
    const secondJwt = fakeAuthApi.jwt
    expect(secondHeader[0].data).to.be.equal(`Bearer ${secondJwt}`)
    expect(secondJwt).not.to.be.equal(initialJwt)
  })
})
