# Auth: open-bot-framework

> How this service handles authentication.
> Full flows: [`docs/architecture/auth-flows.md`](../../docs/architecture/auth-flows.md)

> **NOT CURRENTLY DEPLOYED.** hbf-webchat connects to **Azure Bot Framework Direct Line**, not to this gateway. hbf-core relays token requests to `directline.baseurl`, which defaults to `https://directline.botframework.com/v3/directline` (`hbf-core/src/main/resources/application.properties:142`), and hbf-webchat hardcodes the Azure host in `coreWidget.ts:1509` and `:3392`. OBF is reachable only if an operator fills in the console's per-deployment "DirectLine Token URL" and domain override. Treat everything below as the design of a drop-in replacement, not as a live production surface.

open-bot-framework is a self-contained DirectLine 3.0 gateway (NestJS on Fastify, MySQL via TypeORM, Redis or in-memory for atomic counters). It has its own signing key and does not talk to hbf-core for anything, including token validation.

## Tokens This Service Accepts

Four credential shapes. **All three JWT types are signed and verified with the single `JWT_SECRET`** (`src/app.module.ts:30-37`, `JwtModule` registered globally with only `secret`, no `signOptions`, no `verifyOptions`). The signature cannot tell them apart, so each verify function checks the claims instead (see below).

| Credential | Shape | Where | Verification |
|-----------|-------|-------|--------------|
| Bot API secret | `<secretId>` + 40-char random, sent as `client_id` + `client_secret` | `POST /oauth2/v2.0/token` body | `OpenBotSecretService.validateSecretCached` (`src/features/openbotsecret/openbotsecret.service.ts:159-164`): the credential must exist and not be past `expiresAt` (`findValidByIdCached`, `:95-102`), then SHA-256 hash compare |
| Admin username + password | plain | `POST /api/login` body | `AuthorizationService.generateUserToken` (`src/features/authorization/authorization.service.ts:33-58`), username equality plus `bcrypt.compare` against `ADMIN_PASSWORD` |
| WebChat site secret | `<siteId>.<base64url(32 bytes)>`, one dot | `Authorization: Bearer` on `POST /v3/directline/tokens/generate` and on `POST /v3/directline/conversations` | `DirectlineTokenService.generateToken` (`src/features/directline/dirtectline-token.service.ts:53-90`): format check, site lookup by `siteId`, then the full secret is compared to `secret1` and `secret2` in constant time (`:68-76`, `AuthorizationUtils.secretsMatch` at `src/features/authorization/authorization.utils.ts:19-24`) |
| Any OBF-issued JWT | standard JWT, two dots | `Authorization: Bearer` on the DirectLine and bot-reply routes, and `?t=<token>` on the WebSocket | see below |

### JWT verify functions

There are three. All check signature and expiry. None checks `iss` or `aud`. Each one refuses the other two token types by their claims.

| Function | File:line | Accepts only | Used by |
|----------|-----------|--------------|---------|
| `AuthorizationService.verifyAdminToken` | `src/features/authorization/authorization.service.ts:67-72` | `role: "admin"` and `sub === ADMIN_USERNAME` | `JwtAuthGuard` (`src/guards/jwt-auth.guard.ts:9-19`) |
| `AuthorizationService.verifyBotToken` | `src/features/authorization/authorization.service.ts:81-91` | a `sub`, no `role`, no `conv`, and `sub` must be an existing, unexpired `OpenBotSecret` (`findValidByIdCached`) | `DirectlineConversationService.replyToActivity` (`src/features/directline/directline-conversation.service.ts:200`) |
| `DirectlineTokenService.verifyDirectLineToken` | `src/features/directline/dirtectline-token.service.ts:135-150` | string `conv` and `site` claims, no `role` | `createConversation` (`directline-conversation.service.ts:64`), `getConversation` (`:114`), `verifyConversationToken` (`:263-273`, used by `userReplyToConversation` at `:147` and by the upload route at `src/features/directline/directline.controller.ts:113`), `refreshToken` (`dirtectline-token.service.ts:105`), WebSocket gateway (`src/features/directline/directline.gateway.ts:55`) |

The two `AuthorizationService` functions share `verifyJwt` (`authorization.service.ts:93-99`), which turns any `jwtService.verify` failure into a 401.

`verifyDirectLineToken` maps an expired token to 403 `ForbiddenException('Token expired')` (`dirtectline-token.service.ts:140-142`). botframework-directlinejs and Azure DirectLine use 403 for "token expired", so clients know to fetch a new token. Any other failure, including a wrong token type, is a 401.

### Endpoint to guard map

