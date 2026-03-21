# Agent Guide

Scope:

- Keep this backend focused on Discord, AI, proxy, and link-check responsibilities.
- Do not reintroduce frontend hosting, game hosting, thumbnail hosting, or Monochrome coupling here.

When changing the backend:

1. Update `apps.js`, tests, and docs together so the public contract stays explicit.
2. Keep `/api/config/public` aligned with what the static frontend actually consumes.
3. Prefer compatibility-preserving changes for existing env vars unless the user explicitly asks for breaking renames.
4. End every task with `npm run verify`.

Regression expectations:

- `/health` advertises only the live backend features.
- `/api/config/public` exposes proxy, AI, and Discord metadata without legacy games/assets fields.
- legacy backend-hosted game and image routes remain absent.
