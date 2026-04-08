# IYKYK GAMES — Design System
**Version:** 1.0  
**Last updated:** 2026-04-09  
**Scope:** Landing page, all game pages, future games, both light and dark modes

---

## 1. Brand Identity

**IYKYK = If You Know You Know.**

This is not a casual mobile game. It's a private card club for people who play for real. The brand sits at the intersection of a high-stakes casino and an underground speakeasy — exclusive, refined, a little dangerous.

Every design decision should answer: *does this feel like somewhere serious players want to spend time?*

**Brand pillars:**
- **Premium** — gold accents, deep navy, Cinzel typography. No bubbly pastels.
- **Competitive** — live indicators, real-time feedback, score animations. Players feel stakes.
- **Familiar** — card suits (♠ ♥ ♦ ♣) as the visual language. Everyone knows the icons.
- **Expanding** — designed to grow. The system must accommodate Poker, Teen Patti, Rummy, Solitaire, War, and games not yet imagined.

---

## 2. Classifier

The app is **HYBRID**:
- **Landing page:** MARKETING/LANDING — brand-first, game discovery, conversion to play
- **Game lobby/rooms:** APP UI — task-focused, join/create room, minimal chrome
- **Active game screens:** APP UI — data-dense, zero decoration, every pixel serves gameplay

Apply landing page rules to the hero + game grid. Apply app UI rules to all game screens.

---

## 3. Color System

### 3a. Dark Mode (Primary — default)

The app is dark-first. Deep navy backgrounds, gold as the singular brand accent.

```css
:root[data-theme="dark"], :root {
  /* ── Backgrounds (elevation layers) ── */
  --color-bg-0:        #05071a;   /* Page background — deepest */
  --color-bg-1:        #07091a;   /* Primary surface */
  --color-bg-2:        #0a0d1f;   /* Cards, panels */
  --color-bg-3:        #0d1228;   /* Elevated cards */
  --color-bg-4:        #111830;   /* Hover states */

  /* ── Brand accent — Gold ── */
  --color-gold:        #f59e0b;
  --color-gold-light:  #fcd34d;
  --color-gold-dark:   #d97706;
  --color-gold-dim:    rgba(245, 158, 11, 0.12);
  --color-gold-glow:   rgba(245, 158, 11, 0.35);

  /* ── Semantic — Danger/Red (♥ ♦ suits, Blackjack accent) ── */
  --color-red:         #f43f5e;
  --color-red-dark:    #e11d48;
  --color-red-dim:     rgba(244, 63, 94, 0.12);
  --color-red-glow:    rgba(244, 63, 94, 0.35);

  /* ── Semantic — Success/Green (live dot, win states) ── */
  --color-green:       #22c55e;
  --color-green-dark:  #16a34a;
  --color-green-dim:   rgba(34, 197, 94, 0.12);

  /* ── Game accents (per-game, not brand colors) ── */
  --color-game-blackjack: #e63946;   /* Deep red */
  --color-game-judgement: #a78bfa;   /* Violet */
  --color-game-poker:     #f4c542;   /* Warm yellow */
  --color-game-teenpatti: #f43f5e;   /* Red */
  --color-game-rummy:     #a78bfa;   /* Violet */
  --color-game-solitaire: #34d399;   /* Teal */
  --color-game-war:       #fb923c;   /* Orange */

  /* ── Text ── */
  --color-text-primary:  #f1f5f9;
  --color-text-secondary:#c9d4e3;
  --color-text-muted:    #7e90aa;
  --color-text-dim:      #374461;
  --color-text-disabled: #2d3a52;

  /* ── Borders ── */
  --color-border:        rgba(255, 255, 255, 0.08);
  --color-border-hover:  rgba(245, 158, 11, 0.45);
  --color-border-focus:  rgba(245, 158, 11, 0.7);

  /* ── Overlays ── */
  --color-overlay:       rgba(0, 0, 0, 0.75);
  --color-scrim:         rgba(5, 7, 26, 0.9);
}
```

### 3b. Light Mode

Light mode uses warm cream as the base — not white. White feels clinical. Cream feels like a felt-topped card table.

