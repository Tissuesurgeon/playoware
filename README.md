# PlayOware

PlayOware is a way to play Oware online against another person, or on this device against the computer. The board is a 3D wooden slab. When a game ends, you can step back through the moves.

The rules live in the engine. The screen only shows what the engine already decided. An online match is decided by the server, which calls the same engine.

## How to play

Open the site and choose a game.

- **Quick Match.** The site looks for another player who is also waiting. You each play on your own device.
- **Play a friend.** You get a private link. The other person opens it in their own browser.
- **Against the computer.** Play AI offers beginner, easy, medium, and hard. That game stays on this device.
- **Rejoin.** An unfinished online match stays on the server. Rejoin on the home page returns to it. An unfinished computer game stays in this browser.

A finished game can be reviewed from its result screen. If the database is running, it also appears under History.

## Rules in short

The full rules are in [docs/OWARE_RULES.md](docs/OWARE_RULES.md).

- Twelve pits, two rows of six. Four seeds in each pit at the start.
- Lift a pit on your side and sow one seed at a time, anti-clockwise.
- If the last seed lands in a house that already had seeds, pick that house up and keep sowing.
- The hand stops when the last seed lands in an empty house.
- A house that reaches exactly four is captured. A round ends when eight or fewer seeds are left, then the board is set with four seeds again.
- The player who captured more houses takes that many from the opponent. The match ends when one player owns all six of the other’s houses.
- If your opponent’s houses are empty, you must feed them when you can.

## Stack

- [Next.js](https://nextjs.org) App Router, React, and TypeScript
- Tailwind CSS
- Three.js, through React Three Fiber, for the board
- The rules engine in `src/engine/oware`
- Prisma and PostgreSQL for guests, live matches, and finished games
- A second Node process for WebSockets

There is no password. The first request that needs a profile creates a guest and stores a session token in an httpOnly cookie. The database stores a hash of that token. Losing the cookie starts a new guest.

## Setup

You need Node.js and Docker.

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma migrate deploy
npm run dev
```

Postgres is published on port **5434**. The site is at [http://127.0.0.1:3000](http://127.0.0.1:3000). `npm run dev` also starts the realtime process on port **3001**.

To try a match, open the site in two browsers (or a normal window and a private window). Start Quick Match in both. Cookies are not shared between them, so they are two guests.

`RECONNECT_GRACE_MS` (default 60 seconds) is how long a dropped connection can last before the other player is awarded the game. `INVITE_TTL_MS` is how long a friend link lasts. `QUEUE_TTL_MS` is how long a search stays in the queue.

## Deploy on Vercel

The repo includes `Dockerfile.vercel`. Vercel detects that file, builds the image, and sends every request — including the match socket — to it. Push the project, or run `vercel deploy`, with a hosted Postgres database.

In the Vercel project settings, set `DATABASE_URL` to the Supabase direct URL or the session pooler URL. Both use port 5432 and need `sslmode=require`. The direct host is IPv6-only unless the project has the IPv4 add-on; on an IPv4 network, use the session pooler string from the Supabase connect dialog. Leave port 6543 unused, because that pooler does not deliver `LISTEN/NOTIFY`. Leave `NEXT_PUBLIC_WS_URL` unset so the board uses the site’s own address. The container applies migrations when it starts.

A live socket stays open until Vercel’s function time limit, then the board connects again and loads the match from the database. On the Hobby plan that limit is 5 minutes. On Pro it can be raised to about 13 minutes. An idle deployment sleeps after 5 minutes; open matches remain in Postgres.

You can try the same image locally:

```bash
docker build -f Dockerfile.vercel -t playoware .
docker run --rm -p 3000:3000 -e DATABASE_URL="postgresql://playoware:playoware@host.docker.internal:5434/playoware" playoware
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the site and the realtime process |
| `npm start` | Start the production site and the realtime process |
| `npm test` | Run the Vitest suite |
| `npm run lint` | Run ESLint |
| `npm run build` | Production build |

## Where things live

| Path | Role |
| --- | --- |
| `src/engine/oware` | Rules: sowing, capture, feeding, and the end of the game |
| `src/game` | The 3D board and how a move is drawn |
| `src/server` | Match authority, sessions, and the WebSocket process |
| `src/components/game` | The computer-game screen and the review screen |
| `src/components/online` | The live online board |
| `src/app/page.tsx` | Landing page |
| `src/app/learn/page.tsx` | The rules, written for a player |
| `docs/ARCHITECTURE.md` | How a move travels from the screen to the engine |
| `docs/OWARE_RULES.md` | The rules the engine is meant to follow |

## What this version does not include

Accounts with passwords, clocks on online games, ratings, puzzles, and watching other people’s games are not part of this version. A computer game still uses a five-minute clock on this device.
