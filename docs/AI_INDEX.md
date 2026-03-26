# AI Index: open-bot-framework

> Context groups for agent sessions. Load only what's relevant.

## Base Context (always load)

1. `docs/AI_BRIEF.md` — repo summary, API surface, data models
2. `docs/architecture.md` — component diagram

## Context Groups

### directline
Files relevant to DirectLine 3.0 protocol work:
- `src/features/directline/directline.controller.ts` — user-facing DirectLine endpoints
- `src/features/directline/directline-alt.controller.ts` — bot reply endpoint (`/v3/conversations/...`)
- `src/features/directline/directline-conversation.service.ts` — conversation create/get, activity routing, bot HTTP forward
- `src/features/directline/dirtectline-token.service.ts` — token generate/refresh/verify (JWT)
- `src/features/directline/directline.gateway.ts` — WebSocket server, per-conversation socket map
- `src/features/directline/directline.module.ts` — module wiring
- `src/dto/directline.dto.ts` — token/payload types
- `src/dto/conversation.dto.ts` — conversation response shape

### auth
Load when working on auth guards, token validation, or protected endpoints:
- `docs/auth.md` — tokens this service accepts, sends, and issues
- `docs/architecture/auth-flows.md` — full auth flow sequence diagrams (Flow 6)
- `src/features/authorization/authorization.controller.ts` — `/oauth2/v2.0/token` (client credentials)
- `src/features/authorization/authorization.service.ts` — token generation + verification
- `src/features/authorization/authorization.utils.ts` — bearer extraction, random helpers
- `src/dto/token.dto.ts` — access token request DTO

### bots
Files relevant to bot and secret management:
- `src/features/openbot/openbot.controller.ts` — `/bots` CRUD
- `src/features/openbot/openbot.service.ts` — bot find/create/update/delete, cached lookup
- `src/features/openbotsecret/openbotsecret.controller.ts` — bot secret CRUD
- `src/features/openbotsecret/openbotsecret.service.ts` — secret hashing + validation
- `src/entities/openbot.entity.ts` — `OpenBot` + `OpenBotSecret` entities
- `src/dto/openbot.dto.ts` — OpenBot/OpenBotSecret DTOs

### webchat-channel
Files relevant to webchat channel management:
- `src/features/channels/webchat/webchat.controller.ts` — `/bots/:botId/webchat` CRUD
- `src/features/channels/webchat/webchat.service.ts` — channel create/update/delete
- `src/entities/webchat.entity.ts` — `WebChatChannel` entity
- `src/dto/webchat.dto.ts` — WebChatChannel DTO

### storage
Files relevant to file upload:
- `src/features/storage/storage.service.ts` — S3-compatible upload, object key generation
- `src/dto/upload.dto.ts` — file upload DTO

### atomicity
Files relevant to activity watermark counters:
- `src/features/atomicity/atomic-operations.service.ts` — incr/get/set wrapper
- `src/features/atomicity/atomicity-operations-manager.interface.ts` — interface
- `src/features/atomicity/atomic-operations-manager.redis.ts` — Redis backend
- `src/features/atomicity/atomic-operations-manager.memory.ts` — in-memory fallback
- `src/features/atomicity/atomic-operations.provider.ts` — backend selection from env

### deployment
Load when working on Docker, env vars, ports, or CI/CD for this service:
- `docs/deployment.md` — port, required env vars, local run commands, notes
- `docs/architecture/deployment.md` (framework) — full platform deployment reference

### data-model
Files relevant to DB schema:
- `docs/data-model.md` — full field-level schemas for all entities, runtime objects, and JWT payloads
- `src/entities/openbot.entity.ts` — `OpenBot`, `OpenBotSecret`
- `src/entities/webchat.entity.ts` — `WebChatChannel`
- `ormconfig.ts` — TypeORM DataSource for migrations
- `src/app.module.ts` — TypeORM async config

### resilience
Load when debugging timeouts, retry failures, or designing fault-tolerant changes:
- `docs/resilience.md` — retry policies, timeouts, and known gaps for this service
- `docs/architecture/resilience.md` — platform-wide resilience patterns

### communication
Load when working on service boundaries or tracing a call chain:
- `docs/communication.md` — what this service calls and what calls it (bot HTTP forward, S3, Redis, DirectLine client contracts)
- `docs/architecture/service-communication.md` (framework repo) — full system dependency graph

### pipeline
Files relevant to how open-bot-framework fits into the platform NLU/message pipeline:
- `docs/architecture/nlu-pipelines.md` (framework repo) — role as DirectLine channel gateway, message flow to hbf-bot and hbf-nlp, auth model, data model, key config
- `src/features/directline/directline-conversation.service.ts` — bot HTTP forward logic (`userReplyToConversation`, `replyToActivity`)
- `src/features/directline/directline.gateway.ts` — WebSocket broadcast to client after bot reply

### node-types
Load when working on message flows, activity routing, or service internals:
- `docs/architecture/bot-nodes.md` — full service architecture: data models, token types, request flows (6 flows), WebSocket lifecycle, atomicity, env vars
- `src/features/directline/directline-conversation.service.ts` — core activity routing (user send, bot reply, file upload)
- `src/features/directline/directline.gateway.ts` — WebSocket server, per-conversation socket map
- `src/features/atomicity/` — activity watermark counter (Redis or memory)
- `src/features/storage/storage.service.ts` — S3-compatible file upload
