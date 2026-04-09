# Poker Table Layout Redesign

**Date:** 2026-04-09
**Status:** Approved

## Problem

The existing poker layout uses `position: absolute` to place player seats around an elliptical table. This causes two problems:
1. Elements overflow outside the gameplay section when the browser is zoomed.
2. The oval table is too large relative to its content (max 5 community cards), wasting the surrounding space.

## Goals

1. No overflow at any zoom level — all elements stay within the gameplay section bounds.
2. Table size is the minimum needed to display 5 community cards.
3. Remaining space used effectively for player info, bet amounts, and hand display.
4. Dynamic layout by player count: rectangle (2–4), pentagon (5), hexagon (6).
5. Max 6 players enforced at room creation.
6. Clear turn indicators — 45-second countdown for the human player, active highlight for opponents.
7. Showdown reveals only the winner's cards; all other hole cards stay hidden.

## Layout Architecture

Three-zone horizontal flex layout inside `.gf-arena`. No `position: absolute` for any player element.

```
┌─────────────────────────────────────────────────────────────┐
│ Header: game name · phase badge · pot                       │
│ Context bar: D/SB/BB badges · whose-turn indicator          │
├──────────────┬──────────────────────────┬───────────────────┤
│  YOU ZONE    │      TABLE ZONE          │   OPP ZONE        │
│  200px fixed │      flex: 1             │   220px fixed     │
│              │                          │   (260px @ 6p)    │
│  Big cards   │  Felt table (max 340px)  │  Opponent rows    │
│  Name/chips  │  5 comm. cards           │  (no card visuals)│
│  Bet/hand    │  Pot label               │                   │
│              │  Waiting pill (if idle)  │                   │
├──────────────┴──────────────────────────┴───────────────────┤
│ Controls: Fold / Check / Raise  — OR  waiting text          │
└─────────────────────────────────────────────────────────────┘
```

`overflow: hidden` on `.gf-arena` is the hard containment boundary. Nothing escapes it.

### You Zone (left, 200px)

Always the human player. Shows:
- Two fully visible hole cards at 64×92px with Georgia serif rank/suit rendering.
- Name row with dealer/SB/BB badge.
- Chip count, current bet, hand rank label (e.g. "Full House").
- When it is the human's turn: green glow border, pulsing "YOUR TURN" badge, depleting timer bar + countdown.

### Table Zone (center, flex: 1)

- Felt table: `max-width: 340px`, fixed height to fit 5 cards (42×60px each with 8px gaps). Rounded rectangle, not ellipse.
- Up to 5 community cards. Empty slots shown as dashed placeholders before the flop/turn/river.
- Pot label below cards.
- When waiting for an opponent: "Waiting for [Name]…" pill with a blinking dot appears below the table.

### Opponent Zone (right, 220px / 260px at 6 players)

All opponents stacked vertically. No hidden card back visuals. Each row shows:
- Avatar emoji + name (truncated if long) + role badge (SB/BB/D).
- Chip count.
- Current round bet (or "Folded").
- Status tags: FOLD, ALL-IN, WIN.
- Active opponent: amber glow border + mini depleting timer bar + "thinking…" italic label.
- Folded opponent: 30% opacity.

At 6 players the zone widens to 260px and uses `grid-template-columns: 1fr 1fr` (2 columns × 3 rows).

## Player Count Constraints

- **Max players:** 6. Room creation enforces this — the "Create Room" button is disabled and shows an error if `maxPlayers > 6` is selected.
- **Min players:** 2 (unchanged).
- The layout accommodates 2–6 opponents in the right zone without overflow. With 1 opponent (heads-up) the single row centers vertically.

## Turn Indicators

### Human player's turn

1. `.you-zone` receives class `your-turn`:
   - `border-right-color: rgba(16,185,129,0.45)` (green).
   - `background: rgba(16,185,129,0.04)`.
   - `box-shadow: inset -2px 0 12px rgba(16,185,129,0.06)`.
2. Pulsing "YOUR TURN" badge above the cards (green, `pulse-green` keyframe animation).
3. Timer bar (`pk-timer-track` / `pk-timer-bar`) at full width of the you-zone, color:
   - Green (`#10b981`) above 50% (>22.5s remaining).
   - Yellow (`#f59e0b`) between 25–50% (11–22.5s).
   - Red (`#ef4444`) below 25% (<11s remaining).
