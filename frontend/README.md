# Doodle Dash — Frontend

The browser client for the **Real-Time Multiplayer Drawing & Guessing Game**.
One player gets a secret word and draws it live on a shared canvas; everyone else races to guess it.

**Stack:** React 18 · TypeScript · Vite 5 · Material UI **v6** · Axios · React Router 6 · HTML Canvas (Pointer Events) · native WebSocket

---

## Table of contents
1. [Features](#features)
2. [Prerequisites](#prerequisites)
3. [Quick start](#quick-start)
4. [Configuration](#configuration)
5. [Scripts](#scripts)
6. [How to play / test with several players](#how-to-play--test-with-several-players)
7. [Project structure](#project-structure)
8. [How it talks to the backend](#how-it-talks-to-the-backend)
9. [Production build & deployment](#production-build--deployment)
10. [Troubleshooting](#troubleshooting)
11. [Known limitations](#known-limitations)

---

## Features
- **Home:** create a room (2–8 players, 1–10 rounds), join by code, browse open rooms, resume a game you left.
- **Invite links:** `/room/ABC123` asks for a name and joins.
- **Lobby:** room code (copy code / copy invite link), live player list, ready status, start gating (min. 2 players, everyone ready), leave room.
- **Game screen:** round banner, circular countdown timer, the drawer's secret word, live scoreboard, guess feed + input.
- **Canvas:** mouse, touch and pen; 12 colours, brush size, eraser, clear. Only the drawer can draw.
- **Round result:** reveals the word and per-player points after each round.
- **Final leaderboard:** podium, ranking with ties, confetti for the winner.
- **Resilience:** automatic WebSocket reconnect with back-off, state resync, invalid-session recovery.
- **Responsive:** desktop side-panel layout; phones get the tools under the canvas.

## Prerequisites
| Tool | Version |
|---|---|
| Node.js | **18 or newer** (20 LTS recommended) |
| npm | 9+ (ships with Node) |
| Backend | The FastAPI backend **with the patch applied** (see below) |

> **Backend patch required.** The frontend relies on the `round_ended` WebSocket event and the
> secret-word-safe guess history added by `backend_patch.zip`. Without it the game still runs, but the
> round-result screen will never appear.

## Quick start

### 1. Start the backend
From your backend project (Python 3.12, MySQL 8 running, `.env` containing at least
`MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `DATABASE_URL`, and tables created via Alembic):

```bash
uvicorn app.main:app --reload --port 8000
```
Check it: <http://localhost:8002/health> → `{"status":"healthy",…}`, and
<http://localhost:8002/docs> for Swagger.

### 2. Start the frontend
```bash
cd frontend
npm install
cp .env.example .env        # Windows (cmd): copy .env.example .env
npm run dev
```
Open **<http://localhost:5173>**.

> The dev server is pinned to port **5173** (`strictPort`) because the backend's CORS list allows only
> `http://localhost:5173` and `http://127.0.0.1:5173`. If 5173 is busy, free it rather than changing the port.

## Configuration
Environment variables are read at build/start time from `frontend/.env`:

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8002` | Backend base URL — **no trailing slash and no `/api` prefix** (routes are `/rooms`, `/health`, …) |
| `VITE_WS_URL` | derived from `VITE_API_URL` (`http→ws`, `https→wss`) | Only set if the WebSocket lives on a different host/port |

After editing `.env`, restart `npm run dev`.

**Playing from another device on your network** (phone, second laptop):
1. Find your computer's LAN IP (e.g. `192.168.1.20`).
2. Run the backend with `--host 0.0.0.0`.
3. Set `VITE_API_URL=http://192.168.1.20:8000` and restart the frontend (it already listens on all interfaces).
4. Add `http://192.168.1.20:5173` to `allow_origins` in the backend's `app/main.py`.
5. Open `http://192.168.1.20:5173` on the other device.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload on port 5173 |
| `npm run build` | Type-check (`tsc -b`) then production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript check only |

## How to play / test with several players
Each **browser tab is its own player** (identity is kept in `sessionStorage`), so you can test alone:

1. Tab 1: enter a name → **Create & enter**. Copy the **Invite link** in the lobby.
2. Tab 2 (or an incognito window): paste the link, enter another name, **Join**.
3. Both players press **Ready up**, then anyone presses **Start game**.
4. The drawer sees the word and draws; the other tab guesses. Correct guess = 100 points.
5. The drawer can **End round** early (it glows when everyone has guessed). Otherwise the 90-second timer ends it.
6. After the last round the final leaderboard appears.

Refreshing a tab reconnects you to the same seat. Closing the tab forgets the seat (the player stays in the
database but this browser can no longer control it).

## Project structure
```
frontend/
├─ index.html              fonts (Fredoka, Nunito), favicon, mount point
├─ vite.config.ts          React plugin, port 5173
├─ .env.example            VITE_API_URL / VITE_WS_URL
└─ src/
   ├─ main.tsx             providers: Theme, Toast, Router
   ├─ App.tsx              routes: "/" and "/room/:code"
   ├─ theme.ts             "Doodle Dash" design tokens + MUI v6 theme
   ├─ index.css            background, keyframe animations
   ├─ config.ts            API/WS URLs and game limits (mirrors backend constants)
   ├─ session.ts           per-room player session in sessionStorage
   ├─ api/
   │  ├─ client.ts         axios instance, error → message helper, X-Session-Token header
   │  ├─ rooms.ts          one typed function per REST endpoint
   │  └─ types.ts          DTOs matching the backend Pydantic schemas
   ├─ game/
   │  ├─ messages.ts       WebSocket protocol types (server → client, client → server)
   │  ├─ reducer.ts        pure game-state reducer
   │  └─ GameContext.tsx   socket lifecycle, reconnect, resync, actions, canvas event bus
   ├─ pages/
   │  ├─ HomePage.tsx      create / join / open rooms / resume
   │  └─ RoomPage.tsx      join prompt → lobby → game → final results
   └─ components/
      ├─ Lobby, PlayerList, PlayerAvatar
      ├─ GameRoom (round banner), DrawingCanvas (canvas + tool panel)
      ├─ GuessPanel, Scoreboard, TimerRing
      ├─ RoundResultDialog, FinalLeaderboard
      └─ Layout, Logo, ConnectionBadge, ToastProvider, EraserIcon
```

## How it talks to the backend

### REST (Axios) — all paths at the backend root
| Action | Request |
|---|---|
| List rooms | `GET /rooms` |
| Create room | `POST /rooms` `{max_players, total_rounds}` |
| Join | `POST /rooms/{code}/join` `{display_name}` → returns `id` and `session_token` |
| Room state (resync) | `GET /rooms/{code}/game-state` |
| Ready / Leave / Start | `PATCH /rooms/{code}/ready` · `DELETE /rooms/{code}/players/me` · `POST /rooms/{code}/start` |
| Guess | `POST /rooms/{code}/rounds/{round_id}/guesses` `{guess_text}` |
| End round (drawer) | `POST /rooms/{code}/rounds/{round_id}/finish` |
| Leaderboard / results | `GET /rooms/{code}/leaderboard` · `GET /rooms/{code}/results` |

Protected calls send the header `X-Session-Token: <token>`.

### WebSocket — `ws://localhost:8000/ws/rooms/{code}?session_token=<token>`
Server → client: `player_joined`, `player_connected`, `player_disconnected`, `player_ready`, `player_left`,
`game_started`, `round_started`, `secret_word` *(drawer only)*, `round_timer`, `round_ended`,
`game_completed`, `guess_submitted`, `correct_guess`, `draw`, `clear_canvas`, `error`.

Client → server (drawer only; anything else is rejected):
```jsonc
{ "type": "draw", "points": [{"x": 0.12, "y": 0.40}, …], "color": "#FF5A5F", "line_width": 8 }
{ "type": "clear_canvas" }
```
- Strokes are **batches of normalised (0..1) points**, never images; every screen size rebuilds the same picture.
- ≤ 40 points per message (server limit 200), width 1–50, colour `#RRGGBB`. The eraser is a white stroke.
- The canvas is a fixed 1000×625 logical surface scaled with CSS. All clients must run the same build.
- Your own strokes are painted locally and the server's echo of them is ignored.

### Reconnect behaviour
Socket closes → retry after 1 s, 2 s, 4 s, 8 s, then every 10 s → on success the client re-fetches game state
over REST. Close code `1008` (bad token / room gone) clears the session and shows the join screen.

## Production build & deployment
```bash
npm run build          # outputs static files to dist/
```
- Set `VITE_API_URL` (and `VITE_WS_URL` if needed) **before** building — they are baked into the bundle.
  Use `https://` / `wss://` in production.
- Serve `dist/` from any static host (nginx, Netlify, Vercel, S3+CloudFront…).
- **SPA fallback is required:** unknown paths must return `index.html`, otherwise `/room/ABC123` links 404.
  nginx example: `location / { try_files $uri /index.html; }`
- Add your production origin to `allow_origins` in the backend's CORS middleware.
- If you reverse-proxy the backend, make sure it forwards WebSocket upgrades (`Upgrade` / `Connection` headers).

## Troubleshooting
| Symptom | Cause / fix |
|---|---|
| "Cannot reach the game server" | Backend not running, or `VITE_API_URL` wrong. Test `<API_URL>/health` in the browser. |
| Browser console: CORS error | Page origin isn't in the backend's `allow_origins`. Use exactly `http://localhost:5173`, or add your origin. |
| `Port 5173 is already in use` | Another dev server is running. Stop it (the port is fixed on purpose for CORS). |
| Badge stays on "Connecting… / Reconnecting…" | WebSocket blocked: wrong `VITE_WS_URL`, proxy not forwarding upgrades, or backend down. |
| Round result popup never shows | Backend patch (`round_ended` event) not applied. |
| Drawing looks squashed / offset between tabs | A tab is running an old build. Hard-refresh **all** tabs after updating. |
| "Your seat in this room is gone" | The server no longer knows your session (room/DB reset). Join again if the game is still in the lobby. |
| Fonts look different | Fredoka/Nunito load from Google Fonts; offline it falls back to system fonts. Nothing breaks. |
| `/health/database` returns 500 | Apply the backend patch (fixes `settings.mysql_database`). |
| Changed `.env` but nothing happened | Restart `npm run dev`; Vite reads env only at start. |

## Known limitations
- **No stroke replay:** a guesser who refreshes or joins mid-round sees only strokes drawn *after* they reconnect
  (the backend doesn't store drawing data, by design). The drawer's own canvas is kept.
- **Flat scoring:** the backend awards 100 points per correct guess regardless of time or round number.
- **Next round starts immediately:** the round-result popup overlays the already-running next round (it auto-closes after 6 s).
- **Leaving mid-game** isn't supported by the backend (only while in the lobby); a player who goes away is shown as disconnected.
- Frontend automated tests are not included; the reducer is pure and easy to unit-test (e.g. with Vitest) if you want to add them.