# Gameplay Improvements — Design Spec

**Date:** 2026-04-08  
**Scope:** Blackjack + Judgement — critical fixes, Zustand architecture, card visuals, animations, emotional feedback, layout

---

## 1. Decisions & Constraints

| Decision | Choice | Rationale |
|---|---|---|
| State management | Zustand (single store) | Scalable, O(1) selectors, no prop drilling |
| Card visuals | Premium CSS — large suit center, no icons/SVG | Zero deps, fully animatable |
| Face card style | Large suit symbol in center (same as number cards, bigger font) | Clean, consistent, no emoji |
| Dealing animation | CSS keyframe fly-in from deck position, staggered per card | No Framer Motion dep needed |
| Shoe model | 10-deck persistent shoe per room, reshuffle at 20% (104 cards) | Casino cut-card rule |
| Ace logic | Already correct in backend `hand_score()` | No change needed |
| Result overlays | Zoom-in enter (`scale 0.72→1`), zoom-out exit (`scale 1→0.68`) | Confirmed in visual review |

---

## 2. Architecture — Zustand Store

### 2.1 Store shape (`src/store/gameStore.js`)

```js
{
  // Raw server state (set by WS connector)
  room: null, players: [], me: null, loading: true, error: null,

  // Unpacked game state
  gs: {}, phase: null,

  // Identity
  isHost: false, isMyTurn: false,

  // Blackjack guards
  canAct: false,      // hit / stand / double — phase=playing && isMyTurn
  canBet: false,      // place/confirm bet   — phase=betting
  canDouble: false,   // hand.length===2 && bet <= balance - bet

  // Judgement guards  
  canBid: false,      // phase=bidding && isMyTurn
  canPlay: false,     // phase=playing && isMyTurn && !trick?.winner

  // Per-player seat data
  myData: null,
  myValidCards: [],   // Judgement only
  forbidden: null,    // Judgement dealer bid restriction

  // WS send function (set by connector hook)
  send: () => {},

  // Actions
  setSend: (fn) => void,
  applyServerState: (room, players, myToken) => void,  // recomputes all derived state atomically
  setError: (err) => void,
  reset: () => void,
}
```

All derived fields are computed **atomically** inside `applyServerState` — one call, one React render. No intermediate stale states.

### 2.2 WS connector hooks

`useRoom` and `useJudgementRoom` become thin connectors — they no longer return state. They:
1. Create the `RoomSocket`
2. Call `applyServerState(room, players, token)` on every `state` message
3. Call `setError(msg)` on close/error
4. Call `setSend(socket.send)` after connect
5. Call `reset()` on unmount

Components import directly from the store:
```js
const canAct = useGameStore(s => s.canAct);
const phase  = useGameStore(s => s.phase);
```

### 2.3 Files changed
- **New:** `frontend/src/store/gameStore.js`
- **Modified:** `frontend/src/hooks/useRoom.js` — strip return state, become connector
- **Modified:** `frontend/src/hooks/useJudgementRoom.js` — same
- **Modified:** `frontend/src/components/rooms/RoomPage.jsx` — remove prop drilling
- **Modified:** `frontend/src/components/rooms/JudgementRoomPage.jsx` — remove prop drilling
- **Modified:** `frontend/src/components/games/MultiplayerBlackjack.jsx` — read from store
- **Modified:** `frontend/src/components/games/JudgementGame.jsx` — read from store

---

## 3. Game State Guard (`canAct`)

### 3.1 Guard definitions

```js
// Computed inside applyServerState:

// Blackjack
canBet    = phase === 'betting'
canAct    = phase === 'playing' && isMyTurn
canDouble = canAct && myData?.hand?.length === 2 && myData.bet <= (myBalance - myData.bet)

// Judgement
canBid    = phase === 'bidding' && isMyTurn
canPlay   = phase === 'playing' && isMyTurn && !gs.trick?.winner
```

### 3.2 UI enforcement

**Blackjack:**
- Action panel (Hit/Stand/Double) only rendered when `canAct`
- Chip buttons disabled when `!canBet`
- "Confirm Bet" disabled when `localBet === 0 || betLocked`

**Judgement:**
- Bid panel only rendered when `canBid`
- Card `onClick` only attached when `canPlay && isValidCard(card)`
- Cards get `dimmed` CSS class when `!canPlay || !isValidCard`

### 3.3 Visual disabled state

```css
/* Judgement cards */
.jdg-card.dimmed   { opacity: 0.35; filter: saturate(0.3); cursor: not-allowed; pointer-events: none; }
.jdg-card.playable { box-shadow: 0 0 12px rgba(167,139,250,0.5); transform: translateY(-4px); cursor: pointer; }
```

### 3.4 Page edge indicator