```css
:root[data-theme="light"] {
  /* ── Backgrounds ── */
  --color-bg-0:        #f5f0e8;   /* Warm cream — page */
  --color-bg-1:        #faf7f2;   /* Primary surface */
  --color-bg-2:        #ffffff;   /* Cards, panels */
  --color-bg-3:        #f0ebe0;   /* Sunken elements */
  --color-bg-4:        #e8e0d0;   /* Hover on sunken */

  /* ── Brand accent — Gold ── */
  --color-gold:        #d97706;   /* Slightly darker for contrast on cream */
  --color-gold-light:  #f59e0b;
  --color-gold-dark:   #b45309;
  --color-gold-dim:    rgba(217, 119, 6, 0.10);
  --color-gold-glow:   rgba(217, 119, 6, 0.25);

  /* ── Semantic — Danger/Red ── */
  --color-red:         #dc2626;
  --color-red-dark:    #b91c1c;
  --color-red-dim:     rgba(220, 38, 38, 0.08);
  --color-red-glow:    rgba(220, 38, 38, 0.2);

  /* ── Semantic — Success/Green ── */
  --color-green:       #16a34a;
  --color-green-dark:  #15803d;
  --color-green-dim:   rgba(22, 163, 74, 0.08);

  /* ── Game accents — slightly saturated on light mode ── */
  --color-game-blackjack: #dc2626;
  --color-game-judgement: #7c3aed;
  --color-game-poker:     #d97706;
  --color-game-teenpatti: #dc2626;
  --color-game-rummy:     #7c3aed;
  --color-game-solitaire: #059669;
  --color-game-war:       #ea580c;

  /* ── Text ── */
  --color-text-primary:  #0f172a;
  --color-text-secondary:#1e293b;
  --color-text-muted:    #64748b;
  --color-text-dim:      #94a3b8;
  --color-text-disabled: #cbd5e1;

  /* ── Borders ── */
  --color-border:        rgba(15, 23, 42, 0.10);
  --color-border-hover:  rgba(217, 119, 6, 0.45);
  --color-border-focus:  rgba(217, 119, 6, 0.7);

  /* ── Overlays ── */
  --color-overlay:       rgba(15, 23, 42, 0.6);
  --color-scrim:         rgba(240, 234, 220, 0.92);
}
```

### 3c. Color Palette Visualization

```
DARK MODE                          LIGHT MODE
─────────────────────────────────  ──────────────────────────────────
██ #05071a  bg-0 (page)            ██ #f5f0e8  bg-0 (page)
██ #07091a  bg-1 (surface)         ██ #faf7f2  bg-1 (surface)
██ #0a0d1f  bg-2 (cards)           ██ #ffffff  bg-2 (cards)
██ #0d1228  bg-3 (elevated)        ██ #f0ebe0  bg-3 (sunken)
█  #f59e0b  gold (brand)           █  #d97706  gold (brand)
█  #f43f5e  red (danger/♥♦)        █  #dc2626  red (danger)
█  #22c55e  green (live/win)       █  #16a34a  green (live/win)
```

---

## 4. Typography

### 4a. Typefaces

| Role | Font | Why |
|------|------|-----|
| Display | **Cinzel** (serif) | Roman letterform, timeless authority. Perfect for card game titles, scores, hero headlines. Never use for body text. |
| Body | **Inter** | Neutral, legible at small sizes. Good for game descriptions, rules text, labels. |
| Monospace (optional) | **JetBrains Mono** | For room codes, score numbers, poker hands — where character spacing matters. |

```css
:root {
  --font-display: 'Cinzel', 'Times New Roman', serif;
  --font-body:    'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono:    'JetBrains Mono', 'Courier New', monospace;
}
```

### 4b. Type Scale

Based on a **1.25 Major Third** ratio. Base = 16px.

```css
:root {
  --text-xs:   0.64rem;   /* 10.2px — micro labels, legal text */
  --text-sm:   0.8rem;    /* 12.8px — badges, captions, footer labels */
  --text-base: 1rem;      /* 16px — body text (minimum) */
  --text-md:   1.125rem;  /* 18px — lead text, large labels */
  --text-lg:   1.25rem;   /* 20px — subheadings, card names */
  --text-xl:   1.563rem;  /* 25px — section headings */
  --text-2xl:  1.953rem;  /* 31.3px — page titles */
  --text-3xl:  2.441rem;  /* 39px — hero display */
  --text-4xl:  3.052rem;  /* 48.8px — hero headline */
  --text-5xl:  clamp(2.8rem, 7vw, 5.5rem); /* Responsive hero */
}
```

