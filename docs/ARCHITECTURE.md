# Architecture

PlayOware keeps the rules in one place: `src/engine/oware`. React, the AI, and the match service all call that engine. None of them decide whether a move is legal.

## How a computer move travels

```text
Player
  → pit index
  → LocalGameSession
  → OwareGame
  → next state
```

The screen animates the result. It does not own the board. A game against the computer stays in `sessionStorage` on this device.

## How an online move travels

```text
Player
  → pit, expected version, client move id
  → WebSocket process, or POST /api/matches/:id/moves
  → lock the match row
  → replay stored pits with OwareGame.fromHistory
  → OwareGame.makeMove
  → commit, then NOTIFY
  → snapshot to both players
```

The client never sends a board, a score, a turn, or a winner. The same `clientMoveId` returns the first committed result. A stale version changes nothing. An older snapshot is ignored, including one that arrives while a sow is still drawing. The hand replays a move the server has already accepted. When the hand finishes, or when the response was lost and the board refetches, the pits are that committed snapshot. Animation progress does not advance the version.

`npm run dev` starts Next.js on port 3000 and `src/server/ws.ts` on port 3001, listening on all interfaces. In development the browser connects to `ws://<page host>:3001`. In production the socket is on the same host as the site. Postgres `LISTEN/NOTIFY` on `playoware_match` carries the match id to that process. That listener needs a session connection. A transaction pooler does not deliver it. `Dockerfile.vercel` runs the site and the socket in one process so the image can deploy on Vercel. The database stays outside the image. While the socket is down, the match screen polls `GET /api/matches/:id` every 2 seconds.

## What is stored

A finished game is a list of pits plus, when the moves themselves do not end the game, the ending command. Online matches write one `Game` row when the engine says the match is over (`mode: "online"`, `clientId` equal to the match id). Incomplete matches stay in `Match` and `MatchMove`.

Guests are `User` rows. The cookie holds a random session token. The `Session` table stores its SHA-256 hash.

## What is deliberately absent

Passwords, clocks and ratings for online games, chat, tournaments, clubs, payments, and an LLM coach are not implemented. The AI is minimax with alpha-beta pruning and stays on this device. Review labels are the gap between the played move and that search. An explanation model, if one is added later, may describe those numbers. It must not decide legality.