Fixed 5px border on left + right + bottom edges of the game page. Color driven by timer percentage:

| State | Color | Condition |
|---|---|---|
| Not your turn | Invisible | `!isMyTurn` |
| Safe | `#10b981` (green) | `timerPct > 40` |
| Time low | `#f59e0b` (amber) | `timerPct 15–40` |
| Urgent | `#ef4444` (red, pulsing) | `timerPct < 15` |

Implemented as a `<PageEdgeIndicator timerStart={gs.timer_start} isMyTurn={isMyTurn} />` component. It reads `isMyTurn` and `gs` from the store, computes `timerPct` internally from `gs.timer_start` using the same `setInterval` pattern as the existing `TimerBar` component. For Blackjack (no server timer), `timerStart` is always `null` — the indicator stays green for the full duration of the turn.

---

## 4. Backend — 10-Deck Persistent Shoe

### 4.1 Changes to `backend/app/services/blackjack_service.py`

**`start_game()`** — build shoe once:
```python
def start_game(players):
    seats = { ... }
    return {
        'phase': 'betting',
        'deck': build_deck(10),   # ← was [], now built here
        'dealer_hand': [],
        'active_seat': None,
        'seats': seats,
        'round': 1,
    }
```

**`deal()`** — remove `build_deck()` call, use existing `gs['deck']`:
```python
def deal(gs):
    deck = list(gs['deck'])   # ← use persistent shoe
    # ... rest unchanged, just remove the build_deck(6) line
```

**`new_round()`** — cut-card reshuffle check:
```python
def new_round(gs, players):
    deck = list(gs.get('deck', []))
    if len(deck) < 0.20 * 520:   # below 20% → reshuffle
        deck = build_deck(10)
    fresh_seats = { ... }
    return {
        'phase': 'betting',
        'deck': deck,
        ...
        'round': gs.get('round', 1) + 1,
    }
```

### 4.2 Ace logic — no changes needed

`hand_score()` already correctly implements soft/hard Ace (counts 11, folds to 1 while total > 21). Frontend `handScore` in `deck.js` mirrors the same logic.

---

## 5. Card Visuals

### 5.1 Card size

| Dimension | Before | After |
|---|---|---|
| Width | 72px | 88px |
| Height | 104px | 126px |
| Rank font | 0.95rem | 1.15rem |
| Center suit | 2.0rem | 2.8rem |
| Corner suit | 0.7rem | 0.75rem |
| Border radius | 8px | 10px |

### 5.2 Shine & depth

```css
.bj-card {
  box-shadow:
    0 8px 24px rgba(0,0,0,0.65),
    0 2px 6px rgba(0,0,0,0.4),
    inset 0 1px 0 rgba(255,255,255,0.55),
    inset 0 -1px 0 rgba(0,0,0,0.08);
}
.bj-card::before {   /* diagonal shine overlay */
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(135deg,
    rgba(255,255,255,0.32) 0%,
    rgba(255,255,255,0.06) 40%,
    transparent 60%
  );
  border-radius: 10px;
  pointer-events: none; z-index: 3;
}
.bj-card::after {   /* inner border */
  content: '';
  position: absolute; inset: 0;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.12);
  pointer-events: none; z-index: 4;
}
```

### 5.3 Face cards (K, Q, J)

Same structure as number cards — large suit symbol in center, bold rank in corners. No separate artwork or icons. The larger center suit (2.8rem) makes K/Q/J visually distinct enough by context (rank label).

### 5.4 Dealing animation

```css
@keyframes bj-deal {
  0%   { transform: translateX(-90px) translateY(-50px) rotate(-10deg) scale(0.65); opacity: 0; }
  55%  { opacity: 1; }
  75%  { transform: translateX(3px) translateY(-2px) rotate(0.4deg) scale(1.03); }
  100% { transform: translateX(0) translateY(0) rotate(0deg) scale(1); }
}

.bj-card {
  animation: bj-deal 0.32s cubic-bezier(0.34,1.42,0.64,1) both;
  animation-delay: calc(var(--card-index, 0) * 0.13s);
}
```

Cards fly in from the top-left (deck position) with 130ms stagger per card and a slight overshoot on landing. Applied to both Blackjack and Judgement cards.

---

## 6. Emotional Feedback

### 6.1 Result overlay animation

**Enter (zoom in):**
```css
@keyframes overlay-in {
  0%   { transform: scale(0.72) translateY(10px); opacity: 0; }
  65%  { transform: scale(1.04) translateY(-2px); opacity: 1; }
  100% { transform: scale(1)    translateY(0);    opacity: 1; }
}
```