### 4c. Line Heights & Measures

```css
:root {
  --leading-tight:   1.15;   /* Headings in Cinzel */
  --leading-snug:    1.35;   /* Subheadings */
  --leading-base:    1.6;    /* Body text */
  --leading-loose:   1.75;   /* Rules text, long descriptions */
  --measure-narrow:  45ch;   /* Narrowest readable width */
  --measure-base:    65ch;   /* Ideal body measure */
  --measure-wide:    80ch;   /* Wide panels */
}
```

### 4d. Heading Semantic Rules

Every page **must** follow this hierarchy. No skipping levels.

```
H1 — Hero headline / Page title (Cinzel, --text-5xl, one per page)
H2 — Section label ("Live Now", "Coming Soon") (Cinzel or uppercase Inter)
H3 — Game names / Card titles (Cinzel, --text-lg)
H4 — Footer column headers / Sub-section labels (Inter, uppercase, --text-sm)
H5 — In-game section labels (Inter, --text-sm, letter-spaced)
```

---

## 5. Spacing System

All spacing on an **8px base grid**. Never use arbitrary values.

```css
:root {
  --space-1:   4px;    /* Micro — icon gaps, tight label spacing */
  --space-2:   8px;    /* XS — inline gaps, tight padding */
  --space-3:   12px;   /* SM — compact padding */
  --space-4:   16px;   /* MD — standard inline padding */
  --space-5:   20px;   /* — */
  --space-6:   24px;   /* LG — card inner padding */
  --space-8:   32px;   /* XL — section inner padding */
  --space-10:  40px;   /* 2XL — section spacing */
  --space-12:  48px;   /* 3XL — major section gaps */
  --space-16:  64px;   /* 4XL — hero padding */
  --space-20:  80px;   /* 5XL — page section padding */
  --space-24:  96px;   /* 6XL — max section spacing */
}
```

---

## 6. Border Radius

```css
:root {
  --radius-xs:   4px;    /* Tiny chips, inner nested elements */
  --radius-sm:   8px;    /* Buttons, chips, badges */
  --radius-md:   12px;   /* Form inputs, small cards */
  --radius-lg:   16px;   /* Game cards, modals */
  --radius-xl:   24px;   /* Game table surfaces, large panels */
  --radius-2xl:  32px;   /* Hero cards, full-bleed panels */
  --radius-full: 100px;  /* Pills, badges, avatar circles */
}
```

**Rule:** When a smaller element is nested inside a larger rounded container, its radius = outer radius − gap. A button inside an 8px-padded 16px-radius card should use an 8px radius.

---

## 7. Shadows & Glows

```css
:root {
  /* ── Elevation shadows ── */
  --shadow-sm:   0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-md:   0 4px 16px rgba(0, 0, 0, 0.4);
  --shadow-lg:   0 10px 40px rgba(0, 0, 0, 0.6);
  --shadow-xl:   0 20px 60px rgba(0, 0, 0, 0.7);

  /* ── Brand glows ── */
  --glow-gold:   0 0 20px rgba(245, 158, 11, 0.35),
                 0 0 40px rgba(245, 158, 11, 0.15);
  --glow-red:    0 0 20px rgba(244, 63, 94, 0.35),
                 0 0 40px rgba(244, 63, 94, 0.15);
  --glow-green:  0 0 12px rgba(34, 197, 94, 0.6);

  /* ── Card surface ── */
  --shadow-card: 0 10px 40px rgba(0, 0, 0, 0.6),
                 inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
```

---

## 8. Motion System

```css
:root {
  /* ── Easing curves ── */
  --ease-out:      cubic-bezier(0.0, 0.0, 0.2, 1);   /* Elements entering */
  --ease-in:       cubic-bezier(0.4, 0.0, 1.0, 1);   /* Elements leaving */
  --ease-in-out:   cubic-bezier(0.4, 0.0, 0.2, 1);   /* Moving elements */
  --ease-spring:   cubic-bezier(0.34, 1.42, 0.64, 1); /* Cards, overlays — bouncy */

  /* ── Durations ── */
  --duration-fast:   100ms;   /* Micro feedback (button press) */
  --duration-base:   200ms;   /* Hover states */
  --duration-slow:   300ms;   /* Card animations, modals */
  --duration-slower: 500ms;   /* Page transitions, result overlays */
  --duration-crawl:  700ms;   /* Dealing animations */
}

/* ── REQUIRED: Respect user preferences ── */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .float-suit { display: none; }
}
```

