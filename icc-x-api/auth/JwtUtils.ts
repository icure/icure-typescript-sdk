import { a2b } from '../utils'

/**
 * @internal this function is for internal use only and may be changed without notice
 * Returns true if the jwt is invalid or expired, false otherwise.
 */
export function isJwtInvalidOrExpired(jwt: string): boolean {
  try {
    const claims = decodeJwtClaims(jwt)
    // Using the 'exp' string is safe to use as it is part of the JWT RFC and cannot be modified by us.
    return !('exp' in claims) || claims['exp'] * 1000 < new Date().getTime()
  } catch (e) {
    return true
  }
}

/**
 * @internal this function is for internal use only and may be changed without notice
 * Get the claims of the jwt.
 */
export function decodeJwtClaims(jwt: string): any {
  const parts = jwt.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT: should be 3 parts')
  return JSON.parse(a2b(parts[1]))
}

/**
 * @internal this function is for internal use only and may be changed without notice
 * Get the group of the jwt.
 */
export function getGroupOfJwt(jwt: string): string {
  return decodeJwtClaims(jwt)['g']
}
