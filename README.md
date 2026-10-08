# PlayOware

PlayOware is a way to play Oware on this device: against another person sitting with you, or against the computer. The board is a 3D wooden slab. When a game ends, you can step back through the moves.

The rules live in the engine. The screen only shows what the engine already decided.

## How to play

Open the site and choose a game.

- **Same device.** Play a Friend asks for two names. You pass the device. The board turns toward the person whose turn it is.
- **Against the computer.** Play AI offers beginner, easy, medium, and hard. The computer moves on its own turn.
- **A quick game.** Play Oware on the home page starts a same-device game against Guest, using your name if the site already knows one.
- **Resume.** An unfinished game stays in this browser. Continue game on the home page returns to it. It is not stored for another device.

A finished game can be reviewed from its result screen. If the database is running, it also appears under History.

## Rules in short

The full rules are in [docs/OWARE_RULES.md](docs/OWARE_RULES.md).

- Twelve pits, two rows of six. Four seeds in each pit at the start.
- Lift a pit on your side and sow one seed at a time, anti-clockwise.
- If the last seed lands in a house that already had seeds, pick that house up and keep sowing.
- The hand stops when the last seed lands in an empty house.
- A house that reaches exactly four is captured. The first player to capture 25 seeds wins.
- If your opponent’s row is empty, you must feed them when you can.

## Stack

- [Next.js](https://nextjs.org) App Router, React, and TypeScript
- Tailwind CSS
- Three.js, through React Three Fiber, for the board
- The rules engine in `src/engine/oware`
- Prisma and PostgreSQL for finished games and the anonymous profile

An in-progress game is kept in `sessionStorage`. The database is only asked for finished games. There is no password. The first request that needs a profile creates one and stores its id in an httpOnly cookie.

## Setup

You need Node.js and Docker.

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma migrate dev
npm run dev
```

Postgres is published on port **5434**. The app is at [http://localhost:3000](http://localhost:3000).

`npx prisma migrate dev` applies the schema in `prisma/migrations`. If Postgres is not running, you can still play. History and profile will say the database is unreachable, and finished games stay reviewable on this device from the result screen.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm test` | Run the Vitest suite |
| `npm run lint` | Run ESLint |
| `npm run build` | Production build |

## Where things live

| Path | Role |
| --- | --- |
| `src/engine/oware` | Rules: sowing, capture, feeding, and the end of the game |
| `src/game` | The 3D board and how a move is drawn |
| `src/components/game` | The play screen and the review screen |
| `src/app/page.tsx` | Landing page |
| `src/app/learn/page.tsx` | The rules, written for a player |
| `docs/ARCHITECTURE.md` | How a move travels from the screen to the engine |
| `docs/OWARE_RULES.md` | The rules the engine is meant to follow |

## What this version does not include

Matchmaking, accounts with passwords, puzzles, and watching other people’s games are not part of this version. Play a Friend means two people on one device.
