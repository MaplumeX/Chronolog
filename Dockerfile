FROM node:22-bookworm-slim AS build

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

RUN npm run build -w web

FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/chronolog.db
ENV WEB_DIST=/app/web/dist
ENV PORT=8080
ENV COOKIE_SECURE=false

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/web/package.json ./web/package.json
COPY --from=build /app/web/dist ./web/dist

RUN mkdir -p /data

EXPOSE 8080

CMD ["npm", "start", "-w", "server"]
