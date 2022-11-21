# Authentication Providers and Authentication Service

## Instantiate an api using an AuthenticationProvider

When you want to instantiate an icc-x-api or an icc-api, you can provide an additional parameter, the `AuthenticationProvider`, to define the authentication method
to use in the calls.<br>
The AuthenticationProviders defined in `icc-x-api/auth/AuthenticationProvider` are:

- **NoAuthenticationProvider**: it will pass no authentication headers to the requests. It can be used when passing the SESSION-ID from the Cookies.
- **BasicAuthenticationProvider**: it will pass to the requests a Basic Authentication header.
- **JwtAuthenticationProvider**: it will pass to the requests the Bearer Token header. If the user does not have a token, it will automatically fetch one from the Back-end. If the token is expired, it will automatically refresh it.
- **EnsembleAuthenticationProvider**: it will try to use several authentication methods until it finds one that works. First, it will try with the Jwt Authentication, then with the SESSION-ID (no authentication header), then with the Basic authentication. _Note_: if the JWT Authentication fails, it will not try it again for a period of time which duration can be configured in the parameters (default: 1 hour).

**Note**: to instantiate a `JwtAuthenticationProvider` or a `EnsembleAuthenticationProvider` you need to pass as parameter an instance of `IccAuthApi`.<br>
**Note**: If not authentication provider is specified, the `NoAuthenticationProvider` is used by default.<br>

### Example

```typescript
import { IccAuthApi, NoAuthenticationProvider, JwtAuthenticationProvider } from '@icure/api'

const xUserApi = new IccUserXApi(ICURE_URL, HEADERS, new NoAuthenticationProvider()) // Equivalent to const xUserApi = new IccUserXApi(env.iCureUrl, {})

const authApi = new IccAuthApi(ICURE_URL, HEADERS)
const xHcpApi = new IccHcpartyXApi(ICURE_URL, HEADERS, new JwtAuthenticationProvider(authApi, username, password))
```

## Send a request using XHR

To specify the authentication method when using the `sendCommand` method, you can specify the authentication method by passing a AuthenticationService.
There are four implementation of `AuthenticationService` and their working is analogous to their corresponding provider:

- **NoAuthService**
- **BasicAuthService**
- **JwtAuthService**
- **EnsembleAuthService**

**Note**: if no `AuthenticationService` is specified, the `NoAuthService` is used by default.

## How does the JWT authentication works?

The JWT (JSON Web Token) is an authentication method that involves storing the session data on the client side instead of the server side.
All the session data are stored in the JWT and signed with a secret key when the token is issued, to prevent modifications and malicious accesses.
Two types of token are issued:

- **Authentication Token**: a short-lived token that is attached to all the requests that require authentication. It lasts 1 hour.
- **Refresh Token** a long-lived token used to request a new authentication token on its expiration. It lasts 1 day.

One of the biggest disadvantages of the JWT is that, once issued, it is not possible to invalidate a token. This means that if the user's privileges gets updated (e.g. the user loses the admin privileges or gets banned) he can still access the API with the old privileges until the token expires. This is not a big problem for the authentication token, as it is short-lived, but it can be for the long-lived refresh token.
To avoid malicious accesses to the API with non-updated tokens, each refresh token has a unique ID that is stored in hazelcast inside the application server. Before issuing a new authentication token using the refresh token, the ID of the latter is compared with the one stored in the database and, if they do not match, the operation fails. In this way, it is possible to invalidate old refresh tokens.

Currently, the JWT authentication has been enabled but is it still possible to receive and use the SESSION Cookie.
If both the authentication JWT and the SESSION Cookie are provided, the JWT has always the priority:

- Trying to access an endpoint with a valid JWT and a non-valid SESSION Cookie will result in a success.
- Trying to access an endpoint with a non-valid JWT and a valid SESSION Cookie will result in a failure

### Authentication Details

- When the user logs in, in the response payload he will receive an authentication token and a refresh token.
- To access a protected endpoint, the user should add the `Authorization: Bearer <AUTHENTICATION_TOKEN>` where `<AUTHENTICATION_TOKEN>` is the authentication JWT provided after login.
- If the token is not valid, missing, or expired, the user will receive a `401_UNAUTHORIZED` response with a clarifying message in the payload.
- To obtain a new authentication JWT, is it possible to send a POST request to the `/auth/refresh` endpoint, setting the `Refresh-Token` header to the refresh JWT provided after login.
- If also the refresh JWT expires, the user must perform the login again.
- When the user asks for a new authentication JWT, the validity of the refresh JWT is checked.
- A user can invalidate one of his own refresh JWTs by sending a POST request to the `/auth/invalidate` endpoint, setting the `Refresh-Token` header to the refresh JWT provided after login.
- When the user logs in and receives a new refresh JWT, the previous one stays valid unless explicitly invalidated.
- The `/auth/logout` endpoint is still available, but will not invalidate the authentication JWT nor the refresh JWT
- The `/auth/login` method still sets the SESSION Cookie, and it is still possible to use that to access the API.
- It is still possible to use the Basic authentication method.
- The `DatabaseUserDetails` class has been removed, as it contained useless data.
- As for now, the user will receive both the JWT and the SESSIONID Cookie. You can avoid receiving the SESSIONID Cookie by setting the `X-Bypass-Session` header.