**Rules:**
- Entering elements: `ease-out`. Exiting: `ease-in`. Moving: `ease-in-out`.
- Card deals and result overlays: `ease-spring` (the bounce communicates "real card").
- Never animate `width`, `height`, `top`, `left`. Only `transform` and `opacity`.
- Never `transition: all`. Always enumerate properties.

---

## 9. Component Library

### 9a. Buttons

Three variants. One size system.

**Sizes:**
```css
.btn-sm  { height: 36px; padding: 0 16px; font-size: var(--text-sm); }
.btn-md  { height: 44px; padding: 0 24px; font-size: var(--text-base); }  /* Default */
.btn-lg  { height: 52px; padding: 0 32px; font-size: var(--text-md); }
```

**Variants:**

```css
/* Primary — brand action, gold fill, dark text */
.btn-primary {
  background: linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%);
  color: var(--color-bg-0);
  box-shadow: 0 4px 18px var(--color-gold-glow);
  border: none;
}
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 28px var(--color-gold-glow); }
.btn-primary:active { transform: translateY(0); }

/* Secondary — glass/outline, secondary action */
.btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-primary);
  border: 1.5px solid rgba(255, 255, 255, 0.16);
}
.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.10);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

/* Ghost — disabled/coming-soon */
.btn-ghost {
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text-disabled);
  border: 1px dashed rgba(255, 255, 255, 0.10);
  cursor: not-allowed;
  opacity: 0.65;
}

/* Danger — destructive actions (leave game, reset) */
.btn-danger {
  background: linear-gradient(135deg, var(--color-red) 0%, var(--color-red-dark) 100%);
  color: #fff;
  box-shadow: 0 4px 18px var(--color-red-glow);
  border: none;
}
```

**Required states for all buttons:**
```css
.btn:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 2px;
}
.btn[disabled], .btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}
```

**Light mode adjustments:**
```css
[data-theme="light"] .btn-secondary {
  background: rgba(15, 23, 42, 0.04);
  border-color: rgba(15, 23, 42, 0.15);
  color: var(--color-text-primary);
}
[data-theme="light"] .btn-secondary:hover {
  background: rgba(15, 23, 42, 0.08);
}
```

---

### 9b. Game Cards

Game cards come in three states: **live**, **coming-soon**, and **locked** (future: authenticated-only games).

```
┌─────────────────────────────────┐
│  ♦  [BEAT THE DEALER]  [?]      │  ← header: suit + caption-tag + rules
│                                 │
│  Blackjack                      │  ← h3 game name (Cinzel)
│  Beat the dealer to 21 without  │  ← description (Inter)
│  busting. The casino classic.   │
│                                 │
│  👥 1–8 players                 │  ← meta (replace emoji with SVG)
├─────────────────────────────────┤
│  [Solo]          [With Friends] │  ← action row
└─────────────────────────────────┘
```

**Live card:**
- Border: `1px solid var(--color-border)`
- Top accent line: game-specific color (on hover → always visible)
- Card glow: game color at 8% opacity on hover
- Elevation: `translateY(-6px)` on hover

**Coming-soon card:**
- Do NOT use opacity/grayscale. Use a distinct treatment:
- Border: `1px solid var(--color-border)` (same as live)
- Top accent line: game color at 30% opacity (always visible — teaser)
- "COMING SOON" badge top-right in amber/gold
- No opacity reduction — the card is full-fidelity to show the game
- CTA: "Notify Me →" (ghost outline) or count down if date known
- Hover: gentle lift, card reveals a "What's coming" peek

**CSS for coming-soon treatment:**
```css
.game-card--coming-soon {
  /* Do not dim — tease the game, not hide it */
  position: relative;
}
.game-card--coming-soon .game-card-badge {
  position: absolute;
  top: 14px;
  right: 14px;
  background: var(--color-gold-dim);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: var(--color-gold);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: var(--radius-full);
}
```

