# Logging Guidelines

Fastify’s default logger (pino). `index.ts` logs `Chronolog listening on ${port}` after `listen`. Tests pass `logger: false` in `createTestApp`.

Unexpected errors: `req.log.error(err)` in `app.ts` `setErrorHandler`, then 500 JSON without the stack or internal message.

## What not to log

Do not log passwords, Argon2 hashes, session ids, raw `Cookie` headers, or `sid` cookie values. Route handlers currently do not log per-request business events; do not add noisy `info` on every start/stop unless you are debugging.

There is no request-id or structured audit log in this MVP. Do not introduce a second logging library.
