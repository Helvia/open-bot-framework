# syntax=docker/dockerfile:1

ARG NODE_VERSION=22

# ---------------------------------------------------------------------------
# Admin SPA (client/) -> client/dist
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS client-builder

WORKDIR /app/client

COPY client/package.json client/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY client/ ./
RUN npm run build


# ---------------------------------------------------------------------------
# Production node_modules only (no devDependencies, no client workspace)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --workspaces=false --no-audit --no-fund


# ---------------------------------------------------------------------------
# NestJS server -> dist/
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspaces=false --no-audit --no-fund

# ormconfig.ts sits at the repo root, so tsc emits dist/src/main.js and dist/ormconfig.js.
# Keep it in the copy or the output layout (and CMD below) changes.
COPY nest-cli.json tsconfig.json tsconfig.build.json ormconfig.ts ./
COPY src ./src
RUN npm run build


# ---------------------------------------------------------------------------
# Runtime image
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS production

ENV NODE_ENV=production

# tini runs as PID 1: it forwards SIGTERM to node and reaps zombies, so
# `docker stop` / pod termination shuts the app down cleanly instead of waiting for SIGKILL.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

# Dedicated unprivileged user with a fixed numeric UID/GID (works with k8s runAsNonRoot).
ARG APP_UID=10001
ARG APP_GID=10001
RUN groupadd --system --gid ${APP_GID} appuser \
    && useradd --system --uid ${APP_UID} --gid appuser --no-create-home --shell /usr/sbin/nologin appuser

WORKDIR /app

# Files stay owned by root and are read-only for appuser: the app does not write to disk
# (uploads go to S3/MinIO), so a compromised process cannot modify its own code.
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=client-builder /app/client/dist ./client/dist

USER appuser

# 1986 = HTTP (PORT), 1992 = DirectLine WebSocket (SOCKET_PORT). Both >1024, so no root needed.
EXPOSE 1986 1992

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 1986) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/src/main"]
