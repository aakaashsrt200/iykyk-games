# Design: WebSocket Authoritative Backend

**Date:** 2026-04-07  
**Status:** Approved

## Problem

All game logic and database writes currently originate from the frontend via direct Supabase calls. This is a security and correctness risk: any client can manipulate game state, there is no single source of truth, and the Supabase service-role key cannot be safely exposed to the browser.

## Goal

- Move all game logic and all Supabase writes to the FastAPI backend.
- Replace frontend polling + direct Supabase calls with a WebSocket connection per player per room.
- Frontend becomes a pure renderer — zero Supabase knowledge.
- Backend is the authoritative source of truth for all game state.

---

## Architecture

```
Browser (Vercel - frontend only)
  │
  ├─ REST  POST /api/rooms            → create room
  ├─ REST  POST /api/rooms/{code}/join → join room
  │
  └─ WebSocket  ws://<backend>/ws/{code}/{player_token}
        ↕ JSON messages (actions → server, state ← server)

FastAPI (Railway - persistent server)
  ├─ ConnectionManager   in-memory: room_id → [WebSocket]
  ├─ RoomService         Supabase reads/writes (service role key only)
  ├─ BlackjackService    all Blackjack game logic (ported from JS)
  ├─ JudgementService    all Judgement game logic (ported from JS)
  └─ TimerService        asyncio background tasks per room (replaces client-side enforcer)

Supabase
  rooms + players tables (schema unchanged)
  Supabase anon key is NEVER sent to the browser.
```

---

## Backend Changes

### New files

| File | Purpose |
|------|---------|
| `backend/app/core/supabase_client.py` | Supabase Python client singleton (service role key) |
| `backend/app/core/connection_manager.py` | In-memory WebSocket registry per room |
| `backend/app/services/room_service.py` | All Supabase room/player CRUD |
| `backend/app/services/blackjack_service.py` | Blackjack state machine (pure functions) |
| `backend/app/services/judgement_service.py` | Judgement state machine (pure functions) |
| `backend/app/services/timer_service.py` | asyncio-based per-room timer enforcement |
| `backend/app/api/routes/rooms.py` | REST: create room, join room |
| `backend/app/api/routes/ws.py` | WebSocket endpoint |

### Modified files

| File | Change |
|------|--------|
| `backend/app/main.py` | Register new routers |
| `backend/app/core/config.py` | Add `supabase_url`, `supabase_service_role_key` settings |
| `backend/requirements.txt` | Add `supabase`, `websockets` |

### Config additions (`.env`)
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## REST API

### POST /api/rooms
Create a new room and add the creator as host.

**Request body:**
```json
{ "name": "Alice", "game_type": "blackjack" }
```

**Response:**
```json
{ "room_code": "golden-tiger-42", "player_token": "<uuid>", "room_id": "<uuid>" }
```

Server generates `room_code` and `player_token` (not the client).

### POST /api/rooms/{code}/join
Join an existing room.

**Request body:**
```json
{ "name": "Bob" }
```

**Response:**
```json
{ "room_code": "golden-tiger-42", "player_token": "<uuid>", "room_id": "<uuid>", "seat": 2 }
```

**Validation performed by server:**
- Room exists and is in `waiting` status
- Room is not full (< max_players)
- Game type matches (for Judgement rooms)

---

## WebSocket Protocol

### Connection

```
ws://<backend>/ws/{room_code}/{player_token}
```

On connect, server immediately broadcasts full state to all room members.

### Client → Server (actions)

All messages are JSON with a `type` field.

**Lobby:**
```json
{ "type": "start_game" }
{ "type": "leave_room" }
{ "type": "close_room" }
```

**Blackjack:**
```json
{ "type": "place_bet", "amount": 100 }
{ "type": "deal" }
{ "type": "hit" }
{ "type": "stand" }
{ "type": "double_down" }
{ "type": "new_round" }
```

**Judgement:**
```json
{ "type": "place_bid", "bid": 2 }
{ "type": "play_card", "card": { "suit": "hearts", "rank": "A" } }
```

### Server → Client (state)

**Full state broadcast** (sent after every state change, to all connections in room):
```json
{
  "type": "state",
  "room": {
    "id": "<uuid>",
    "code": "golden-tiger-42",
    "status": "waiting | playing | closed",
    "game_type": "blackjack | judgement",
    "game_state": { ... }
  },
  "players": [
    {
      "id": "<uuid>",
      "name": "Alice",
      "seat": 1,
      "is_host": true,
      "balance": 1000,
      "player_token": "<uuid>",
      "status": "active"
    }
  ]
}
```

**Error (sent only to sender):**
```json
{ "type": "error", "message": "Not your turn." }
```

**Room closed (sent to all):**
```json
{ "type": "room_closed" }
```

---

## Game Logic Migration

### Blackjack (from `frontend/src/hooks/useRoom.js` + `frontend/src/lib/deck.js`)

All logic moves to `BlackjackService` as pure functions:

| Action | Logic |
|--------|-------|
| `start_game` | Assign seats, initialize betting phase |
| `place_bet` | Update seat bet, mark `bet_placed` |
| `deal` | Build 6-deck shoe, deal 2 cards per betting seat + dealer (one hidden), detect blackjacks, advance to first active seat |
| `hit` | Pop card from deck, check bust/21, advance turn or move to dealer phase |
| `stand` | Mark seat as stand, advance turn or move to dealer phase |
| `double_down` | Double bet, pop one card, advance turn |
| `new_round` | Reset all seats to betting phase, increment round counter |
| dealer phase | Draw until score ≥ 17, reveal hidden card, compute results, update player balances in DB |

### Judgement (from `frontend/src/hooks/useJudgementRoom.js` + `frontend/src/lib/judgement.js`)

All logic moves to `JudgementService` as pure functions:

| Action | Logic |
|--------|-------|
| `start_game` | Build initial game state, deal first round hands |
| `place_bid` | Validate dealer restriction, advance bidding seat, transition to playing when dealer bids |
| `play_card` | Validate trump/led-suit rules, append to trick, detect trick completion (winner), detect round completion (scoring) |
| `advance_trick` | Clear completed trick, set trick winner as active seat |
| `start_next_round` | Rotate dealer, deal new hands, carry scores, handle game-over |

### Timer Enforcement (moved from client to server)

The current client-side enforcer (lowest non-active seat enforces) is replaced by a **server-side asyncio task** per room:

- `TimerService` maintains one `asyncio.Task` per active room.
- On each tick (1 s), checks `timer_start` against `TIMER_MS`.
- On expiry: applies default bid (0, or 1 if forbidden) or plays first valid card.
- Also handles trick pause (`TRICK_PAUSE_MS`) and round result pause (`ROUND_PAUSE_MS`).
- Task is cancelled when room closes or all players disconnect.

This eliminates the distributed enforcer race condition that existed client-side.

---

## ConnectionManager

```python
class ConnectionManager:
    # room_id -> set of (websocket, player_id) tuples
    
    async def connect(websocket, room_id, player_id)
    async def disconnect(websocket, room_id)
    async def broadcast(room_id, message: dict)       # to all in room
    async def send(websocket, message: dict)          # to one connection
```

On disconnect: player is NOT immediately marked as left (network blip). If they reconnect within a grace period (30 s), they resume. If the room has no connections remaining for 30 s, the room is closed.

---

## Frontend Changes

### Files deleted
- `frontend/src/lib/supabase.js`

### New files
- `frontend/src/lib/api.js` — `createRoom(name, gameType)`, `joinRoom(code, name)` (HTTP)
- `frontend/src/lib/ws.js` — `RoomSocket` class with connect/disconnect/send/reconnect logic

### Modified files

| File | Change |
|------|--------|
| `frontend/src/hooks/useRoom.js` | Replace all Supabase calls + polling with `RoomSocket`. State is set from incoming `state` messages. Actions call `socket.send({type: ...})`. |
| `frontend/src/hooks/useJudgementRoom.js` | Same as above for Judgement actions |
| `frontend/src/components/rooms/RoomsIndex.jsx` | Replace Supabase create/join with `api.js` calls |
| `frontend/src/components/rooms/JudgementRooms.jsx` | Same |
| `frontend/src/components/rooms/RoomPage.jsx` | Remove Supabase import; `JoinViaLink` uses `api.js` |
| `frontend/src/components/rooms/JudgementRoomPage.jsx` | Same |
| `.env.template` | Remove `VITE_SUPABASE_*`; add `VITE_WS_URL` |

### `RoomSocket` (ws.js)

```js
class RoomSocket {
  constructor(code, playerToken, onMessage, onClose)
  connect()         // opens WS, sets up onmessage/onclose handlers
  send(action)      // JSON.stringify and send
  disconnect()      // close WS
  // Auto-reconnect on unexpected close (up to 5 attempts, exponential backoff)
}
```

### Hook interface (unchanged to components)

`useRoom` and `useJudgementRoom` keep the same return shape so zero component changes are needed beyond removing direct Supabase imports.

---

## Deployment Changes

### Backend — Railway

Railway supports persistent WebSocket connections on long-lived containers.

New files:
- `railway.toml` — service config (build command, start command, port)

Backend environment variables on Railway:
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
ALLOWED_ORIGINS=https://<frontend>.vercel.app
```

### Frontend — Vercel (unchanged platform, updated env)

Remove:
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_SERVICE_ROLE_KEY
```

Add:
```
VITE_API_URL=https://<backend>.railway.app
VITE_WS_URL=wss://<backend>.railway.app
```

### docker-compose.yml

Updated to run only the backend service (frontend is Vercel-deployed, not Docker).

---

## Error Handling

- Invalid action type → `error` message to sender, no state change
- Action by wrong player (not their turn) → `error` message, no state change
- Supabase write failure → log server-side, `error` message to room, state not updated
- WebSocket connect with unknown room code or invalid token → close with 4004
- WebSocket connect to closed room → close with 4003

---

## Testing Strategy

- `BlackjackService` and `JudgementService` are pure functions — unit test all state transitions
- `RoomService` tested against a real Supabase test project (not mocked)
- WebSocket integration test: connect two clients to a room, assert state broadcasts
- Frontend: existing component behaviour unchanged (hook interface is preserved)
