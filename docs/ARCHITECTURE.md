# Architecture

PlayOware keeps the rules in one place: `src/engine/oware`. React, the AI, and the database all call that engine. None of them decide whether a move is legal.

## How a move travels

```text
Player
  → move command (pit index)
  → LocalGameSession
  → OwareGame
  → next state
```

The screen animates the result. It does not own the board. `LocalGameSession` is the only object the game screen calls for `submitMove`, `resign`, and `offerDraw`.

An online game can replace the session without replacing the engine:

```text
Player A
  → WebSocket
  → game server
  → OwareGame
  → WebSocket
  → Player B
```

The server must accept the same command — a pit, a resignation, an agreed draw, or a timeout — and reject anything the engine rejects. Clients never send a winner or a score that the server trusts.

## What is stored

A finished game is a list of pits plus, when the moves themselves do not end the game, the ending command. `concludeGame` replays that list from the initial position and stores the engine’s result.

In-progress games stay in `sessionStorage` on the device that started them. The database is only for finished games, the anonymous profile, and the history computed from those games.

There is no password. The first request to `/api/me` creates a user and stores the id in an httpOnly cookie.

## What is deliberately absent

Matchmaking, sockets, chat, tournaments, clubs, payments, and an LLM coach are not implemented. The AI is minimax with alpha-beta pruning. Review labels are the gap between the played move and that search. An explanation model, if one is added later, may describe those numbers. It must not decide legality.
