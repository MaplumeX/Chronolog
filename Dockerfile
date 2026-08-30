# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:22-bookworm-slim AS build

# Build tools for native modules (better-sqlite3)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/

RUN npm ci

COPY server server
COPY web web

# Build the web frontend
RUN npm run build -w web

# Install production dependencies for the server into a clean dir
RUN mkdir /prod \
  && cp package.json package-lock.json /prod/ \
  && mkdir /prod/server \
  && cp server/package.json /prod/server/ \
  && cd /prod \
  && npm ci --omit=dev --workspace server

# ---------- Runtime stage ----------
FROM node:22-bookworm-slim

# tini for proper signal handling / zombie reaping (PID 1)
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production \
    DATABASE_PATH=/data/chronolog.db \
    WEB_DIST=/app/web/dist \
    PORT=8080 \
    COOKIE_SECURE=false

# Copy production server dependencies and server source
COPY --from=build /prod/package.json /prod/package-lock.json ./
COPY --from=build /prod/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/web/dist ./web/dist

# Dedicated non-root user
RUN useradd --system --uid 10001 --create-home chronolog \
  && mkdir -p /data \
  && chown -R chronolog:chronolog /data /app

USER chronolog

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT}/api/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "start", "-w", "server"]