| Endpoint | Guard |
|----------|-------|
| `POST /oauth2/v2.0/token` | client id + secret in body, credential not past `expiresAt` |
| `POST /api/login` | admin username + bcrypt password |
| `POST /v3/directline/tokens/generate` | site secret in `Authorization`, compared to `secret1` / `secret2` |
| `POST /v3/directline/tokens/refresh` | unexpired DirectLine JWT whose `site` still exists |
| `POST /v3/directline/conversations` | DirectLine JWT (2 dots) or site secret (1 dot), chosen by counting `.` (`directline-conversation.service.ts:61-91`) |
| `GET /v3/directline/conversations/:convId` | DirectLine JWT whose `conv` equals `:convId` (`directline-conversation.service.ts:114-117`) |
| `POST /v3/directline/conversations/:convId/activities` | DirectLine JWT whose `conv` equals `:convId` |
| `POST /v3/directline/conversations/:convId/upload` | DirectLine JWT whose `conv` equals `:convId`, checked before any multipart part is read (`directline.controller.ts:112-113`) |
| `WS /v3/directline/conversations/:convId/stream?t=` | DirectLine JWT whose `conv` equals the path segment |
| `POST /v3/conversations/:convId/activities[/:activityId]` (bot reply) | `verifyBotToken`: a bot token from any live bot credential, not tied to the bot that owns `:convId` |
| `/api/bots`, `/api/bots/:botId/credentials`, `/api/bots/:botId/webchat` (admin REST) | `@UseGuards(JwtAuthGuard)` on all three controllers |
| `/` and SPA routes | none, `ServeStaticModule` serves `client/dist` |

Expiry is enforced on every DirectLine route. An expired DirectLine token gets 403, a missing `Bearer` header gets 400, and any other bad token gets 401.

## Tokens This Service Sends

| Calling | Token used | How attached |
|---------|-----------|--------------|
| Bot endpoint (`OpenBot.endpoint`), forwarding user activities | **none** | `httpService.post(targetBot.endpoint, newActivity, { headers: { 'Content-Type': 'application/json' }, timeout: 5000 })` (`src/features/directline/directline-conversation.service.ts:159-164`) |
| WebChat clients over the WebSocket | none, the token was already validated at handshake | raw JSON transcript frames (`src/features/directline/directline.gateway.ts:86-102`) |
| S3-compatible object storage | `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` | AWS SDK signing, for attachment uploads |
| MySQL, Redis | connection credentials from env | driver-level |

The gateway never calls hbf-core or any other HBF service, and never presents a bearer token to anything.

## Tokens This Service Issues

| Token | Endpoint | Claims | Algorithm | Expiry |
|-------|----------|--------|-----------|--------|
| Admin access token | `POST /api/login` | `{ sub: <ADMIN_USERNAME>, role: "admin", iat, exp }` | HS256, `JWT_SECRET` | `JWT_EXPIRATION_SECONDS`, default 3600 |
| Bot access token (client credentials) | `POST /oauth2/v2.0/token`, `grant_type=client_credentials` | `{ aud: scope ?? "https://api.botframework.com/.default", iss: <undefined>, sub: <clientId>, iat, exp }` | HS256, `JWT_SECRET` | `JWT_EXPIRATION_SECONDS`, default 3600 |
| DirectLine token | `POST /v3/directline/tokens/generate`, `POST /v3/directline/tokens/refresh`, `POST /v3/directline/conversations` | `{ bot: <bot handle>, site: <siteId>, conv: <conversationId>, user?, iss: "https://<DIRECTLINE_HOST>/", aud: "https://<DIRECTLINE_HOST>/", nbf, exp }` | HS256, `JWT_SECRET` | `JWT_EXPIRATION_SECONDS`, default 3600 |

All three responses use the OAuth2 shape `{ token_type: "Bearer", expires_in, access_token }` or the DirectLine shape `{ conversationId, token, expires_in }`.

Conversation ids are minted as `${base64url(12 random bytes)}-${DIRECTLINE_REGION}` (`dirtectline-token.service.ts:78`).

### Secret generation and storage

| Secret | Generation | Storage |
|--------|-----------|---------|
| Bot API secret | `AuthorizationUtils.generateRandom(40)` over a 55-char alphabet (`authorization.utils.ts:4-10`) | SHA-256 hex in `secretHash`, first 3 chars in `plainReducted`, plaintext returned once (`openbotsecret.service.ts:117-121`) |
| WebChat site secret | `` `${siteId}.${randomBytes(32).toString('base64url')}` `` (`authorization.utils.ts:31-33`) | **plaintext** in `secret1` / `secret2` columns (`webchat.service.ts:126-127`, regenerated on update at `:147-150`) |
| Admin password | operator-supplied | bcrypt hash in the `ADMIN_PASSWORD` env var |

