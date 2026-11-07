# AGENTS.md

This file provides guidance to AI coding agents working in this repository.

## Overview

open-bot-framework (OBF) is a self-hosted replacement for Microsoft's hosted DirectLine service. It provides the DirectLine REST API that hbf-webchat connects to, and relays messages to/from hbf-bot via REST.

Flow: `hbf-webchat (browser) -> OBF (DirectLine API) -> hbf-bot (REST)`

## Tech Stack

- **Language:** TypeScript
- **Framework:** NestJS 11 with **Fastify** (NOT Express)
- **Database:** PostgreSQL (via TypeORM + `pg` driver)
- **WebSockets:** `ws` library via `@nestjs/platform-ws` (NOT Socket.io)
- **Cache:** Redis (ioredis)
- **File storage:** AWS S3 (`@aws-sdk/client-s3`)
- **Compiler:** tsc via `nest build` (SWC is installed but not enabled in `nest-cli.json`)
- **Linting:** ESLint flat config (`eslint.config.mjs`) + Prettier

## Commands

```bash
npm run build        # nest build (tsc)
npm run start:dev    # nest start --watch
npm run start:prod   # node dist/src/main
npm test             # Jest
npm run lint         # ESLint --fix
npm run format       # Prettier --write

# TypeORM migrations
npm run migration:generate -- --name=MigrationName
npm run migration:run
npm run migration:revert
```

## Source Structure

```
src/
  main.ts             # Fastify bootstrap
  app.module.ts       # Root module
  app.controller.ts   # DirectLine REST endpoints
  app.service.ts      # Core business logic
  entities/           # TypeORM entities (PostgreSQL)
  dto/                # Request/response DTOs
  filters/            # Exception filters
test/                 # E2E tests
ormconfig.ts          # TypeORM datasource config
nest-cli.json         # NestJS CLI config
```

## Conventions

- **Fastify, not Express.** Use Fastify-compatible APIs. `@nestjs/platform-fastify` is the HTTP adapter.
- **`ws`, not Socket.io.** WebSocket connections use the `ws` library via `@nestjs/platform-ws`.
- **PostgreSQL, not MySQL.** This is the only HBF service using Postgres.
- ESLint flat config (`eslint.config.mjs`), not legacy `.eslintrc`.
- DTOs in `src/dto/`, entities in `src/entities/`.
- TypeORM migrations: build first, then run against `dist/ormconfig.js`.

## Gotchas

- This service uses Fastify. Do not use Express middleware or decorators.
- PostgreSQL (not MySQL like other services). Connection config in `ormconfig.ts`.
- `nest build` uses tsc, not SWC: `nest-cli.json` has no `"builder": "swc"`. SWC (`@swc/cli`, `@swc/core`) is installed but unused.
- Build output is `dist/src/main.js` (not `dist/main.js`), because `ormconfig.ts` at the repo root widens the compile root. `start:prod` and the Dockerfile `CMD` both use `dist/src/main`.

## Docs

See `docs/` for AI-generated architecture docs.