**Exit (zoom out):**
```css
@keyframes overlay-out {
  0%   { transform: scale(1)    translateY(0);   opacity: 1; }
  30%  { transform: scale(1.06) translateY(-4px); opacity: 0.8; }
  100% { transform: scale(0.68) translateY(8px); opacity: 0; }
}
```

Exit is triggered programmatically (class swap) before unmounting.

### 6.2 Blackjack overlays

Shown in `mbj-controls` area at end of each round:

| Outcome | Style | Auto-dismiss |
|---|---|---|
| Win | Green background, `✓ You Win! +$N` | 2.2s |
| Blackjack | Gold glow, `♦ Blackjack! +$N (3:2)` | 2.5s |
| Lose | Red background, `✗ You Lose −$N` | 2.2s |
| Push | Indigo background, `= Push` | 2.2s |

### 6.3 Judgement overlays

| Event | Overlay | Auto-dismiss |
|---|---|---|
| Trick won | Green banner slides in from left — "✨ You won the trick! N/M tricks" | 2.2s |
| Round — hit bid | Green pop-in — 🎯 "Bid hit! +N pts / Bid X, got X" | 2.4s |
| Round — missed bid | Grey pop-in — 😬 "Missed — +0 pts / Bid X, got Y" | 2.4s |
| Round scoreboard | Purple table showing all players bid/got/delta/total — stays until next round starts | Manual / auto on round advance |
| Game over | Full leaderboard with trophy, gold row for winner | Stays — user leaves room |

Trick won uses a distinct slide-in-from-left / exit-to-right animation to differentiate it from the zoom overlays.

---

## 7. Turn Awareness

### 7.1 Page edge indicator

Thin border (5px) on left + right + bottom edges of the game page. Implemented as a fixed overlay `<div>` that does not affect layout. Color animated via CSS transition (0.4s ease).

Only visible when `isMyTurn`. Color thresholds based on `timerPct` (0–100, computed from `gs.timer_start`):
- `timerStart === null` (Blackjack) → always `#10b981` green for the full turn
- `timerPct > 40` → `#10b981` green
- `timerPct 15–40` → `#f59e0b` amber
- `timerPct < 15` → `#ef4444` red + `urgent-pulse` keyframe (alternates intensity)

**Blackjack** has no server-side timer, so `timer_start` is null — the edge indicator remains green throughout the player's turn. **Judgement** has the full amber/red progression.

### 7.2 Active seat highlight (Blackjack)

Active seat already has `mbj-seat-active` class with green border glow. Enhanced with stronger pulsing animation:
```css
@keyframes seat-pulse {
  0%,100% { box-shadow: 0 0 0 1px rgba(34,197,94,0.2), 0 0 24px rgba(34,197,94,0.18); }
  50%      { box-shadow: 0 0 0 2px rgba(34,197,94,0.4), 0 0 40px rgba(34,197,94,0.3); }
}
```

A "YOUR TURN" badge added inside the player's own seat when `isMyTurn`, blinking at 1.4s interval.

---

## 8. Layout Optimisation

### 8.1 Blackjack

- Table goes **full-bleed** — fills all available vertical space (no empty zone below table)
- `max-width` of table inner: `760px → 960px`
- Seats grid moved **inside the green table zone** — players see their cards in context
- Controls panel sits flush at the bottom, separated by a subtle border
- Seats grid: `repeat(auto-fill, minmax(200px,1fr))` → `repeat(auto-fill, minmax(180px,1fr))` to fit more seats

### 8.2 Judgement

- Player panel: `~90px → 130px` wide — names and scores no longer truncate
- Trick zone: larger cards (matches new card size), player name label beneath each played card, empty placeholder slot for pending plays
- Hand area: fixed at bottom, always visible during bidding and playing phases; valid cards lift up `4px` with purple glow
- Status badges in topbar: Round N/M, Trump suit (color-coded), Hand size — replaces scattered labels

---

## 9. Implementation Order (Approach 2 — Store-first)

1. **Zustand store** — `gameStore.js`, convert WS hooks to connectors, remove prop drilling from page components
2. **`canAct` guard** — compute all guards in `applyServerState`, enforce in Blackjack + Judgement UI, add page edge indicator
3. **Backend shoe** — `start_game` builds 10-deck shoe, `deal` uses `gs.deck`, `new_round` checks 20% threshold
4. **Card visuals** — new sizes, shine/depth CSS, updated `Blackjack.css` + `MultiplayerBJ.css` + `Judgement.css`
5. **Dealing animation** — updated `bj-deal` keyframe applied to all card components
6. **Result overlays** — `overlay-in`/`overlay-out` keyframes, Blackjack result panel, Judgement trick/round/gameover overlays
7. **Layout** — Blackjack full-bleed table, Judgement wider panel + trick zone + hand area
8. **Deploy** — `./deploy.sh`