Both SHA-256 and bcrypt appear in the dependency tree because they serve different credentials: SHA-256 for machine client secrets, bcrypt for the human admin password.

### WebSocket token validation

`DirectLineGateway.onModuleInit` (`src/features/directline/directline.gateway.ts:33-45`) runs a bare `ws` server on `SOCKET_PORT`, separate from the Fastify HTTP port. Each connection goes to `handleConnection` (`:47-78`). It requires `?t=`, calls `verifyDirectLineToken(token)`, then requires the path to match `^/v3/directline/conversations/([^/]+)/stream$` with the captured id equal to the token's `conv`. Any failure, including a missing token, sends `{ error: <message> }` and closes the socket with code 1008, policy violation (`:61-65`). On success the socket is stored in a `Map<convId, WebSocket>`. When a socket closes, its entry is removed only if the map still points to that socket, so a newer socket for the same conversation is kept (`:70-74`).

## Roles / Scopes Enforced

No role model on routes. The three token types are told apart by their claims, and the `conv` claim comparison holds on every DirectLine conversation route and on the WebSocket.

| Credential | Effectively grants |
|-----------|-------------------|
| Bot API secret | minting bot access tokens, while the credential exists and is not past `expiresAt` |
| Bot access token | posting bot activities into **any** conversation id |
| Admin credentials | minting an admin token, which passes `JwtAuthGuard` on the admin REST routes and nothing else |
| WebChat site secret | minting DirectLine tokens for that site's bot |
| DirectLine token | that one conversation: get, send, upload, stream, refresh |

The `aud` claim on bot access tokens is attacker-influenced (it is copied verbatim from the request `scope`) and is never read back, so it grants nothing.

## Auth Notes

- `AuthorizationService.directLineHost` is declared but never assigned (`authorization.service.ts:13`), so bot access tokens carry `iss: undefined`. `DirectlineTokenService` does read `DIRECTLINE_HOST` correctly (`dirtectline-token.service.ts:22`).
- Refresh semantics: `POST /v3/directline/tokens/refresh` (`dirtectline-token.service.ts:99-125`) requires an unexpired DirectLine token, then only checks that the `site` still exists in the database before minting a fresh token with the same `bot`, `site`, `conv`, `user`. There is no refresh-token rotation, no use counter, and no absolute lifetime, so a client that refreshes in time keeps a token alive forever.
- Credential lookups are cached for 10 s (`openbotsecret.service.ts:75-85`, `webchat.service.ts:71-74`). A deleted or newly expired bot credential, or a regenerated site secret, can keep working for up to 10 s.
- Outbound calls to the bot carry no credential at all: `httpService.post(targetBot.endpoint, newActivity, { headers: { 'Content-Type': 'application/json' } })` (`directline-conversation.service.ts:159-164`). The bot has no way to authenticate the gateway.
- The admin SPA (`client/`, React + Vite, served from the same origin) logs in via `POST /api/login`, stores the token in `localStorage['obf_token']` (`client/src/services/api.ts:5`, `:43-45`), attaches it with an axios request interceptor (`:19-25`), and clears it plus fires `onUnauthorized` on any 401 (`:27-36`). Route guarding is a `RequireAuth` wrapper that redirects to `/login` when unauthenticated.

**Security gaps:**

- **A bot token is not tied to a bot.** `verifyBotToken` (`authorization.service.ts:81-91`) only checks that `sub` is some live `OpenBotSecret`. The bot-reply endpoint `POST /v3/conversations/:convId/activities[/:activityId]` (`directline-alt.controller.ts:9-28` to `directline-conversation.service.ts:200`) never checks that the credential belongs to the bot that owns `:convId`, and the gateway does not store which bot owns a conversation. Any holder of any valid bot credential can inject bot messages into any conversation id they can guess or observe.
- WebChat site secrets are stored in plaintext (`webchat.service.ts:126-127`), so a database read discloses live credentials.
- `enableCors({ origin: true })` in `src/main.ts:17-20` reflects any requesting origin. Combined with tokens held in browser `localStorage`, there is no origin restriction on the admin API or the DirectLine API.
- `synchronize: true` is set on the TypeORM connection (`src/app.module.ts:51`) alongside migrations, so the schema is auto-mutated at boot.
- Admin identity is a single shared username and password from env. No per-user accounts, no audit trail, no rotation, no lockout, and no rate limiting on `POST /api/login`.
- `plainReducted` stores the first 3 characters of every bot API secret in cleartext, shrinking the brute-force space for anyone with database read access.
