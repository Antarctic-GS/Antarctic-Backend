# Antarctic Backend

This folder is the live backend runtime for Antarctic Games.

What it owns:

- `apps.js` in this folder
- Discord bot sidecars and Discord-facing APIs
- AI chat APIs backed by Ollama
- Scramjet proxy APIs plus the Wisp websocket transport
- link-check analysis used by the Discord tooling
- proxy-runtime sync tooling for the separate static frontend

What it no longer owns:

- frontend HTML/CSS/JS hosting
- hosted games
- hosted SWF launchers
- backend-hosted game thumbnails
- Monochrome service files

Run locally:

```bash
cd palladium-backend
./start.sh
```

`./start.sh` will create `config/palladium.env` from the example file on first run and bootstrap runtime dependencies with `npm ci --omit=dev` if `node_modules` is missing or incomplete.

Production target:

- point `api.sethpang.com` at this backend
- keep `config/palladium.env` on the server
- host the frontend from a static platform separately

Important routes:

- `GET /health`
- `GET /api/config/public`
- `GET /api/proxy/health`
- `GET /api/proxy/fetch?url=...`
- `POST /api/ai/chat`
- `GET /api/discord/widget`
- `GET /link-check?url=...`
- websocket upgrades on `/wisp/`

Docs:

- user guide: [docs/user-guide.md](docs/user-guide.md)
- agent guide: [docs/agent-guide.md](docs/agent-guide.md)
