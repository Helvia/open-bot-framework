# Deployment: open-bot-framework

> Infrastructure config for this service.
> Full platform deployment: [`docs/architecture/deployment.md`](../../hbf-agentic-framework/docs/architecture/deployment.md)

## Runtime

- **HTTP port:** `1986`. From `process.env.PORT` with a literal `1986` fallback in `src/main.ts` (`app.listen(process.env.PORT ?? 1986, '0.0.0.0')`).
- **WebSocket port:** `SOCKET_PORT`, no fallback. `DirectLineGateway` opens its own `ws.Server({ port: SOCKET_PORT })` in `onModuleInit`, separate from the Fastify HTTP server. If `SOCKET_PORT` is unset, `Number(undefined)` is `NaN` and `ws` binds a random free port.
- **Base image:** `node:22` for the build stages (`client-builder`, `prod-deps`, `builder`) -> `node:22-slim` (`production` stage). `NODE_VERSION` build arg, default `22`.
- **Runtime user:** non-root `appuser` (UID/GID `10001`, overridable via `APP_UID` / `APP_GID` build args). App files are root-owned and read-only to it; the app does not write to disk. Both ports are >1024, so no extra capabilities are needed. Pairs with k8s `runAsNonRoot: true` / `runAsUser: 10001`.
- **PID 1:** `tini` (`ENTRYPOINT ["/usr/bin/tini", "--"]`) forwards SIGTERM to node and reaps zombies.
- **Dependencies:** production `node_modules` comes from a separate `prod-deps` stage (`npm ci --omit=dev --workspaces=false`), so the `client/` workspace's React/Vite packages are not shipped.
- **Start command:** `node dist/src/main` (Dockerfile `CMD`). Dev: `npm run start:dev`.
- **Health check:** `GET /health` returns `200 {"status":"ok"}` while the process serves HTTP. Liveness only: it does not check the DB, Redis, or the WebSocket server. No auth, no rate limit. The Dockerfile `HEALTHCHECK` calls it every 30s via `node -e fetch(...)` on `PORT` (default `1986`); Docker / compose use it, Kubernetes ignores it and needs its own probes.

The HTTP adapter is Fastify, not Express. CORS is `origin: true` (reflects any origin) for `GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS`.

A React + Vite + Tailwind admin SPA lives in `client/` (npm workspace `openbot-ui`). It is built separately and served by `ServeStaticModule` from `<cwd>/client/dist` with `fallthrough: true` so client-side routes resolve to the SPA index. The Docker `production` stage copies `client/dist` from the `client-builder` stage, so the SPA ships inside the same image and is served off the HTTP port.

## Required Environment Variables

Config is loaded by `@nestjs/config` from `['.env.local', '.env']`, in that order, with real process env taking precedence.

**Server**

| Variable | Required | Description |
|----------|----------|-------------|
| PORT | no | HTTP listen port, defaults to `1986` |
| SOCKET_PORT | yes | DirectLine WebSocket server port. No default; leaving it unset binds a random port |

**DirectLine**

| Variable | Required | Description |
|----------|----------|-------------|
| DIRECTLINE_HOST | yes | Host used when building DirectLine URLs returned to clients |
| DIRECTLINE_REGION | yes | Region tag echoed in DirectLine token responses |
| DIRECTLINE_SOCKET_URL | yes | WebSocket base URL handed to clients for the stream connection |
| JWT_SECRET | yes | Signing secret for DirectLine and admin tokens |
| JWT_EXPIRATION_SECONDS | yes | DirectLine token lifetime |

**Admin auth**

| Variable | Required | Description |
|----------|----------|-------------|
| ADMIN_USERNAME | yes | Admin UI username |
| ADMIN_PASSWORD | yes | **bcrypt hash** of the admin password, not the plaintext |

**Database (TypeORM)**

| Variable | Required | Description |
|----------|----------|-------------|
| TYPEORM_CONNECTION | yes | Driver name passed straight to TypeORM. `postgres` and `mysql` are both installed and both used in practice |
| TYPEORM_HOST | yes | DB host |
| TYPEORM_PORT | yes | DB port |
| TYPEORM_USERNAME | yes | DB user |
| TYPEORM_PASSWORD | yes | DB password |
| TYPEORM_DATABASE | yes | DB name |
| TYPEORM_AUTORUN_MIGRATIONS | no | Compared against the string `'true'`; sets TypeORM `migrationsRun`. There are no migration files, so this is a no-op today |
| TYPEORM_ENTITIES | no | Present in env files; the code hardcodes the entity glob and never reads this |
| TYPEORM_MIGRATIONS | no | Same: the migrations glob is hardcoded |
| TYPEORM_MIGRATIONS_DIR | no | Only meaningful for the `migration:generate` CLI script |

