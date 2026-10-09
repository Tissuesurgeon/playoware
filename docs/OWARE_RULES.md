# Oware

PlayOware sows in the roaming way: the hand keeps going until the last seed falls in an empty house. Fours are captured. A match is several rounds. It ends when one player owns all six of the other’s houses.

Sources:

- [Oware Society, Nam-Nam](http://www.oware.org/nam_nam.asp) — roaming sowing, fours, and capturing houses across rounds.

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
- On each turn a player chooses one non-empty house they own.
- At the start, each player owns one row of six.
- Empty houses, houses the player does not own, and moves that break the feeding rule are illegal.
- An illegal choice does not change the board.

## Sowing

1. Lift every seed out of the chosen pit. That pit is now empty.
2. Drop one seed into each following pit, anti-clockwise, including the pit the seeds came from when the sow comes back around.
3. If the last seed lands in a house that already held seeds, lift every seed now in that house and keep sowing from the next house.
4. The move stops when the last seed lands in a house that was empty.

## Capture

A house is captured when a sown seed makes it hold exactly four.

- Four seeds made on the sower’s own houses are captured at once, even in the middle of a handful. Sowing then continues with the seeds still in hand.
- Four seeds made on the opponent’s houses in the middle of a handful are captured by the opponent.
- Four seeds made by the last seed of a handful are captured by the sower, including on the opponent’s houses. That capture ends the move. Those four are not sown onward.
- A capture that leaves eight or fewer seeds on the board ends the round. The player who took that four also takes every seed still on the board, including any seeds left in the hand.

## Feeding

If the opponent owns no seeds at the start of your turn, you must play a move that leaves at least one seed on their houses, if you have one.

- Moves that never reach their houses are illegal while this duty applies.
- If you have no such move, or it is your turn and you own no seeds, each player takes the seeds on their own houses and the round ends.

## Rounds

South starts round 1. North starts round 2. The players keep alternating.

A round ends when a capture leaves eight or fewer seeds, when the player to move has no legal move, or when the same board, the same player to move, and the same captured totals occur again. In the last two cases, each player is given the seeds on their own houses.

Houses earned are the captured seeds divided by four, ignoring a remainder. Then:

- If both players earned the same number of houses, territory stays as it is. This is a drawn round. Play continues.
- Otherwise the player who earned more houses than they currently own takes that many from the opponent. Their own houses are reclaimed first, from the right. Then the opponent’s rightmost houses are taken.
- Capturing one, two, three, or four extra houses does not end the match.
- The next round opens with four seeds in every house.
- A player who owns only two houses still chooses which of those two to play.

## Game end and scoring

The board and both captured totals always add up to 48. Captured seeds decide the round. Houses owned decide the match.

The match ends in the first of these ways that applies:

1. **Territory.** One player owns all twelve houses. The other player’s six houses are gone. That player wins.
2. **Resignation** (PlayOware action). The resigning player loses. Captured totals stay as they are.
3. **Agreed draw** (PlayOware action). The result is a draw. Captured totals stay as they are.
4. **Timeout** (PlayOware clock). The player whose clock reaches zero loses. Captured totals stay as they are.

Reaching 25 captured seeds does not end the match. A 24–24 round keeps the same houses and starts again.

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

A recorded move is only the player, the absolute pit, and the move number. Replaying those moves from the initial position rebuilds every later board, including who owns each house. Sowing paths and captures are calculated again. They are not trusted from outside the engine.

Keys 1–6 play the houses that player still owns, from their left: the near row, then the far row. At the start of a match that is pits 1–6 on their own row.

## What this ruleset does not include

- Sowing into a store.
- Ending the sow when the last seed lands in a house that already has seeds.
- Skipping the house the seeds were lifted from.
