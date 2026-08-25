# Logging Guidelines

Fastify default logger (pino). `app.log.info` on listen. Unexpected errors: `req.log.error(err)` then 500 JSON without the stack.

Do not log passwords, session ids, or cookie headers.
