# Fill Chronolog Trellis Specs

## Goal

Write project-specific `.trellis/spec/` guidance from the current Chronolog codebase so later implement/check sessions follow local patterns instead of generic fullstack advice.

## Scope

- Spec directory: `.trellis/spec/backend/`, `.trellis/spec/frontend/`, `.trellis/spec/guides/`
- Source: `server/src`, `server/test`, `web/src`, `Dockerfile`, `docker-compose.yml`, `README.md`
- Archived product context: `.trellis/tasks/archive/2026-08/08-25-chronolog-mvp/`
- Out of scope: product source changes; GitNexus/ABCoder (not available in this host)

## Architecture Context

See `research/repository-analysis.md`. Single git repo, npm workspaces `server` + `web`, Trellis layers `backend` and `frontend`. Fastify + SQLite cookie sessions; Vite/React SPA with no router.

## Files Created Or Updated

Backend: `index.md`, `directory-structure.md`, `http-routes.md`, `database-guidelines.md`, `auth.md`, `time-and-timezone.md`, `error-handling.md`, `logging-guidelines.md`, `quality-guidelines.md`

Frontend: `index.md`, `directory-structure.md`, `component-guidelines.md`, `hook-guidelines.md`, `state-management.md`, `api-client.md`, `type-safety.md`, `quality-guidelines.md`

Guides: `index.md`, `cross-layer-thinking-guide.md`, `code-reuse-thinking-guide.md`, `ops-and-docker.md`

## Rules

- Specs describe the code as it exists now.
- Real paths and symbols; no template leftover.
- Indexes include Pre-Development Checklist + Quality Check.
- Language: English (agent-facing).

## Status

- [x] Fill backend guidelines
- [x] Fill frontend guidelines
- [x] Add code examples (paths, symbols, tests, anti-patterns)
- [x] Strip Trellis-template content from thinking guides
- [x] Correct 401 code to `UNAUTHORIZED` (was wrongly listed as `UNAUTHENTICATED`)

## Acceptance Criteria

- [x] Specs contain concrete examples and anti-patterns from the repository
- [x] No placeholder text remains
- [x] Index files match the final spec files
- [x] Claims are backed by source files, tests, or project docs