**Object storage (MinIO client)**

| Variable | Required | Description |
|----------|----------|-------------|
| STORAGE_ENDPOINT | yes | Full URL of the S3-compatible endpoint. `StorageService` throws `STORAGE_ENDPOINT is required` at construction if empty, including for AWS S3 |
| STORAGE_BUCKET | yes | Bucket name; also throws when empty |
| STORAGE_ACCESS_KEY | yes | Access key |
| STORAGE_SECRET_KEY | yes | Secret key |
| STORAGE_REGION_S3 | no | Passed through as the MinIO client `region` when set |
| STORAGE_FORCE_S3_PATH_STYLE | no | `'true'` enables path-style addressing |

**Redis**

| Variable | Required | Description |
|----------|----------|-------------|
| REDIS_URI | no | ioredis connection URI for the atomic counter backend |
| ATOMIC_OPERATIONS_IMPLEMENTATION | no | `redis` or `memory`; falls back to in-memory when Redis is unavailable |

**Elastic APM** (`elastic-apm-node`, started from `src/apm.ts`, the first import in `src/main.ts`)

The agent starts only when `ELASTIC_APM_SERVER_URL` is set. It reads its config straight from the process environment before Nest boots, so these must be real env vars (Deployment/ConfigMap/Secret): values in `.env` / `.env.local` are loaded later by `@nestjs/config` and are not seen by the agent. Any other [`ELASTIC_APM_*` option](https://www.elastic.co/guide/en/apm/agent/nodejs/current/configuration.html) works the same way.

| Variable | Required | Description |
|----------|----------|-------------|
| ELASTIC_APM_SERVER_URL | no | APM / Integrations Server URL. Unset = agent not started |
| ELASTIC_APM_SECRET_TOKEN | with server URL | APM secret token (or use `ELASTIC_APM_API_KEY`). Keep it in a Secret |
| ELASTIC_APM_SERVICE_NAME | no | Defaults to the `name` in package.json; set `open-bot-framework` |
| ELASTIC_APM_ENVIRONMENT | no | e.g. `production` |
| ELASTIC_APM_ACTIVE | no | `false` disables the agent even when a server URL is set |
| ELASTIC_APM_TRANSACTION_SAMPLE_RATE | no | `0.0`–`1.0`; lower it in prod to cut agent CPU overhead |

## Docker

```bash
# Build (builds the SPA, the Nest server, then prunes dev deps)
docker build -t open-bot-framework .

# Run the full stack: app + postgres + redis + minio
docker compose up --build
```

`docker-compose.yml` defines four services:

- `app` — built from the local Dockerfile, `restart: unless-stopped`, publishes `${PORT:-1986}` and `${SOCKET_PORT:-1992}`, loads `.env` via `env_file`. Its `environment:` overrides values for running inside compose (`.env` itself is unchanged for host-based dev):
  - `TYPEORM_HOST`, `TYPEORM_PASSWORD`, `REDIS_URI` point at the in-compose services.
  - `DIRECTLINE_HOST=localhost:${PORT}` and `DIRECTLINE_SOCKET_URL=ws://localhost:${SOCKET_PORT}`, so URLs handed to the browser work.
  - `TRUST_PROXY_HOPS=0`: no proxy in front, so `X-Forwarded-For` is not trusted.
  - `STORAGE_ENDPOINT=http://minio:9000`, `STORAGE_BUCKET=obf`, MinIO credentials. Without these `StorageService` throws at boot.
- `postgres` — `postgres:16-alpine`, database `obf`, named volume `postgres_data`, `pg_isready` healthcheck, published on `5432`.
- `redis` — `redis:7-alpine`, named volume `redis_data`, `redis-cli ping` healthcheck, published on `6379`.
- `minio` — `bitnamilegacy/minio:2025.7.23-debian-12-r5`, S3 API on `9000`, console on `9001`, credentials `minioadmin` / `minioadmin`, named volume `minio_data`. `MINIO_DEFAULT_BUCKETS=obf:download` creates the `obf` bucket with anonymous read on startup. The official `minio/minio` and `minio/mc` images were removed from Docker Hub and quay.io; the Bitnami legacy image is frozen (no updates), so it is for local dev only.

`app` waits for the postgres and redis healthchecks (`service_healthy`) and for `minio` to start (the app only talks to storage on upload, not at boot). Attachment links are built as `${STORAGE_ENDPOINT}/<bucket>/<key>`, so in compose they point to `http://minio:9000/...` and only resolve inside the compose network, not from the browser.

## CI/CD

- **Workflows:** `.github/workflows/ci.yml` (name: `pipeline`).
- **Trigger:** push to `main`, `staging`, or `develop`. No PR trigger.
- **Steps:**
  1. `test` job: Node 22 with npm cache and the GitHub Packages registry, `npm ci`, `npm test` (Jest). This is the only repo in this group whose pipeline runs tests.
  2. `audit` job: SonarQube scan, version from `npm-get-version-action`.
  3. `build` job: AWS credentials (`eu-central-1`), ECR login, `docker build`/`docker push` tagged with the short commit SHA, then branch-conditional `kubectl set image` and `kubectl rollout status --timeout=600s`.
- **Deploy target:** AWS EKS via `kodermax/kubectl-aws-eks` (kubectl `v1.22.0`), ECR repository `open-bot-framework`. Namespaces: `helvia-dev` (develop), `helvia-stg` (staging), `helvia` (main).
- **Secrets referenced (names only):** `PAT_TOKEN` (as `NODE_AUTH_TOKEN` for the private registry), `SONAR_TOKEN`, `SONAR_HOST_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `KUBE_CONFIG_DATA_NEW`.

## Local Development

`scripts/aq-local-dev.sh` runs the service natively:

```bash
npm run build      # BUILD_CMD
node dist/src/main # CMD
npm run start:dev  # DEV_CMD: nest --watch plus a Vite watch build of client/
```

`scripts/local-dev/generate-env.sh` writes `.env.local.dev` with `PORT=$OBF_PORT` (base `4218`), `SOCKET_PORT=$OBF_SOCKET_PORT` (base `4219`), a bcrypt-hashed local admin password, MinIO credentials for the shared local MinIO, and — importantly — `TYPEORM_CONNECTION=mysql` pointing at the shared platform MySQL container. Local dev therefore exercises the MySQL driver while `docker-compose.yml` and the committed `.env` use PostgreSQL.

The Nest `ConfigModule` reads `.env.local` and `.env`, not `.env.local.dev`, so the harness exports the generated values into the process environment rather than relying on file loading.

## Notes

- **Not PostgreSQL-only.** Both `pg` and `mysql2` are dependencies and `TYPEORM_CONNECTION` is passed through untouched (`src/app.module.ts`, `ormconfig.ts`). PostgreSQL is what compose and the committed `.env` use; local dev uses MySQL.
- **`synchronize: true` with no migrations.** `src/app.module.ts` hardcodes `synchronize: true`, so TypeORM alters the live schema from entity metadata on every boot. There is no `migrations/` directory, so `migrationsRun` and `TYPEORM_AUTORUN_MIGRATIONS` currently do nothing. Running `synchronize` against a shared or production database risks destructive column changes; introducing migrations means turning it off first.
- **Object storage uses the `minio` client, not `@aws-sdk`.** `StorageService` parses `STORAGE_ENDPOINT` with `new URL()` and derives `endPoint`, `port`, and `useSSL` from it, which is why the endpoint is mandatory for every backend including AWS S3.
- **Two listeners, two ports.** The Fastify HTTP server and the `ws.Server` are independent. Any ingress, service definition, or firewall rule has to expose both, and a health probe on the HTTP port says nothing about the WebSocket server.
- **`.env` is committed.** It holds local placeholder values (`JWT_SECRET='safe-256-bit'`, empty storage keys, empty DB password) plus a real bcrypt hash in `ADMIN_PASSWORD`. Nothing there is a live production credential, but the file being tracked means any accidental commit of real values would ship silently. `docker-compose.yml` loads it via `env_file`.
- `ormconfig.ts` loads only `.env.local` (via `dotenv`) for the `migration:*` and `schema:log` CLI scripts, so a plain `.env` is not enough for those commands.
