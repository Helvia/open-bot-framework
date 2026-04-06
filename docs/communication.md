# Communication: open-bot-framework

> 1-hop view of how this service communicates with its siblings.
> For the full system view, see [`docs/architecture/service-communication.md`](../../hbf-agentic-framework/docs/architecture/service-communication.md).

## Calls Out To

| Service | Protocol | Purpose | Key calls / endpoints |
|---------|----------|---------|----------------------|
| Bot backends (any registered OpenBot) | HTTP POST | Forward user activity to bot endpoint | `POST <OpenBot.endpoint>` (configured per-bot in DB) |
| S3-compatible storage | MinIO client (S3-compatible) | Store conversation file attachments | Upload to configured bucket |
| Redis | ioredis | Atomic activity watermark counters (incr/get/set with 1-hour TTL) | Key: `<conversationId>` |
| PostgreSQL | TypeORM | Persist bots, secrets, webchat channel registrations | `OpenBot`, `OpenBotSecret`, `WebChatChannel` entities |

## Called By

| Caller | Protocol | How |
|--------|----------|-----|
| hbf-webchat (or any DirectLine-compatible browser widget) | HTTP + WebSocket | DirectLine 3.0 protocol: token generate/refresh, conversation create/get, activity send/upload; WebSocket stream for bot replies |
| hbf-bot (or any registered bot backend) | HTTP POST | Bot replies via `POST /v3/conversations/:id/activities/:actId` using an OAuth2 client-credentials access token |
| Ops / admin tooling | HTTP REST | Bot and webchat channel CRUD via `/bots` and `/bots/:botId/webchat` |

## Contracts

### Inbound — webchat client

DirectLine 3.0 endpoints. All require `Authorization: Bearer <token>` (DirectLine token or webchat site secret).

**`POST /v3/directline/tokens/generate`** — exchange webchat site secret for a DirectLine token:
```json
Request:  { "user": { "id": "string", "name": "string" } }
Response: { "conversationId": "string", "token": "string", "expires_in": 3600 }
```

**`POST /v3/directline/conversations`** — create conversation:
```json
Request:  { "user": { "id": "string" } }
Response: { "conversationId": "string", "token": "string", "expires_in": 3600, "streamUrl": "wss://..." }
```

**`POST /v3/directline/conversations/:id/activities`** — user sends activity:
```json
Request:  Bot Framework Activity (botframework-schema)
Response: { "id": "<conversationId>|0000001" }
```

**WebSocket stream** (`SOCKET_PORT`, default 1992): client connects to `streamUrl` with `?t=<token>`. Server pushes `Transcript` objects (array of activities) as JSON strings.

### Inbound — bot backend reply

**`POST /v3/conversations/:id/activities/:actId`** — bot replies:
```json
Request headers: Authorization: Bearer <access_token>  (obtained via /oauth2/v2.0/token)
Request body:    Bot Framework Activity
Response:        { "id": "<conversationId>|<watermark>" }
```

**`POST /oauth2/v2.0/token`** — bot obtains access token (client credentials):
```json
Request:  { "grant_type": "client_credentials", "client_id": "<botHandle>", "client_secret": "<plainSecret>" }
Response: { "access_token": "string", "token_type": "Bearer", "expires_in": 3600 }
```

### Outbound — forwarding user activity to bot

**`POST <OpenBot.endpoint>`** — HTTP POST to bot's registered endpoint:
```json
Content-Type: application/json
Body: Bot Framework Activity (enriched with id, timestamp, serviceUrl, conversation)
Timeout: 5000ms
```

## Flows Involving This Service

- [Message Processing](../../hbf-agentic-framework/docs/architecture/flows/message-processing.md) — open-bot-framework replaces the hosted Direct Line in this flow for self-hosted deployments

## Confidence

- Bot backend (HTTP forward): high (explicit `httpService.post(targetBot.endpoint, ...)` with 5 s timeout)
- S3 storage: high (MinIO client, configured via `STORAGE_*` env vars)
- Redis: high (ioredis, `REDIS_URI` env var, falls back to in-memory if unavailable)
- PostgreSQL: high (TypeORM entities, `TYPEORM_*` env vars)
- No Bull queues, no Redis pub/sub, no Socket.IO inter-service connections detected