---

### 9c. Navigation Bar

```
┌────────────────────────────────────────────────────────────────┐
│  ♠ IYKYK GAMES       THE CARD GAME ARENA         [Sign In]     │
└────────────────────────────────────────────────────────────────┘
```

**Rules:**
- Height: **68px minimum**. Logo link height **must be 44px minimum** (accessibility).
- Logo: Cinzel, gold ♠ suit, "IYKYK" text-primary, "GAMES" in gold.
- Center badge: pill with suits + tagline (decorative, not interactive).
- Right side: navigation links (future), sign in / avatar.
- Sticky with backdrop-blur on scroll, slight border enhancement on scroll.
- Light mode: `background: rgba(250, 247, 242, 0.92)` with warm border.

**As the platform grows, add:**
```
Left: Logo
Center: [Games ▾] [Leaderboard] [Tournaments] (expand progressively)
Right: [Sign In] → [Avatar chip]
```

---

### 9d. Hero Section

The hero is the brand moment. It must be visible on the landing page.

```
┌─────────────────────────────────────────────────────────────────┐
│                    [floating suits bg: ♠ ♥ ♦ ♣]               │
│                                                                 │
│              [ ♠ ♥ ♦ ♣  THE CARD GAME ARENA ]                 │
│                                                                 │
│                  Play Like You                                  │
│               Know You Know                     ← H1, Cinzel   │
│                                                                 │
│        Premium card games. Real competition.                    │
│        Prove you've got the edge.               ← subtitle     │
│                                                                 │
│           [♠ Start Playing]    [View Games →]   ← CTAs        │
│                                                                 │
│      6+ Games · 10K+ Players · Live · Free                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Hero must include:
1. A badge/pill with game suite preview
2. An H1 headline (Cinzel, large, gradient text on "Know You Know")
3. A subtitle (16px min, muted color)
4. A CTA group (primary + secondary)
5. A social proof row (stats)

The floating suits animation must be gated by `prefers-reduced-motion`.

**Light mode hero:**
- Remove dark radial gradient background
- Use warm cream (#faf7f2) base
- Floating suits at same low opacity (0.06)
- Gold gradient still works on cream
- Grid lines in gold at 2% opacity (not 4%)

---

### 9e. Rules Modal

```
┌──────────────────────────────────┐
│ How to Play Blackjack         ✕  │
├──────────────────────────────────┤
│ • Goal: get closer to 21 than    │
│   the dealer without busting     │
│                                  │
│ • Number cards = face value...   │
│                                  │
│ • Hit to take another card...    │
└──────────────────────────────────┘
```

**Rules:**
- Max width: 520px
- Backdrop: blur(8px) with color overlay
- Border-top accent: game-specific color (2px)
- Close button: 44×44px minimum (currently too small)
- Accessible: `role="dialog"`, `aria-labelledby`, `aria-modal="true"`, trap focus inside

---

### 9f. Room Entry Card

```
┌────────────────────────────────────┐
│  ♠  Blackjack                      │  ← suit icon + game name (H1 here)
│  MULTIPLAYER · 1–8 PLAYERS         │  ← metadata tags
│                                    │
│  YOUR NAME                         │
│  ┌──────────────────────────────┐  │
│  │  Enter your name             │  │  ← text input
│  └──────────────────────────────┘  │
│                                    │
│  [  Create Room  ]  [  Join Room ] │  ← primary + secondary
│                                    │
│  ← Back to games                   │
└────────────────────────────────────┘
```

**Rules:**
- Card width: max 440px, centered on full-bleed dark background
- Background: `var(--color-bg-3)` (elevated card)
- Input: `var(--color-bg-2)` fill, `var(--color-border)` border, focus = gold ring
- "Create Room" = primary (gold) button
- "Join Room" = secondary (glass) button — do NOT use purple as primary CTA
- Back link: must be ≥ 44px touch target

---

### 9g. Input Fields

```css
.input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  background: var(--color-bg-2);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-family: var(--font-body);
  font-size: var(--text-base);
  transition: border-color var(--duration-base) var(--ease-in-out);
}

.input::placeholder {
  color: var(--color-text-dim);
}

.input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px var(--color-gold-dim);
}

