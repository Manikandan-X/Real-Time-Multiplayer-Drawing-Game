# Real-Time Multiplayer Drawing & Guessing Game — Backend

A real-time multiplayer drawing and guessing game backend built with FastAPI, Python, SQLAlchemy, MySQL, and WebSockets.

Players can create or join game rooms, mark themselves ready, take turns drawing secret words, submit guesses, earn points, and view live leaderboards and final game results.

The backend provides REST APIs for game management and WebSockets for real-time drawing, player connection events, and round timer updates.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Getting Started](#getting-started)
7. [Environment Configuration](#environment-configuration)
8. [Docker Setup](#docker-setup)
9. [Database and Migrations](#database-and-migrations)
10. [API Documentation](#api-documentation)
11. [REST API Endpoints](#rest-api-endpoints)
12. [WebSocket Communication](#websocket-communication)
13. [Game Rules](#game-rules)
14. [CORS Configuration](#cors-configuration)
15. [Development Commands](#development-commands)
16. [Troubleshooting](#troubleshooting)
17. [Current Limitations](#current-limitations)
18. [Future Enhancements](#future-enhancements)

---

## Project Overview

The Real-Time Multiplayer Drawing & Guessing Game allows multiple players to participate in a shared game room.

One player becomes the drawer for each round. The drawer receives a secret word and draws it on a shared canvas without revealing the word. Other players attempt to guess the word.

The backend manages rooms, players, rounds, guesses, scores, timers, and game results.

### Game Workflow

1. A player creates a game room.
2. Other players join using the room code.
3. Players mark themselves as ready.
4. The host starts the game when the minimum player requirement is satisfied.
5. The backend selects a drawer and assigns a secret word.
6. The drawer draws using a WebSocket connection.
7. Other players submit guesses through REST APIs.
8. Correct guesses earn points.
9. The round ends automatically when its timer expires or when the drawer finishes the round.
10. The backend selects the next drawer and starts the next round.
11. After the final round, the game is marked completed.
12. Players can retrieve the leaderboard, round history, guess history, and final results.

---

## Features

### Room Management

* Create game rooms.
* Generate unique room codes.
* Retrieve the list of rooms.
* Retrieve room details using a room code.
* Configure the maximum number of players.
* Configure the total number of rounds.

### Player Management

* Join an existing room.
* Identify players using session tokens.
* Prevent duplicate display names within a room.
* Mark players as ready.
* Leave a game room.
* Track player connection status.
* Track player scores.

### Game Management

* Start games after validating the room and player readiness.
* Select a drawer for each round.
* Assign secret words.
* Rotate the drawer between rounds.
* Track round start and end times.
* Complete rounds automatically when the timer expires.
* Complete the game after the final round.

### Real-Time Communication

* Synchronize drawing events through WebSockets.
* Clear the shared canvas.
* Restrict drawing actions to the current drawer.
* Broadcast player connection and disconnection events.
* Send secret words privately to the drawer.
* Broadcast round timer updates.
* Restore timer state when a player reconnects.

### Guessing and Scoring

* Submit guesses for the current round.
* Validate guesses against the secret word.
* Award points for correct guesses.
* Prevent repeated correct guesses from awarding additional points to the same player in the same round.
* Store guess history.

### Leaderboard and Results

* Retrieve the live leaderboard.
* Calculate player rankings.
* Retrieve round history.
* Retrieve guesses for a particular round.
* Retrieve final game results after completion.

### Health Monitoring

* Check whether the API is running.
* Check whether the database connection is working.

---

## Technology Stack

| Technology     | Purpose                                 |
| -------------- | --------------------------------------- |
| Python 3.12    | Backend programming language            |
| FastAPI        | REST API and WebSocket framework        |
| SQLAlchemy 2.x | Database ORM                            |
| Alembic        | Database migrations                     |
| Pydantic       | Request validation and response schemas |
| MySQL 8        | Relational database                     |
| Uvicorn        | ASGI application server                 |
| Docker         | Application containerization            |
| Docker Compose | Backend and database orchestration      |
| WebSockets     | Real-time game communication            |
| Swagger UI     | Interactive API documentation           |
| Postman        | API development and testing             |

---

## Project Structure

The following represents the main application structure. Some supporting files may vary depending on the final implementation.

```text
backend/
│
├── app/
│   ├── core/
│   │   ├── config.py
│   │   └── constants.py
│   │
│   ├── db/
│   │   ├── base.py
│   │   ├── dependencies.py
│   │   └── session.py
│   │
│   ├── models/
│   │   ├── game_room.py
│   │   ├── player.py
│   │   ├── game_round.py
│   │   └── guess.py
│   │
│   ├── repositories/
│   │   ├── room_repository.py
│   │   ├── player_repository.py
│   │   ├── game_round_repository.py
│   │   └── guess_repository.py
│   │
│   ├── schemas/
│   │   ├── room.py
│   │   ├── player.py
│   │   ├── leaderboard.py
│   │   ├── game_state.py
│   │   ├── round_history.py
│   │   ├── guess_history.py
│   │   └── game_results.py
│   │
│   ├── services/
│   │   ├── room_service.py
│   │   ├── guess_service.py
│   │   ├── leaderboard_service.py
│   │   ├── game_results_service.py
│   │   ├── round_history_service.py
│   │   ├── guess_history_service.py
│   │   ├── connection_manager.py
│   │   └── round_timer_service.py
│   │
│   ├── routers/
│   │   ├── room.py
│   │   └── websocket.py
│   │
│   └── main.py
│
├── alembic/
│   └── versions/
│
├── alembic.ini
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env
├── .env.example
├── .gitignore
└── README.md
```

> This is a structural reference. Keep the actual filenames in your repository if they differ from this example.

---

## Prerequisites

Install the following tools before running the application:

* Python 3.12
* Docker Desktop
* Docker Compose
* Git (optional)
* VS Code (recommended)
* Postman (optional)
* MySQL Workbench (optional)

The recommended setup uses Docker for the backend and MySQL database. A separate local Python virtual environment is not required when running everything inside the configured containers.

---

## Getting Started

### 1. Clone the Repository

If the project is hosted in a Git repository:

```bash
git clone <repository-url>
```

Navigate to the backend directory:

```bash
cd backend
```

If you already have the project locally, open its backend directory directly.

### 2. Configure Environment Variables

Create a `.env` file in the backend root directory if one does not already exist.

Use the variable names and required values expected by `app/core/config.py`.

Typical configuration includes:

```env
APP_NAME=Real-Time Multiplayer Drawing Game API
APP_VERSION=1.0.0
DEBUG=False

MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=drawing_game_db
MYSQL_USER=<your_database_user>
MYSQL_PASSWORD=<your_database_password>
```

**Important:** This is an illustrative template. Check your existing `app/core/config.py` and Docker Compose file for the exact environment variable names and any additional required settings. Do not replace working configuration blindly.

When the backend runs inside Docker Compose, the database hostname is normally the MySQL service name, `mysql`, and the database port is `3306`.

When connecting to the database from the host machine using MySQL Workbench, use:

```text
Host: localhost
Port: 3308
Database: drawing_game_db
```

Use the database credentials configured in your `.env` and Docker Compose files.

Never commit `.env` files containing credentials to Git.

---

## Docker Setup

### 1. Build and Start the Services

Open a terminal in the backend directory:

```powershell
docker compose up -d --build
```

This builds the backend image and starts the configured services.

The current development configuration uses the following ports:

| Service         | Container              | Host Port |
| --------------- | ---------------------- | --------: |
| FastAPI backend | `drawing_game_backend` |      8002 |
| MySQL database  | `drawing_game_mysql`   |      3308 |

The MySQL data is stored in the persistent Docker volume:

```text
drawing_game_mysql_data
```

### 2. Check Running Containers

```powershell
docker compose ps
```

Confirm that the backend and database containers are running.

### 3. View Backend Logs

```powershell
docker compose logs -f backend
```

To stop following the logs, press `Ctrl+C`. This does not stop the containers.

### 4. View Database Logs

```powershell
docker compose logs -f mysql
```

### 5. Restart the Backend

```powershell
docker compose restart backend
```

### 6. Rebuild the Backend After Code Changes

```powershell
docker compose up -d --build backend
```

### 7. Stop the Services

```powershell
docker compose down
```

This stops and removes the Compose containers and network. The named MySQL data volume is preserved.

**Important:** Do not use `docker compose down -v` for routine shutdowns because the `-v` option can delete the database volume and its data.

---

## Database and Migrations

The backend uses MySQL and SQLAlchemy to persist game data.

### Database Tables

| Table         | Purpose                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| `game_rooms`  | Room codes, room status, player limits, and round configuration           |
| `players`     | Player identities, session tokens, readiness, connectivity, and scores    |
| `game_rounds` | Round numbers, drawer assignments, secret words, statuses, and timestamps |
| `guesses`     | Guess text, correctness, points awarded, and submission timestamps        |

### Apply Existing Migrations

If Alembic is configured inside the backend container, apply migrations using:

```powershell
docker compose exec backend alembic upgrade head
```

Check the current migration revision:

```powershell
docker compose exec backend alembic current
```

View migration history:

```powershell
docker compose exec backend alembic history
```

These commands assume the Alembic executable and configuration are available inside the backend container.

### Important Database Notes

* The project already has an Alembic migration history.
* Do not delete existing migration files to restart development.
* Do not recreate the database simply to apply a code change.
* Generate a new migration when a future change requires a schema modification.
* Review generated migrations before applying them.
* Keep database credentials out of source control.

For changes that modify SQLAlchemy models, create a migration using the project's configured Alembic environment and review it before running `upgrade head`.

---

## API Documentation

After starting the backend, open Swagger UI:

**Swagger UI:** `http://localhost:8002/docs`

Alternative OpenAPI schema:

`http://localhost:8002/openapi.json`

Swagger UI allows you to inspect request and response schemas and invoke the registered HTTP endpoints.

The WebSocket endpoint is not an ordinary HTTP operation and must be exercised with a WebSocket-capable client or the frontend.

---

## REST API Endpoints

The following endpoints are registered in the current application. Request bodies and response schemas are defined by the corresponding Pydantic models.

The exact required fields and response formats should be confirmed through Swagger UI.

### Health

| Method | Endpoint           | Purpose                     |
| ------ | ------------------ | --------------------------- |
| GET    | `/`                | API root and running status |
| GET    | `/health`          | Application health          |
| GET    | `/health/database` | Database connectivity check |

### Room Management

| Method | Endpoint                     | Purpose               |
| ------ | ---------------------------- | --------------------- |
| GET    | `/rooms`                     | List available rooms  |
| POST   | `/rooms`                     | Create a room         |
| GET    | `/rooms/{room_code}`         | Retrieve room details |
| GET    | `/rooms/{room_code}/players` | List room players     |

### Player Management

| Method | Endpoint                        | Purpose                          |
| ------ | ------------------------------- | -------------------------------- |
| POST   | `/rooms/{room_code}/join`       | Join a room                      |
| PATCH  | `/rooms/{room_code}/ready`      | Update the player's ready status |
| DELETE | `/rooms/{room_code}/players/me` | Leave a room                     |

### Game Management

| Method | Endpoint                                      | Purpose                  |
| ------ | --------------------------------------------- | ------------------------ |
| POST   | `/rooms/{room_code}/start`                    | Start a game             |
| POST   | `/rooms/{room_code}/rounds/{round_id}/finish` | Finish the current round |

### Guessing

| Method | Endpoint                                       | Purpose        |
| ------ | ---------------------------------------------- | -------------- |
| POST   | `/rooms/{room_code}/rounds/{round_id}/guesses` | Submit a guess |

### Leaderboard and Game State

| Method | Endpoint                         | Purpose                         |
| ------ | -------------------------------- | ------------------------------- |
| GET    | `/rooms/{room_code}/leaderboard` | Retrieve player rankings        |
| GET    | `/rooms/{room_code}/game-state`  | Retrieve the current game state |

### History and Results

| Method | Endpoint                                       | Purpose                      |
| ------ | ---------------------------------------------- | ---------------------------- |
| GET    | `/rooms/{room_code}/rounds`                    | Retrieve round history       |
| GET    | `/rooms/{room_code}/rounds/{round_id}/guesses` | Retrieve guesses for a round |
| GET    | `/rooms/{room_code}/results`                   | Retrieve final game results  |

### Example API Workflow

A typical game follows this sequence:

1. Create a room using `POST /rooms`.
2. Join the room using `POST /rooms/{room_code}/join`.
3. Have each player join and mark themselves ready.
4. Start the game using `POST /rooms/{room_code}/start`.
5. Establish a WebSocket connection for each player.
6. Send drawing events through the WebSocket.
7. Submit guesses using the guess endpoint.
8. Retrieve the leaderboard and current game state.
9. Finish rounds as appropriate.
10. Retrieve final results after the game is completed.

The session token returned when a player joins is required for operations that identify that player. Follow the exact request format shown in Swagger and the WebSocket section below.

---

## WebSocket Communication

The WebSocket endpoint is:

```text
ws://localhost:8002/ws/rooms/{room_code}?session_token={session_token}
```

For example:

```text
ws://localhost:8002/ws/rooms/ABC123?session_token=YOUR_SESSION_TOKEN
```

Replace the room code and token with the actual values returned by the API.

### Connection Requirements

The backend validates the room, session token, and player membership before accepting a connection.

A connected player may receive:

* Private secret-word information when that player is the current drawer.
* Current timer information.
* Player connection events.
* Drawing events from other players.
* Canvas-clear events.
* Round and game lifecycle events.
* Guess-result events.

The exact event names and payload structures should be taken from the WebSocket router and frontend implementation.

### Drawing Permissions

Only the player assigned as the current drawer may broadcast drawing actions.

The backend validates drawing payloads, including point coordinates and drawing properties. Drawing coordinates are normalized to the range `0` to `1`, allowing the frontend to scale them to different canvas sizes.

### Drawing Payload

The current WebSocket implementation supports drawing actions containing points, a color, and a line width, as well as a `clear_canvas` action.

A representative drawing payload has this shape:

```json
{
  "type": "draw",
  "points": [
    {
      "x": 0.25,
      "y": 0.35
    },
    {
      "x": 0.30,
      "y": 0.40
    }
  ],
  "color": "#000000",
  "line_width": 4
}
```

This example illustrates the expected data shape. Check the validation code for the exact accepted fields.

### Timer Behavior

Each round is configured for 90 seconds.

The backend sends timer updates through WebSockets. When the timer expires, the backend attempts to finish the round automatically and transition to the next round or complete the game.

When a player reconnects during an active round, the backend can resume timer processing and send the current timer state.

### WebSocket Security

Session tokens identify players, but they should be treated as sensitive credentials.

* Do not expose secret words to non-drawers.
* Do not log session tokens.
* Validate player authorization for every privileged game action.
* Restrict permitted WebSocket origins in production.
* Use `wss://` when deployed behind HTTPS.

CORS middleware for HTTP requests does not replace WebSocket origin validation.

---

## Game Rules

The current backend configuration defines the following defaults:

| Setting                          | Value      |
| -------------------------------- | ---------- |
| Minimum players per room         | 2          |
| Maximum players per room         | 8          |
| Default maximum players          | 8          |
| Default total rounds             | 3          |
| Minimum total rounds             | 1          |
| Maximum total rounds             | 10         |
| Round duration                   | 90 seconds |
| Points for a first correct guess | 100        |

### Room States

* `WAITING` — The game has not started.
* `IN_PROGRESS` — The game is active.
* `COMPLETED` — All rounds have finished.

### Round States

* `PENDING` — The round has not started.
* `IN_PROGRESS` — The round is active.
* `COMPLETED` — The round has finished.

### Scoring

A correct guess earns 100 points when it is the player's first correct guess in that round.

Incorrect guesses award zero points.

Repeated correct guesses from the same player in the same round do not award additional points.

The leaderboard ranks players by their accumulated scores.

---

## CORS Configuration

The backend configures FastAPI's `CORSMiddleware` to allow requests from the default Vite development origins:

```text
http://localhost:5173
http://127.0.0.1:5173
```

The middleware currently permits all HTTP methods and headers and allows credentials.

If the frontend runs on a different origin, update the configured origins in `app/main.py`.

For production deployment, replace development origins with the actual trusted frontend origins rather than allowing every origin.

Remember that HTTP CORS settings do not automatically restrict WebSocket connections.

---

## Development Commands

Run the following commands from the backend project directory.

### Start Services

```powershell
docker compose up -d --build
```

### Inspect Containers

```powershell
docker compose ps
```

### Follow Backend Logs

```powershell
docker compose logs -f backend
```

### Follow MySQL Logs

```powershell
docker compose logs -f mysql
```

### Restart Backend

```powershell
docker compose restart backend
```

### Rebuild Backend

```powershell
docker compose up -d --build backend
```

### Apply Database Migrations

```powershell
docker compose exec backend alembic upgrade head
```

### Check the Applied Migration

```powershell
docker compose exec backend alembic current
```

### Stop Services Without Deleting the Database Volume

```powershell
docker compose down
```

---

## Troubleshooting

### 1. Backend Is Not Starting

Check the container status:

```powershell
docker compose ps
```

Inspect the logs:

```powershell
docker compose logs --tail=100 backend
```

Check for missing environment variables, Python import errors, database connection failures, and configuration problems.

### 2. Database Connection Failed

Check the MySQL logs:

```powershell
docker compose logs --tail=100 mysql
```

Verify the database host and port.

When the backend runs inside Docker Compose, it should normally connect to the `mysql` service on port `3306`, not `localhost:3308`.

### 3. Port Already in Use

If port `8002` or `3308` is already occupied, identify the conflicting process or container before changing the port mapping.

If you change a host port, update the corresponding connection URL used by Swagger, the frontend, or MySQL Workbench as appropriate.

### 4. Frontend Cannot Access the API

Verify that:

* The backend is running.
* The frontend uses `http://localhost:8002` as its API base URL.
* The frontend origin is listed in `allow_origins`.
* The browser console and backend logs do not show request or connection errors.

### 5. WebSocket Connection Fails

Verify that:

* The room exists.
* The session token is valid.
* The player belongs to the room.
* The WebSocket URL includes the correct room code and token.
* The backend is running and reachable.
* The frontend uses the correct WebSocket scheme and host.

Use `ws://` for local development without TLS and `wss://` for secure deployments.

### 6. Database Schema Is Out of Date

Check the current Alembic revision:

```powershell
docker compose exec backend alembic current
```

If the project has unapplied migrations, review them and apply the appropriate upgrade.

Do not delete the database volume to fix a migration problem.

### 7. Timer Does Not Advance

Inspect the backend logs and confirm that the game is in progress and the current round has a valid start timestamp.

Because round timing and transitions depend on the backend's timer service, review its logs if the round does not finish as expected.

---

## Current Limitations

The current implementation is a development-stage backend. The following items should be reviewed before production deployment:

* Full REST API and WebSocket integration testing has not yet been completed.
* Simultaneous correct guesses and simultaneous round transitions need concurrency testing.
* WebSocket origin validation and production security configuration need review.
* Session-token expiration, revocation, and lifecycle management need review.
* Multiple backend instances would require shared coordination for WebSocket broadcasts and timers.
* Production deployment needs HTTPS/WSS, secrets management, monitoring, and operational logging.
* Frontend integration and multi-player end-to-end testing remain necessary.

These items are not claims that the corresponding features are absent; they identify areas requiring verification or additional hardening.

---

## Future Enhancements

Potential improvements include:

* Better reconnect handling.
* Configurable round durations.
* More comprehensive automated tests.
* Persistent event and game analytics.
* Redis-backed coordination for multi-instance deployments.
* Production deployment and monitoring.

---

