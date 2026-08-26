# Thinking Guides

Ask these questions before coding. Most Chronolog bugs so far sit on boundaries (timezone, isolation, dual clip math), not inside a single function.

---

## Available Guides

| Guide | Purpose | When to use |
|-------|---------|-------------|
| [Cross-Layer Thinking](./cross-layer-thinking-guide.md) | Data flow across SQLite, Fastify JSON, and React | Feature spans API + UI, or changes a payload field |
| [Code Reuse Thinking](./code-reuse-thinking-guide.md) | Stop duplicate clip/duration/DTO logic | New helper, new field, or copy-paste |
| [Ops and Docker](./ops-and-docker.md) | One-process deploy, cookies, WAL volume | Env, Dockerfile, compose, `WEB_DIST` |

## Quick triggers

### Cross-layer

- [ ] Adding a JSON field to an entry, category, or stats payload
- [ ] Changing how “today” is computed or displayed
- [ ] Auth, cookies, or user isolation
- [ ] Error `code` / `message` the UI displays
- [ ] `clipSeconds` on either server or web

→ [Cross-Layer Thinking](./cross-layer-thinking-guide.md)

### Reuse

- [ ] Second copy of duration or clip math
- [ ] New DTO type in a page file
- [ ] New default category name
- [ ] Same surface/table pattern as an existing page (do not wrap in `Card`)

→ [Code Reuse Thinking](./code-reuse-thinking-guide.md)

### Ops

- [ ] New env var
- [ ] Cookie `Secure` / path
- [ ] Database path or volume
- [ ] How the SPA is served in production

→ [Ops and Docker](./ops-and-docker.md)

---

## Pre-modification rule

Before changing a string, status code, or column name:

```bash
rg "the_value" server web
```

Update every caller in the same change, including tests and `web/src/api.ts`.
