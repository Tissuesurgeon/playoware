# Oware

PlayOware sows in the roaming way: the hand keeps going until the last seed falls in an empty house. Fours are captured. The match still ends when a player reaches 25 seeds.

Sources:

- [Oware Society, Nam-Nam](http://www.oware.org/nam_nam.asp) — continue sowing until the last seed lands in an empty house, and capture fours.
- [Oware Society, Abapa rules](http://www.oware.org/abapa.asp) — the duty to feed, and ending at 25 seeds.

The engine in `src/engine/oware` implements this document. If they disagree, the engine is wrong.

## Board

- 12 pits in two rows of 6. Stores are not used and are never sown into.
- 4 seeds in every pit at the start: 48 seeds in total.
- South is player 1 and owns pits `0–5`, left to right from South’s view.
- North is player 2 and owns pits `6–11`.
- Shown from South’s side, North’s row runs left to right as `11, 10, 9, 8, 7, 6`, so opposite pits face each other.

```text
North (player 2), screen left to right:  11  10   9   8   7   6
South (player 1), screen left to right:   0   1   2   3   4   5
```

Sowing order is increasing index, modulo 12:

```text
0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 0
```

That is anti-clockwise: along South’s row to the right, then along North’s row to the left.

## Players and turns

- Player 1 moves first in a new game.
- On each turn a player chooses one non-empty pit on their own side.
- The opponent’s pits, empty pits, and pits that break the feeding rule are illegal.
- An illegal choice does not change the board.

## Sowing

1. Lift every seed out of the chosen pit. That pit is now empty.
2. Drop one seed into each following pit, anti-clockwise, including the pit the seeds came from when the sow comes back around.
3. If the last seed lands in a house that already held seeds, lift every seed now in that house and keep sowing from the next house.
4. The move stops when the last seed lands in a house that was empty.

## Capture

A house is captured when a sown seed makes it hold exactly four.

- Four seeds made on the sower’s own side are captured at once, even in the middle of a handful. Sowing then continues with the seeds still in hand.
- Four seeds made on the opponent’s side in the middle of a handful are captured by the opponent.
- Four seeds made by the last seed of a handful are captured by the sower, including when that house is on the opponent’s side. That capture ends the move. Those four are not sown onward.

## Feeding

If the opponent’s row is empty at the start of your turn, you must play a move that places at least one seed on their side, if you have one.

- Moves that never reach their row are illegal while this duty applies.
- If you have no move that reaches their row, you capture every seed still on your own side and the game ends. This is starvation.
- Their row is already empty, so they collect nothing from the board in this ending.
- If it is your turn and your own row is empty, you have no move. The opponent then collects the seeds on their side and the game ends the same way.

## Game end and scoring

Seeds removed by capture are the only points scored during play. The board and both captured totals always add up to 48.

The game ends in the first of these ways that applies:

1. **Majority.** A player who has captured 25 or more seeds wins immediately. Seeds still on the board are not awarded.
2. **Repeated position.** If the same board, the same player to move, and the same captured totals occur again, the game ends before that repeated turn is played. Each player is awarded the seeds on their own side. The higher total wins. Equal totals draw.
3. **Starvation.** The player to move has no legal move, including no way to feed an empty opponent. Award board seeds as described under Feeding, then compare totals.
4. **Resignation** (PlayOware action). The resigning player loses. Captured totals stay as they are. Board seeds are not awarded.
5. **Agreed draw** (PlayOware action). The result is a draw. Captured totals stay as they are. Board seeds are not awarded.
6. **Timeout** (PlayOware clock). The player whose clock reaches zero loses. Captured totals stay as they are. Board seeds are not awarded.

After starvation or a repeated position, compare the totals once board seeds have been awarded:

- Higher total wins, even if that total is now 25 or more.
- `24–24` is a draw.
- Any other equal total is also a draw.

A new game starts at `0–0`. Reaching exactly 24 captured seeds does not end the game.

## Clocks

Clocks are a PlayOware layer on top of the board rules:

- Each player starts with 5 minutes and no increment.
- A player’s clock runs only on their turn.
- It does not run during sowing or capture animation.
- While the AI is choosing, only the AI’s clock runs.
- Flag fall is a loss, as above.

## Notation

The engine stores the pit that was played as an absolute index `0–11`.

The interface speaks in player-relative pits. Pit 1 is the player’s leftmost pit and pit 6 is their rightmost, from that player’s own view:

- Player 1: pit 1 is index `0`, pit 6 is index `5`.
- Player 2: pit 1 is index `6`, pit 6 is index `11`.

A recorded move is only the player, the absolute pit, and the move number. Replaying those moves from the initial position rebuilds every later board. Sowing paths and captures are calculated again. They are not trusted from outside the engine.

## What this ruleset does not include

- Sowing into a store.
- Ending the sow when the last seed lands in a house that already has seeds.
- Skipping the house the seeds were lifted from.
