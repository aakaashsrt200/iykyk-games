# Design Audit — IYKYK GAMES
**Date:** 2026-04-09  
**Pages reviewed:** Landing, Blackjack, Judgement Rooms, Judgement Scorer  
**Branch:** main  

---

## First Impression

The site communicates **a dark, premium card gaming arena**. The navy-and-gold palette reads immediately as "casino-grade" — this is intentional and mostly working.

I notice **the page opens cold, straight into the game grid with no brand moment**. There's no headline, no hook, no personality. You go: navbar → "LIVE NOW" → game cards. For a platform called "If You Know You Know", users don't get told what they know right away.

The first 3 things my eye goes to: **(1) the pulsing green "LIVE NOW" dot** (strong), **(2) the ♦ Blackjack suit icon** (card-red draws the eye), **(3) the IYKYK GAMES logo** (tertiary — it's too small for the brand moment it should be).

One word: **Functional.**

---

## Inferred Design System

| Property | Value | Assessment |
|----------|-------|------------|
| Fonts | Cinzel (display), Inter (body) | Cinzel = excellent for this theme. Inter = slightly generic. |
| Primary BG | `#07091a` (deep navy) | Perfect for dark gaming aesthetic |
| Brand Accent | `#f59e0b` (gold) | Strong, on-theme |
| Danger/Red | `#f43f5e` | On-theme for card suits |
| Judgement Accent | `#7c3aed` (purple) | Not connected to global system |
| Border-radius | 9px / 14px / 20px | Inconsistent — some elements very round, others not |
| Total unique colors | ~13 | Within acceptable range |
| Motion | Custom cubic-bezier + `transition: all` | Good intent, bad property specificity |

---

## Findings

### FINDING-001: Hero Section Removed from Landing Page
**Impact: HIGH**  
**Category: Visual Hierarchy**

`HeroSection.jsx` exists with a compelling "Play Like You Know You Know" headline, floating suit animations, and brand stats. It's imported in `App.jsx` but **never rendered** — the LandingPage component skips straight to `<GamesGrid />`.

The page has zero brand moment. Users land on a list of game cards with no context. A new visitor has no idea what IYKYK is or why they should play.

*Recommendation:* Add `<HeroSection />` above `<GamesGrid />` in the LandingPage component.

---

### FINDING-002: No H1 / Broken Heading Hierarchy
**Impact: HIGH**  
**Category: Typography, SEO, Accessibility**

The landing page has **no H1 at all**. The only headings on the page are `H3` (game names at 21.6px) and `H4` (footer labels at 12.8px). H1 and H2 are absent.

Screen readers announce headings for page structure. Search engines weight H1 for primary page keywords. A gaming platform with no H1 has no semantic content anchor.

Current hierarchy:
```
(no H1)
(no H2)
H3: Blackjack, Judgement, Poker... (game cards)
H4: Games, Platform, Company (footer)
```

Correct hierarchy:
```
H1: "Play Like You Know You Know" (hero headline)
H2: "Live Now" / "Coming Soon" (section labels)
H3: Game names
H4: Footer column labels
```

---

### FINDING-003: Rules "?" Buttons — Touch Targets 22×22px
**Impact: HIGH**  
**Category: Interaction States, Accessibility**

Every game card has a `?` rules button. Measured at **22×22px** — exactly half the WCAG 2.5.5 minimum of 44×44px.

On mobile, these are nearly impossible to reliably tap. The padding needs to increase the hit area even if the visual size stays compact.

```css
/* Current */
.rules-icon-btn { width: 22px; height: 22px; }

/* Fix */
.rules-icon-btn {
  min-width: 44px;
  min-height: 44px;
  padding: 11px;
  /* Keep visual icon size with inner positioning */
}
```

---

### FINDING-004: Fragmented CSS Variable Systems
**Impact: HIGH**  
**Category: Spacing & Layout, Consistency**

The app has **two separate CSS variable namespaces** that don't reference each other:

- `App.css`: `--gold`, `--red`, `--bg-primary`, `--border`, `--radius-md`, etc.
- `Judgement.css`: `--jdg-bg`, `--jdg-purple`, `--jdg-gold`, `--jdg-text`, etc.
- `JudgementScorer.css`: Hardcodes values like `#07091a`, `#f1f5f9`, `#7e90aa` directly — not using either system.

`--jdg-gold: #f59e0b` is the same value as `--gold: #f59e0b`. They're duplicated instead of shared. When the brand gold changes, it must be updated in multiple places.

*Recommendation:* Consolidate. Judgement CSS should extend global tokens, not duplicate them. Game-specific accents (`--jdg-purple`) are fine as per-game tokens, but core values (backgrounds, text, borders) must reference the shared system.

---

### FINDING-005: Judgement CTA Color Breaks Brand Identity
**Impact: HIGH**  
**Category: Color & Contrast, Consistency**

The Judgement rooms page uses **purple (#7c3aed) as the primary CTA** ("Create Room"). The landing page uses **gold (#f59e0b)** for all CTAs. The Judgement scorer uses **gold** for "Start Tracking →".

Within Judgement alone, the primary action alternates between purple and gold. Across the app, brand-level actions (navigation, primary form submissions) should use the brand color. Purple should be Judgement's *game accent* (cards, trump badges, player colors), not the CTA color.

---

### FINDING-006: Score Tracker Page — Icon in Rounded Square
**Impact: MEDIUM**  
**Category: AI Slop Detection**

The Judgement Scorer page shows the Score Tracker heading with an **icon-in-rounded-square** treatment (purple square + spade icon). This is a pattern flagged as AI-slop adjacent — it looks like a generic iOS app tile rather than something designed for this gaming platform.

The heading should either use the Cinzel display font treatment matching other game page headers, or use the suit character directly as a decorative element.

---

### FINDING-007: Emoji as Design Element in Game Meta
**Impact: MEDIUM**  
**Category: AI Slop Detection**

Every game card shows `👥 players` using an emoji icon. The "👥" silhouette reads as low-fidelity on a premium dark gaming interface. Emoji rendering varies across OS/browser, and it clashes with the refined suit symbols (♠ ♥ ♦ ♣) used elsewhere.

*Recommendation:* Replace with a small SVG icon or a styled text character. Or remove the label and just show the player count with a styled number.

---

### FINDING-008: No `prefers-reduced-motion` Support
**Impact: MEDIUM**  
**Category: Motion & Animation, Accessibility**

The app has multiple animations: `floatUp` (floating suits), `pulse-green` (live dot), `fadeInUp` (page entrance), `overlay-in/out` (result overlays), card dealing animations in Blackjack. None are wrapped in a `prefers-reduced-motion` media query.

For users with vestibular disorders who set this OS preference, the app ignores their request.

```css
@media (prefers-reduced-motion: reduce) {
  .float-suit { animation: none; }
  .games-group-dot { animation: none; }
  .animate-in { animation: none; }
  /* etc. */
}
```

---

### FINDING-009: Navbar Logo Touch Target — 38px Tall
**Impact: MEDIUM**  
**Category: Interaction States, Accessibility**

The navbar logo link (`<a href="/">`) measures **38px tall** — just below the 44px minimum. The entire navbar height is 68px but the clickable anchor only spans 38px of it.

*Fix:* Add `height: 44px; display: flex; align-items: center;` to `.navbar-logo`.

---

### FINDING-010: Coming Soon Cards — Missed Anticipation Opportunity
**Impact: MEDIUM**  
**Category: Content & Microcopy, Visual Hierarchy**

Coming soon cards use `opacity: 0.52` + `grayscale(0.2)` — they look broken/disabled, not *anticipated*. For a gaming platform that's planning to add Poker, Teen Patti, Rummy, Solitaire, and War, these are assets to tease, not cards to dim.

A locked/coming-soon state should feel exciting ("this is coming and you want it") rather than unavailable ("this doesn't work"). Consider a "notify me" CTA, a countdown, or a shimmer/anticipation treatment.

---

### FINDING-011: `transition: all` on Game Cards
**Impact: MEDIUM**  
**Category: Motion & Animation, Performance**

App.css defines `--transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1)` and it's applied to `.game-card`, `.btn`, `.game-btn` and others. `transition: all` triggers recalculation on every property change — layout, color, everything. This causes unnecessary paint cycles.

```css
/* Replace */
transition: var(--transition);

/* With */
transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
            box-shadow 0.28s cubic-bezier(0.4, 0, 0.2, 1),
            border-color 0.28s cubic-bezier(0.4, 0, 0.2, 1),
            opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1);
```

---

### FINDING-012: No Explicit `focus-visible` Ring
**Impact: MEDIUM**  
**Category: Interaction States, Accessibility**

Game buttons, rules buttons, and navbar links don't have an explicit `:focus-visible` ring defined. The browser default outline is often removed by CSS resets. Keyboard navigation is effectively invisible.

---

### FINDING-013: Navbar Has No Navigation Items
**Impact: MEDIUM**  
**Category: Visual Hierarchy, Content**

The navbar shows only the logo (left) and the "THE CARD GAME ARENA" badge (center). No navigation links, no "How to Play", no "Tournaments", no sign-in. As the platform grows to 6+ games, users need wayfinding.

Even a minimal "Games → " link would help. With planned future features like leaderboards and tournaments (seen in footer links), the navbar needs to anticipate this.

---

### FINDING-014: Small Footer Link Touch Targets
**Impact: MEDIUM**  
**Category: Interaction States, Accessibility**

Footer links like "Poker", "Blackjack" (footer nav) measure only **38px × 17px**. These are way below 44px minimum.

---

### FINDING-015: Judgement Rooms — Missing Loading / Empty State Design
**Impact: POLISH**  
**Category: Content & Microcopy**

When entering Judgement rooms, if the room list is empty or loading, there's no designed empty state. The `.room-loading` class exists with a spinner, but no empty-state message with a call to action ("No rooms yet — create the first one →").

---

### FINDING-016: Blackjack Chip Row Wraps on Mobile
**Impact: POLISH**  
**Category: Responsive Design**

On mobile (375px), the bet chip row ($5, $10, $25, $50, $100) wraps to two rows with the $100 chip centered alone on the second row. This looks unintentional. The chips should scroll horizontally or fit on one row.

---

## Design Score

| Category | Grade | Key Issue |
|----------|-------|-----------|
| Visual Hierarchy | C | No hero, no H1, cold landing |
| Typography | B | Cinzel excellent, heading hierarchy broken |
| Color & Contrast | B | Good palette, fragmented system |
| Spacing & Layout | B | Grid works, touch targets fail |
| Interaction States | C | No focus-visible, small targets |
| Responsive Design | B | Works but not optimized at tablet |
| Motion & Animation | B | Good intent, missing reduced-motion |
| Content & Microcopy | C | No hero copy visible, coming-soon is dim |
| AI Slop Detection | B | A few patterns (icon-in-square, emoji) |
| Performance | A | 272ms total load — excellent |

**Design Score: C+**  
**AI Slop Score: B** (not severe — the core aesthetic is original and on-theme)

---

## Quick Wins (< 30 min each)

1. **Restore HeroSection** — Add `<HeroSection />` to LandingPage in App.jsx. Zero CSS work needed.
2. **Fix "?" button touch targets** — 3 lines of CSS. Biggest accessibility win.
3. **Add `prefers-reduced-motion`** — 10-line CSS block in App.css.
4. **Replace emoji `👥`** — Swap for a small SVG or styled text character.
5. **Fix `transition: all`** — Enumerate specific properties. Performance improvement.
6. **Add `focus-visible` ring** — Global CSS rule, covers all interactive elements at once.

---

## PR Summary

Design review found 16 issues (6 high, 8 medium, 2 polish). Core problems: missing hero section on landing page, no heading hierarchy, undersized touch targets, fragmented CSS variable system. Design Score: C+.
