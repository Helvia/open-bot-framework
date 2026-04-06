# AI Brief: open-bot-framework

> Self-hosted DirectLine 3.0 gateway. Replaces Azure's hosted DirectLine service. hbf-webchat calls OBF for tokens and activity delivery; OBF forwards activities to hbf-bot over HTTP and streams replies back to the widget via WebSocket.

## What This Repo Does

Implements the Microsoft Bot Framework DirectLine 3.0 protocol as a standalone NestJS service. Manages bot registrations, webchat channel secrets, conversation lifecycle, and real-time activity delivery via WebSocket. Acts as the relay between the browser widget and the bot backend (e.g. hbf-bot).

## Tech Stack

- Language: TypeScript
- Framework: NestJS 11 + Fastify adapter
- Key dependencies: TypeORM + PostgreSQL, ioredis, `botframework-schema`, `@nestjs/jwt`, MinIO client (S3-compatible storage), `ws` (raw WebSocket server)

## Entry Points

- Main: `src/main.ts` (HTTP on `PORT`, default 1986)
- WebSocket: `src/features/directline/directline.gateway.ts` (separate port `SOCKET_PORT`, default 1992)
- Config: `.env` / `.env.local`

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/features/directline/` | DirectLine 3.0 protocol: token, conversation, activity routing |
| `src/features/authorization/` | OAuth2 client-credentials endpoint for bot-to-gateway auth |
| `src/features/openbot/` | CRUD for registered bots (handle + HTTP endpoint) |
| `src/features/openbotsecret/` | CRUD for bot API secrets (SHA-256 hashed) |
| `src/features/channels/webchat/` | CRUD for webchat channel secrets (linked to a bot) |
| `src/features/atomicity/` | Redis or in-memory atomic counter for activity watermarks |
| `src/features/storage/` | S3-compatible file upload for conversation attachments |
| `src/entities/` | TypeORM entities: `OpenBot`, `OpenBotSecret`, `WebChatChannel` |
| `src/dto/` | Request/response DTOs |
| `src/filters/` | Global exception filter |

## API Surface

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/oauth2/v2.0/token` | Client credentials token (bot → gateway auth) |
| POST | `/v3/directline/tokens/generate` | Generate DirectLine token from webchat secret |
| POST | `/v3/directline/tokens/refresh` | Refresh DirectLine token |
| POST | `/v3/directline/conversations` | Create conversation |
| GET | `/v3/directline/conversations/:id` | Get conversation + stream URL |
| POST | `/v3/directline/conversations/:id/activities` | User sends activity |
| POST | `/v3/directline/conversations/:id/upload` | Multipart file upload |
| POST | `/v3/conversations/:id/activities/:actId` | Bot replies to activity |
| GET/POST/PUT/DELETE | `/bots` | Bot CRUD |
| GET/POST/PATCH/DELETE | `/bots/:botId/webchat` | WebChat channel CRUD |

## Data Models

- `OpenBot` — registered bot: `id` (uuid), `handle` (unique), `endpoint` (HTTP URL), `schemaVersion`
- `OpenBotSecret` — bot API key: `secretHash` (SHA-256), `plainReducted`, `expiresAt`, `description`
- `WebChatChannel` — webchat site: `id`, `name`, `secret1`, `secret2`, belongs to `OpenBot`

## External Dependencies

- Database: PostgreSQL (TypeORM, `synchronize: true`, database name `obf` by default)
- Cache/Atomicity: Redis (ioredis) or in-memory fallback (controlled by `ATOMIC_OPERATIONS_IMPLEMENTATION`)
- Storage: S3-compatible (MinIO, Wasabi, DigitalOcean Spaces, AWS S3)
- Bot backends: any HTTP endpoint registered as an `OpenBot`

## Running Locally

```bash
npm run start:dev   # watch mode, hot reload
```

Ports: HTTP `1986`, WebSocket `1992` (both configurable via env).

## Tests

```bash
npm run test        # unit tests (Jest)
npm run test:e2e    # e2e tests
```