4. Countdown text (`pk-countdown`) next to the bar, matching color.
5. Timer duration: **45 seconds**. On expiry the server auto-folds for the human player.
6. Context bar shows "Your turn" text with blinking dot.
7. Action buttons (Fold / Check-or-Call / Raise) are enabled.

### Opponent's turn

1. Active opponent's `.opp-panel` receives class `active`:
   - `border-color: rgba(245,158,11,0.6)` (amber).
   - `background: rgba(245,158,11,0.04)`.
   - `box-shadow: 0 0 0 1px rgba(245,158,11,0.15), 0 4px 16px rgba(245,158,11,0.08)`.
2. Mini timer bar (2px height) under the opponent panel, depleting over 45s.
3. "thinking…" italic label under name row.
4. "Waiting for [Name]…" pill below the felt table (blinking dot + amber name).
5. Context bar shows "[Name]'s turn" with blinking dot.
6. Action buttons hidden; footer shows "Waiting for [Name] to act…" text.

### Timer implementation

Both `TimerBar` and `Countdown` are reused from `JudgementGame.jsx` as shared utility components, extracted to `frontend/src/components/games/shared/TimerBar.jsx` and `Countdown.jsx`. `TIMER_SECONDS = 45`.

## Showdown Reveal

Only the winner's hole cards are shown face-up at showdown. All other players' cards remain hidden (card backs).

Logic in `PokerGame.jsx`:
1. On entering `showdown` phase, temporarily reveal all cards in-memory.
2. Call `determineWinners()` on the fully-revealed state.
3. Re-hide hole cards for any player who is not a winner and is not the human player.
4. Commit to state with `winners` array set.
5. Hand evaluation label (`bestHand()`) is displayed only for the winner(s) and the human player.

## CSS Changes

Key changes to `Poker.css`:

- Remove all `.pk-seat-*` absolute-position seat rules.
- Remove `.pk-felt` ellipse sizing.
- Add `.gf-arena`, `.you-zone`, `.table-zone`, `.opp-zone` flex layout rules.
- Add `.your-turn`, `.pk-timer-track`, `.pk-timer-bar`, `.pk-countdown`, `.your-turn-badge` for turn indicator.
- Add `.opp-panel.active` amber glow, `.opp-mini-timer`, `.opp-mini-bar`.
- Add `.waiting-pill` for the below-table indicator.
- All sizing in `px` or `min()` — no `vw`/`vh` on inner elements to prevent zoom overflow.

## Files Affected

| File | Change |
|------|--------|
| `frontend/src/components/games/PokerGame.jsx` | Replace absolute seat layout with three-zone flex; add turn state logic; wire TimerBar/Countdown; showdown reveal fix |
| `frontend/src/styles/Poker.css` | Full layout rewrite for three-zone system |
| `frontend/src/components/games/shared/TimerBar.jsx` | Extract from Judgement (new file) |
| `frontend/src/components/games/shared/Countdown.jsx` | Extract from Judgement (new file) |
| `frontend/src/components/games/JudgementGame.jsx` | Import from shared instead of local definition |
| `frontend/src/pages/PokerRoomPage.jsx` | Enforce max 6 players at room creation |

## Design Decisions

**Polygon seating abandoned:** The original brief asked for pentagon (5p) and hexagon (6p) table shapes with players seated on polygon vertices. After visual iteration, this was dropped in favor of the three-zone layout. Reasons: polygon seating requires `position: absolute` (the root cause of the overflow bug), and the vertical list for opponents is cleaner and more readable at small sizes/zoomed views.

**No opponent card backs:** Hidden card visuals (face-down card backs) for opponents were removed. They add visual noise without information value — all opponents always hold exactly 2 hidden cards.

## Out of Scope

- Multiplayer server-side timer enforcement (the 45s auto-fold on expiry is server-driven in multiplayer; this spec covers the UI only for the single-player/AI mode).
- Sound effects on timer warning.
- Animated card dealing (already shipped separately).