/* Light mode */
[data-theme="light"] .input {
  background: #ffffff;
  border-color: rgba(15, 23, 42, 0.12);
  color: var(--color-text-primary);
}
[data-theme="light"] .input:focus {
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px var(--color-gold-dim);
}
```

---

### 9h. Badges & Tags

**Pill badge (game caption, section labels):**
```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.badge-gold   { background: var(--color-gold-dim); color: var(--color-gold); border: 1px solid rgba(245,158,11,0.2); }
.badge-green  { background: var(--color-green-dim); color: var(--color-green); border: 1px solid rgba(34,197,94,0.2); }
.badge-muted  { background: rgba(255,255,255,0.06); color: var(--color-text-muted); border: 1px solid var(--color-border); }
```

**Live indicator (pulsing green dot):**
```css
.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-green);
  box-shadow: var(--glow-green);
  animation: pulse-green 2s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .live-dot { animation: none; }
}
```

---

### 9i. Game Table Surfaces

Each game has its own table surface. The table is the "felt" — it communicates what game you're playing before you read a word.

**Blackjack:**
```css
.bj-table-surface {
  background: radial-gradient(ellipse at center, #1b4a2a 0%, #102d1a 60%, #091f11 100%);
  border: 2px solid rgba(34, 197, 94, 0.18);
  border-radius: var(--radius-2xl);
  box-shadow:
    0 0 60px rgba(0, 0, 0, 0.8),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
```

**Judgement (future card table view):**
```css
.jdg-table-surface {
  background: radial-gradient(ellipse at center, #1a1035 0%, #100a2a 60%, #07051a 100%);
  border: 2px solid rgba(167, 139, 250, 0.18);
  border-radius: var(--radius-2xl);
}
```

**Poker (coming soon):**
```css
.poker-table-surface {
  background: radial-gradient(ellipse at center, #1a3520 0%, #0f2014 60%, #07100a 100%);
  border: 2px solid rgba(244, 197, 66, 0.18);
  border-radius: var(--radius-2xl);
}
```

---

### 9j. Playing Cards

**Card dimensions:** 70px × 100px (small), 90px × 130px (standard), 110px × 155px (large)  
**Aspect ratio:** Always 1:1.4

```css
.playing-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  position: relative;
  transform-origin: bottom center;
  transition: transform var(--duration-base) var(--ease-spring);
}

/* Face-down card */
.playing-card--back {
  background: repeating-linear-gradient(
    45deg,
    #1a2a6c,
    #1a2a6c 3px,
    #0f1a4a 3px,
    #0f1a4a 12px
  );
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Suit colors */
.suit-red { color: #dc2626; }
.suit-black { color: #111111; }

/* Hover/selected */
.playing-card:hover {
  transform: translateY(-8px) scale(1.02);
}
.playing-card--selected {
  transform: translateY(-12px);
  box-shadow: 0 12px 32px rgba(245,158,11,0.4), 0 4px 12px rgba(0,0,0,0.4);
}
```

---

### 9k. Result Overlays

Result overlays must communicate outcome instantly. Color, icon, and text all carry the same signal.

```
Styles:
  WIN          → green gradient, "You Win!" 
  BLACKJACK    → gold gradient, "Blackjack!" 
  LOSE         → red gradient, "Dealer Wins"
  PUSH         → indigo gradient, "Push"
  BID_HIT      → green gradient, "Bid Made!" 
  BID_MISS     → gray gradient, "Bid Missed"
  TRICK_WIN    → green gradient, "Trick Won"
```

**Animation rules:**
- Enter: `scale(0.72) → scale(1.04) → scale(1)` + opacity 0→1, duration 350ms, `ease-spring`
- Exit: `scale(1) → scale(1.06) → scale(0.68)` + opacity 1→0, duration 280ms, `ease-in`
- No motion alternative: overlay appears without animation, fades with `opacity` transition only

---

### 9l. Scoreboard / Score Tracker

The score tracker is a spreadsheet-style game companion. It should feel precise and dense, not decorative.

**Design rules:**
- Use `font-variant-numeric: tabular-nums` on all score numbers
- Round headers: left-to-right pyramid (1, 2, 3... max... 3, 2, 1)
- Player avatars: colored circles with letter initials
- "Exact bid" highlight: gold accent on the player row
- Scroll horizontally for many rounds, sticky player names column
- No decorative shadows or gradients on the table itself

**Light mode:** white table cells, alternating row tint at 3% opacity, navy text.

---

### 9m. Banners & Alerts

```
Banner types:
  INFO    → blue tint, ℹ icon
  SUCCESS → green tint, ✓ icon
  WARNING → amber tint, ⚠ icon
  ERROR   → red tint, ✕ icon
```

```css
.banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  border: 1px solid;
}
.banner-success { background: var(--color-green-dim); border-color: rgba(34,197,94,0.2); color: var(--color-green); }
.banner-warning { background: var(--color-gold-dim); border-color: rgba(245,158,11,0.2); color: var(--color-gold); }
.banner-error   { background: var(--color-red-dim); border-color: rgba(244,63,94,0.2); color: var(--color-red); }
```

---

### 9n. Loading States

**Spinner (action loading):**
```css
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-gold-dim);
  border-top-color: var(--color-gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; border-top-color: var(--color-gold); }
}
```

**Skeleton (content loading):**
```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-bg-3) 0%,
    var(--color-bg-4) 50%,
    var(--color-bg-3) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; background: var(--color-bg-3); }
}
```

---

## 10. Per-Game Design Tokens

Each game has its own accent color. These are used for: card header accents, game table borders, button glow on game screens, and player color assignments.

Do NOT use game accent colors for global brand actions (nav links, primary CTAs on non-game screens).

| Game | Accent | Glow | Table surface base | Suit |
|------|--------|------|--------------------|------|
| Blackjack | `#e63946` (red) | red at 35% | `#1b4a2a` (green felt) | ♦ |
| Judgement | `#a78bfa` (violet) | violet at 35% | `#1a1035` (deep purple) | ♠ |
| Poker | `#f4c542` (warm yellow) | yellow at 30% | `#1a3520` (green felt) | ♠ |
| Teen Patti | `#f43f5e` (red) | red at 35% | `#1a1035` (deep purple) | ♥ |
| Rummy | `#a78bfa` (violet) | violet at 30% | `#1a2a3a` (navy) | ♣ |
| Solitaire | `#34d399` (teal) | teal at 30% | `#0f2420` (dark green) | ♠ |
| War | `#fb923c` (orange) | orange at 30% | `#2a1a0a` (dark brown) | ♦ |

