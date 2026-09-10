# B Postman

Local Postman-style API client with a Bupa Arabia look. Collections, environments, and history are saved as JSON files on disk — no database.

## Quick start

**Easiest (Windows):** double‑click `Start B Postman.bat`

It installs dependencies if needed, builds the UI once, starts the app, and opens **http://localhost:3847**.

Or from a terminal:

```bash
cd D:\API-Messenger
npm install
npm run build
npm start
```

For development (hot reload):

```bash
npm run dev
```

Then open **http://localhost:5173**

- App (production / .bat): `3847`
- Dev UI (Vite): `5173`
- Data folder: `D:\API-Messenger\data`

## Features

- **Collections** — folders & requests stored as `data/collections/<id>.json`
- **Request builder** — method, URL, query params, headers, body (raw / urlencoded / form-data), auth (Bearer / Basic / API key)
- **Environments** — `{{variables}}` in URL, headers, body, and auth (`data/environments/`)
- **Send via proxy** — avoids browser CORS; timing, size, status, headers, body
- **History** — last 200 calls in `data/history.json`
- **Import / Export** — Postman collection JSON or native B Postman files
- **cURL view** — full command for the request you sent
- **Sidebar** — collapse/expand and drag to resize

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Run UI + local server together |
| `npm run server` | API/proxy only (port 3847) |
| `npm run client` | Vite only |
| `npm run build` | Production UI build |
| `npm start` | Serve built UI + API from port 3847 |
| `npm run package:share` | Build a portable zip in `share/` to copy to other PCs |

## Share with another PC (Node required)

1. On this machine, double‑click **`Make Share Package.bat`** (or run `npm run package:share`).
2. Send **`share\B-Postman-portable.zip`** (or the `share\B-Postman` folder).
3. On the other PC: unzip → double‑click **`Start B Postman.bat`**.

First run there installs only runtime packages (`npm install --omit=dev`). Collections stay in that copy’s `data\` folder.

## Data layout

```text
data/
  collections/     # one JSON file per collection
  environments/    # one JSON file per environment
  history.json
  settings.json
```

Files are written atomically (temp file → rename) to reduce corruption risk.

## Notes

- Designed for **local use** on your machine.
- Sample “Getting Started” collection and “Local” environment are created on first run.
- Active environment is remembered in `settings.json`.
