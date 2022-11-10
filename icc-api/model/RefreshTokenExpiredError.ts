export class RefreshTokenExpiredError extends Error {
  constructor() {
    super('The refresh JWT expired, you must login again')
  }
}
