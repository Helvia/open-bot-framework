# Auth: open-bot-framework

> How this service handles authentication.
> Full flows: [`docs/architecture/auth-flows.md`](../../docs/architecture/auth-flows.md)

## Overview

open-bot-framework is a self-contained DirectLine 3.0 gateway. It has its **own JWT signing key** (`JWT_SECRET`) and manages three distinct credential types:

- **Bot API Secret** — long-lived credential for bot-to-gateway OAuth2 client credentials exchange
- **WebChat Site Secret** — per-site credential for webchat clients to obtain DirectLine tokens
- **DirectLine JWT** — short-lived (default 3600s) JWT for conversation-scoped webchat sessions

This service does **not** integrate with hbf-core for token validation. All token issuance and validation is internal.

---

## Tokens This Service Accepts

| Token type | Where | Guard / validation |
|-----------|-------|-------------------|
| Bot API Secret (`<id>.<secret>`) | `POST /oauth2/v2.0/token` body (`client_id` + `client_secret`) | `OpenBotSecretService.validateSecretCached` — SHA-256 hash comparison |
| WebChat Site Secret (`<siteId>.<base64url>`) | `Authorization: Bearer` on `POST /v3/directline/tokens/generate` and `POST /v3/directline/conversations` (when 1 dot) | `DirectlineTokenService.generateToken` — looks up site by `siteId`, validates format |
| DirectLine JWT (3 dots = standard JWT) | `Authorization: Bearer` on `POST/GET /v3/directline/conversations/:id/*`, `POST /v3/conversations/:id/activities/:actId`, WebSocket `?t=` query param | `DirectlineTokenService.verifyDirectLineToken` — `JwtService.verify` with `JWT_SECRET` |
| Bot Access Token (JWT from OAuth2 exchange) | `Authorization: Bearer` on `POST /v3/conversations/:id/activities/:actId` (bot reply endpoint) | `AuthorizationService.verifyAccessToken` — `JwtService.verify` with `JWT_SECRET` |

---

## Tokens This Service Issues

| Token | Endpoint | Payload | Algorithm | Expiry |
|-------|----------|---------|-----------|--------|
| Bot Access Token | `POST /oauth2/v2.0/token` | `{ aud, iss, sub: clientId }` | HS256 (`JWT_SECRET`) | `JWT_EXPIRATION_SECONDS` (default 3600s) |
| DirectLine JWT | `POST /v3/directline/tokens/generate`, `POST /v3/directline/tokens/refresh`, `POST /v3/directline/conversations` | `{ bot, site, conv, user?, iss, aud, nbf, exp }` | HS256 (`JWT_SECRET`) | `JWT_EXPIRATION_SECONDS` (default 3600s) |

Both token types are signed with the same `JWT_SECRET`. The `iss` and `aud` claims are set to `https://<DIRECTLINE_HOST>/` for DirectLine JWTs. For bot access tokens, `aud` defaults to `https://api.botframework.com/.default` or the `scope` field from the request.

---

## Tokens This Service Sends

| Calling | Token used | How attached |
|---------|-----------|-------------|
| Bot endpoint (forwarding user activities via `HttpService.post`) | None — no auth header sent | Bot endpoint receives raw activity JSON, no Authorization header |

The gateway does not call hbf-core or any other HBF service. It calls bot endpoints (registered `OpenBot.endpoint`) directly over HTTP with no authentication header on the outbound request.

---

## Roles / Scopes Enforced

There is no role system. Access is binary:

| Token type | Grants access to |
|-----------|-----------------|
| Bot Access Token (valid) | `POST /v3/conversations/:id/activities/:actId` (bot reply) |
| DirectLine JWT (valid, `conv` matches path `:convId`) | All `/v3/directline/conversations/:convId/*` endpoints + WebSocket stream |
| WebChat Site Secret (valid siteId in DB) | `POST /v3/directline/tokens/generate`, `POST /v3/directline/conversations` |
| Bot API Secret (valid `clientId` + `clientSecret`) | `POST /oauth2/v2.0/token` |

Management endpoints (`/bots`, `/bots/:botId/webchat`, `/bots/:botId/secrets`) have **no auth guard**. They are expected to be network-protected (not exposed publicly).

---

## Auth Notes

- **Single shared `JWT_SECRET`**: Both the Bot Access Token and DirectLine JWT are signed with the same key. There is no separate secret per token type.
- **Secret hashing**: Bot API secrets are stored as SHA-256 hashes (`AuthorizationUtils.createHash`), not bcrypt. Plain text is never stored — only the first 3 characters (`plainReducted`) are kept for display.
- **WebChat secrets**: Format is `<siteId>.<base64url(32 bytes)>`. The siteId is extracted from the secret and used for DB lookup; the hmac portion is not separately validated beyond format checking.
- **DirectLine token refresh**: `POST /v3/directline/tokens/refresh` verifies the existing token with `ignoreExpiration: true`, allowing clients to refresh even after the token has expired. The new token gets a fresh expiry.
- **Conversation scoping**: DirectLine JWTs embed `conv` (conversation ID). When a user sends an activity, the service validates that the token's `conv` matches the URL `:convId`. A token cannot be reused across conversations.
- **No public endpoints**: All DirectLine and OAuth2 endpoints require a valid credential. Management endpoints are unguarded and must be protected at the network/proxy layer.
- **Token type detection by dot count**: `createConversation` distinguishes a JWT (2 dots) from a site secret (1 dot) by counting `.` characters in the bearer value — no JWT parsing overhead for secrets.