---

## 11. Accessibility Requirements

**Non-negotiable:**
- All interactive elements: **≥ 44×44px touch target** (use padding if needed)
- All interactive elements: `:focus-visible` ring (2px gold, 2px offset)
- No `outline: none` without a replacement
- Color contrast: body text ≥ 4.5:1, large text ≥ 3:1, UI components ≥ 3:1
- No color-only encoding (game state, errors, success must have text/icon in addition)
- `prefers-reduced-motion`: all animations gated
- `prefers-color-scheme: dark`: default dark mode if no explicit toggle
- Modals: `role="dialog"`, `aria-modal="true"`, focus trap, `Escape` closes
- Cards: `role="article"` or equivalent semantic element
- Heading hierarchy: no skipped levels on any page

**Global focus style (add to every page's CSS):**
```css
:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 2px;
  border-radius: 2px;
}
```

---

## 12. Dark / Light Mode Toggle

**Implementation approach:**
- `data-theme="dark"` | `data-theme="light"` on `<html>` (or `:root`)
- Default: respect `prefers-color-scheme`
- Persist choice to `localStorage`
- Toggle button in navbar (far right, after nav items)

**Toggle component:**
```
[☀ ▌ ◐ ▐ ☾]  ← sliding pill toggle
```

Light mode: warm cream (#faf7f2), navy text, gold accents maintained.  
Dark mode: deep navy (#07091a), cream text, gold accents.

**CSS setup:**
```css
/* Default = dark */
:root { color-scheme: dark; }

/* Light override */
:root[data-theme="light"] { color-scheme: light; }

/* Auto-detect if no explicit choice */
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    /* Apply light mode variables */
  }
}
```

---

## 13. Responsive Breakpoints

```css
:root {
  --bp-mobile:  375px;
  --bp-sm:      480px;
  --bp-tablet:  768px;
  --bp-desktop: 1024px;
  --bp-wide:    1440px;
}
```

**Game grid:**
```css
.games-grid {
  /* Mobile: 1 column */
  grid-template-columns: 1fr;

  /* Tablet (≥ 600px): 2 columns */
  @media (min-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
  }

  /* Desktop (≥ 1024px): 3 columns */
  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }

  /* Wide (≥ 1440px): still 3 columns, cards just get wider */
}
```

**Hero:**
- Mobile: centered, headline at `clamp(2.2rem, 8vw, 3.5rem)`
- Tablet+: max-width 780px centered content
- Desktop+: full-bleed background, content centered

---

## 14. Icon System

Use **card suits as primary icons** (♠ ♥ ♦ ♣). These are Unicode characters — no library needed.

For other UI icons, use a consistent icon library (Phosphor Icons or Lucide). Size: 16px (sm), 20px (md), 24px (lg).

**Do NOT:**
- Use emoji as design elements (👥, 🚀, etc.)
- Mix icon libraries
- Use icons without labels on mobile
- Use icons in colored circles as decorative section elements (AI slop pattern)

**Player count display:**
```jsx
/* Instead of emoji */
<span className="meta-icon" aria-hidden="true">♟</span>
<span className="meta-value">{players} players</span>
```

---

## 15. Error States

**Empty states — must include:**
1. An illustration or large icon (suit character works)
2. A short human message (warm, not robotic)
3. A clear primary action

```
No rooms found
     ♠
   Create the first room and invite your friends.
[Create Room →]
```

**Error messages — must include:**
1. What happened (specific, not "An error occurred")
2. Why it happened (when known)
3. What to do next

```
"Couldn't connect to the game server. 
 Check your connection and try again.
 [Retry]"
```

---

## 16. Writing Style (Microcopy)

- **Button labels:** Specific action verbs. "Create Room" not "Confirm". "Start Playing" not "Continue".
- **Headings:** Short, strong, present tense. "Live Now" not "Currently Available".
- **Descriptions:** Second person, active voice. "Beat the dealer" not "The dealer must be beaten".
- **Empty states:** Warm and human. "No games running — start one." not "No items found."
- **Errors:** Specific and helpful. Never "Something went wrong."
- **Coming soon:** Create desire. "High-stakes poker coming soon." not "This game is not available yet."
- **Rules:** Numbered or bulleted, 1-2 sentences each. People skim rules.

---

## 17. What NOT to Do

1. Purple gradient backgrounds on the landing page
2. The 3-column icon-in-circle feature grid
3. Decorative blobs, wavy SVG dividers
4. Emoji as decorative elements (♠ ♥ ♦ ♣ are fine — they're thematic)
5. `transition: all` — enumerate properties
6. `outline: none` without a replacement focus style
7. Different primary CTA colors across pages (gold is always primary brand CTA)
8. Per-game CSS variable systems that duplicate globals
9. Centered everything — especially descriptions and body text
10. Identical border-radius on every element (buttons, cards, modals, chips are all different)
11. Cards for purely decorative purposes (every card must represent an interaction or a distinct content unit)
12. The Score Tracker icon-in-rounded-square — use text header treatment instead

---

## Appendix A: Quick Reference for New Games

When adding a new game:

1. Add game accent color to `--color-game-{name}` in `:root`
2. Create a game page header using the shared `.game-header` component with `--game-accent: var(--color-game-{name})`
3. Define a table surface using the template in Section 9k
4. Add to `LIVE_GAMES` or `COMING_SOON_GAMES` in `GamesGrid.jsx` with matching `accentColor`
5. Game-specific CSS goes in `src/styles/{GameName}.css`, but must reference global tokens, not hardcode values

---

## Appendix B: CSS Token Reference

```css
/* All global design tokens at a glance */
--color-*      Colors (see Section 3)
--font-*       Typefaces (see Section 4)
--text-*       Font sizes (see Section 4b)
--leading-*    Line heights (see Section 4c)
--space-*      Spacing scale (see Section 5)
--radius-*     Border radii (see Section 6)
--shadow-*     Shadows and glows (see Section 7)
--glow-*       Brand glows (see Section 7)
--ease-*       Easing curves (see Section 8)
--duration-*   Animation durations (see Section 8)
--bp-*         Breakpoints (see Section 13)
```
