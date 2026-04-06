# Deployment: open-bot-framework

> Infrastructure config for this service.
> Full platform deployment: [`docs/architecture/deployment.md`](../../hbf-agentic-framework/docs/architecture/deployment.md)

## Runtime

- **HTTP Port:** 1986 (env: `PORT`, default 1986)
- **WebSocket Port:** 1992 (env: `SOCKET_PORT`, default 1992)
- **Base image:** `node:22` (build stage), `node:22-slim` (runtime stage) — multi-stage Dockerfile
- **Start command:** `node dist/src/main` (production) / `nest start --watch` (dev)
- **Health check:** none defined

## Required Environment Variables

| Variable | Example | Description |
|----------|---------|-------------|
| PORT | 1986 | HTTP listen port |
| SOCKET_PORT | 1992 | WebSocket server port |
| DIRECTLINE_HOST | localhost.home | Hostname used in DirectLine stream URLs |
| DIRECTLINE_REGION | eu | Region tag |
| DIRECTLINE_SOCKET_URL | wss://localhost:1992 | WebSocket base URL returned to clients |
| JWT_SECRET | (secret) | JWT signing secret for DirectLine tokens |
| JWT_EXPIRATION_SECONDS | 3600 | DirectLine token lifetime in seconds |
| TYPEORM_CONNECTION | postgres | DB driver (postgres) |
| TYPEORM_HOST | localhost | PostgreSQL host |
| TYPEORM_PORT | 5432 | PostgreSQL port |
| TYPEORM_USERNAME | postgres | PostgreSQL user |
| TYPEORM_PASSWORD | (secret) | PostgreSQL password |
| TYPEORM_DATABASE | obf | PostgreSQL database name |
| TYPEORM_ENTITIES | dist/**/*.entity.js | TypeORM entity glob |
| TYPEORM_MIGRATIONS | dist/migrations/*.js | TypeORM migrations glob |
| TYPEORM_MIGRATIONS_DIR | migrations | Migrations source directory |
| TYPEORM_AUTORUN_MIGRATIONS | true | Run migrations on startup |
| STORAGE_ACCESS_KEY | (secret) | S3-compatible access key |
| STORAGE_SECRET_KEY | (secret) | S3-compatible secret key |
| STORAGE_BUCKET | | S3 bucket name |
| STORAGE_REGION_S3 | us-east-1 | S3 region (AWS S3 only) |
| STORAGE_FORCE_S3_PATH_STYLE | true | Force path-style URLs (MinIO/custom endpoints) |
| STORAGE_ENDPOINT | | S3-compatible endpoint URL (leave unset for AWS) |
| REDIS_URI | redis://localhost:6379 | Redis connection URI |
| ATOMIC_OPERATIONS_IMPLEMENTATION | redis | Counter backend: `redis` or `memory` |

## Docker

Multi-stage Dockerfile: `node:22` (build) and `node:22-slim` (runtime). Exposes ports 1986 (HTTP) and 1992 (WebSocket).

```bash
# Build Docker image
docker build -t open-bot-framework .

# Run (production)
node dist/src/main

# Run (dev, hot reload)
npm run start:dev
```

## CI/CD

No CI/CD configuration is present in this repository (no `.github/workflows/`). Deployment is managed externally.

## Notes

- Two ports are required: HTTP (`PORT`) and WebSocket (`SOCKET_PORT`). Both must be accessible to clients.
- PostgreSQL is the only supported database (`TYPEORM_CONNECTION=postgres`). Schema sync is handled via TypeORM migrations run automatically on startup.
- Redis is optional: if `ATOMIC_OPERATIONS_IMPLEMENTATION=memory` (or Redis is unreachable), the service falls back to an in-memory atomic counter. This is not safe for multi-instance deployments.
- S3 storage is used for conversation attachment uploads. All three of `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, and `STORAGE_BUCKET` must be set for uploads to work. `STORAGE_ENDPOINT` is only needed for non-AWS S3-compatible services (MinIO, Wasabi, DigitalOcean Spaces).
- `ormconfig.ts` loads `.env.local` (not `.env`) for migration CLI commands. Set up a local `.env.local` for running migrations manually.
