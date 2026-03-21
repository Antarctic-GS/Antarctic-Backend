# User Guide

This backend is the API side of Antarctic Games. It is meant to run behind `api.sethpang.com` while the website itself is hosted statically elsewhere.

Daily use:

1. Update `config/palladium.env` with your host, port, Ollama settings, Discord tokens, and any proxy base override.
2. Run `npm install` if dependencies are missing.
3. Start the service with `./start.sh` or `npm start`.
4. Verify the runtime with `GET /health` and `GET /api/proxy/health`.

Supported backend features:

- Discord widget aggregation and Discord bot sidecars
- AI chat requests through Ollama at `POST /api/ai/chat`
- Scramjet proxy metadata and fetch endpoints
- Wisp websocket transport at `/wisp/`
- URL/link analysis for Discord flows at `/link-check`

Not supported here anymore:

- serving the frontend shell
- serving games or SWF files
- serving game thumbnails

Before deploying:

1. Run `npm run verify`.
2. Confirm `/api/config/public` returns the expected proxy, AI, and Discord settings.
3. Confirm the static frontend is pointed at this backend base URL.
