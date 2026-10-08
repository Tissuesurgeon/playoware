-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT 'Player',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ruleset" TEXT NOT NULL DEFAULT 'abapa',
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "endReason" TEXT NOT NULL,
    "winner" TEXT,
    "scoreP1" INTEGER NOT NULL,
    "scoreP2" INTEGER NOT NULL,
    "timeControlMs" INTEGER NOT NULL,
    "player1UserId" TEXT,
    "player2UserId" TEXT,
    "player1Name" TEXT NOT NULL,
    "player2Name" TEXT NOT NULL,
    "aiDifficulty" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameMove" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "moveNumber" INTEGER NOT NULL,
    "player" TEXT NOT NULL,
    "pit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameMove_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_clientId_key" ON "Game"("clientId");

-- CreateIndex
CREATE INDEX "Game_player1UserId_idx" ON "Game"("player1UserId");

-- CreateIndex
CREATE INDEX "Game_player2UserId_idx" ON "Game"("player2UserId");

-- CreateIndex
CREATE INDEX "GameMove_gameId_idx" ON "GameMove"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GameMove_gameId_moveNumber_key" ON "GameMove"("gameId", "moveNumber");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_player1UserId_fkey" FOREIGN KEY ("player1UserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_player2UserId_fkey" FOREIGN KEY ("player2UserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMove" ADD CONSTRAINT "GameMove_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
