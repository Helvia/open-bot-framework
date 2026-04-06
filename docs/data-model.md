# Data Model: open-bot-framework

> Domain objects owned and used by this service.
> This service is a standalone DirectLine 3.0 gateway with its own PostgreSQL database (`obf`).
> It does not read hbf-core MongoDB objects directly. It has no dependency on hbf-core-api.
> Full platform schemas: [`docs/domain-model.md`](../../docs/domain-model.md)

## Local Entities (TypeORM, PostgreSQL — `obf` database)

| Entity | Table | Key fields |
|--------|-------|-----------|
| `OpenBot` | `open_bot` | `id` (uuid PK), `handle` (unique), `endpoint`, `schemaVersion` |
| `OpenBotSecret` | `open_bot_secret` | `id` (uuid PK), `openBotId` (FK → OpenBot), `secretHash`, `plainReducted`, `expiresAt` |
| `WebChatChannel` | `web_chat_channel` | `id` (string PK), `openBotId` (FK → OpenBot), `name`, `secret1`, `secret2` |

---

### OpenBot

> A registered bot: its handle (human-readable identifier) and HTTP endpoint where activities are forwarded.

| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `id` | uuid | yes | PK, auto-generated | |
| `handle` | string | yes | Unique index (`IDX_OpenBot_handle`) | Pattern: `/^[a-zA-Z][a-zA-Z0-9-]{2,62}[a-zA-Z0-9]$/` |
| `endpoint` | string | yes | | HTTP URL of the bot backend |
| `schemaVersion` | string | yes | Default: `'v1.3'` | Bot Framework schema version |
| `createdAt` | timestamptz | yes | Auto-set | |
| `updatedAt` | timestamptz | yes | Auto-updated | |

**DTO (API response):** `OpenBotDto` — same fields, all exposed.

---

### OpenBotSecret

> A SHA-256 hashed API secret for a bot. Used for bot-to-gateway OAuth2 client credentials auth.

| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `id` | uuid | yes | PK, auto-generated | |
| `openBot` | OpenBot | yes | FK, `CASCADE` delete | Owner bot |
| `description` | string | yes | | Human label for the secret |
| `createdAt` | timestamptz | yes | Auto-set | |
| `expiresAt` | timestamptz | no | Nullable | Optional expiry |
| `secretHash` | string | yes | | SHA-256 hash of the secret value |
| `plainReducted` | string | yes | | Redacted plain version shown in UI (e.g. `abc...xyz`) |

**DTO (API response):** `OpenBotSecretDto` — exposes `secretId`, `description`, `createdAt`, `expiresAt`, `secret` (plain on creation only, otherwise `plainReducted`).

---

### WebChatChannel

> A webchat site/channel linked to a bot. Holds two rotating secrets used to generate DirectLine tokens.

| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `id` | string | yes | PK (caller-supplied, not auto) | Site ID |
| `openBot` | OpenBot | yes | FK, `CASCADE` delete | Owner bot |
| `name` | string | yes | | Display name |
| `secret1` | string | yes | Indexed | Primary webchat secret |
| `secret2` | string | yes | Indexed | Secondary webchat secret (rotation) |
| `createdAt` | timestamptz | yes | Auto-set | |

**DTO (API response):** `WebChatChannelDto` — exposes `id`, `name`, `createdAt`, `secret1`, `secret2`.

---

## Runtime / In-Memory Objects (not persisted)

These objects are transient — they live only in memory or as JWT tokens. There is no database table for conversations or activities.

### Conversation (runtime state)

| Field | Source | Notes |
|-------|--------|-------|
| `conversationId` | string | Generated as `<12-char-random>-<region>` |
| `token` | JWT string | DirectLine JWT (see below) |
| `streamUrl` | string | WebSocket URL: `ws://<DIRECTLINE_SOCKET_URL>/v3/directline/conversations/:id/stream?watermark=...&t=<token>` |
| `watermark` | integer | Activity counter, stored in Redis or in-memory via `AtomicOperationsService` |

Conversations are not stored in the DB. State is fully represented by the signed JWT token held by the client.

### DirectLine JWT payload (`DirectLineTokenPayload`)

| Field | Type | Notes |
|-------|------|-------|
| `bot` | string | Bot handle (`OpenBot.handle`) |
| `site` | string | WebChat channel ID (`WebChatChannel.id`) |
| `conv` | string | Conversation ID |
| `user` | string (optional) | User ID provided at token generate/conversation create |
| `iss` | string | `https://<DIRECTLINE_HOST>/` |
| `aud` | string | `https://<DIRECTLINE_HOST>/` |
| `nbf` | number | Not-before (Unix timestamp) |
| `exp` | number | Expiration (Unix timestamp, default +3600s) |

### Bot Access Token payload (OAuth2 client credentials)

Used for bot-to-gateway server calls (`/oauth2/v2.0/token`). Signed with the same `JWT_SECRET`.

| Field | Type | Notes |
|-------|------|-------|
| `aud` | string | `scope` param or `https://api.botframework.com/.default` |
| `iss` | string | `DIRECTLINE_HOST` |
| `sub` | string | `client_id` (OpenBotSecret.id) |
| `exp` | number | Expiration (Unix timestamp) |

### Activity (runtime, from `botframework-schema`)

Activities are the core message objects forwarded between clients and bots. Not stored in DB. Fields set by this service at creation time:

| Field | Notes |
|-------|-------|
| `id` | `<conversationId>|<7-digit-zero-padded-counter>` for regular; `<conversationId>|<11-random-chars>` for `typing` |
| `timestamp` | Set to `new Date()` at creation |
| `serviceUrl` | Set to `DIRECTLINE_HOST` env value |
| `conversation` | `{ id: conversationId, isGroup: false, conversationType: '', name: '' }` |
| `recipient` | Set by gateway when routing user activity: `{ id: '<handle>@<siteId>', name: handle }` |
| `replyToId` | Set on bot-reply activities |

All other Activity fields (e.g. `type`, `text`, `attachments`, `from`) come from the client or bot verbatim.

---

## Pagination Wrapper

All list endpoints use `PaginatedTransform<S, T>`:

| Field | Type | Notes |
|-------|------|-------|
| `items` | T[] | Page of results |
| `total` | number | Total record count |
| `page` | number | Current page (1-based) |
| `pageSize` | number | Records per page |

---

## Notes

- `synchronize: true` in TypeORM config — schema auto-syncs from entities on startup. Disable in production.
- `WebChatChannel.id` is caller-supplied (not auto-generated UUID). The caller is responsible for uniqueness.
- `OpenBotSecret.secretHash` is never returned by the API. The plain secret is returned once at creation, then only `plainReducted` is accessible.
- The watermark counter key in Redis/memory is the `conversationId`. It increments per non-`typing` activity.
- `secret1` and `secret2` on `WebChatChannel` are both independently valid for token generation (key rotation pattern). Both are indexed for fast lookup.
