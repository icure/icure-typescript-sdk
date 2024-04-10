export class JwtError extends Error {
  constructor(readonly jwt: string | undefined, readonly refreshJwt: string | undefined, readonly message: string, readonly reason: Error) {
    super(message)
  }
}
