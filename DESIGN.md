---
version: alpha
name: CMatch
description: >
  CMatch is a calm, minimal patient-practitioner matching interface for Chinese Medicine.
  The visual language avoids shadows and heavy borders in favor of warm creams, deep forest greens,
  and subtle sage accents. Every surface feels organic, trustworthy, and unhurried.
colors:
  background: "#fffdf7"
  surface: "#ffffff"
  surface-muted: "#f4f9f5"
  primary: "#12372f"
  primary-hover: "#2d7a4f"
  primary-muted: "#e3f0e5"
  accent: "#b58a44"
  text: "#1a1a1a"
  text-muted: "#6b6b6b"
  border: "rgba(222, 213, 196, 0.55)"
  success: "#c8e1cc"
  warning: "#fef3cd"
  warning-text: "#856404"
  danger: "#f8d7da"
  danger-text: "#721c24"
  info: "#d1ecf1"
  info-text: "#0c5460"
  sage: "#e8f0e9"
typography:
  font-family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
  hero:
    fontFamily: "{typography.font-family}"
    fontSize: 26px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  heading:
    fontFamily: "{typography.font-family}"
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.01em
  title:
    fontFamily: "{typography.font-family}"
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "{typography.font-family}"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "{typography.font-family}"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "{typography.font-family}"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "{typography.font-family}"
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.03em
rounded:
  reference: "24px diameter circle = 12px radius"
  formula: "min(width, height) / 2, capped at 24px"
  tail: 4px
  chip: 16px
  input: 20px
  bubble: 20px
  tag: 12px
  badge: 10px
  match-band: 11px
  banner: 24px
  panel: 24px
  card: 24px
  drawer: 24px
  circle: 50%
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px
  4xl: 48px
components:
  chat-panel:
    background: "{colors.surface}"
    border: "1px solid {colors.border}"
    borderRadius: "24px"
    maxWidth: 680px
    height: 460px
  chat-bubble-user:
    background: "{colors.primary}"
    color: "#ffffff"
    borderRadius: "20px"
    borderBottomRightRadius: "4px"
    padding: "10px 14px"
    fontSize: "{typography.body.fontSize}"
  chat-bubble-ai:
    background: "{colors.background}"
    color: "{colors.text}"
    border: "1px solid {colors.border}"
    borderRadius: "20px"
    borderBottomLeftRadius: "4px"
    padding: "10px 14px"
    fontSize: "{typography.body.fontSize}"
  input:
    background: "{colors.background}"
    color: "{colors.text}"
    border: "1px solid {colors.border}"
    borderRadius: "20px"
    padding: "10px 44px 10px 14px"
    fontSize: "{typography.body.fontSize}"
    focusBorder: "{colors.primary-hover}"
  button-primary:
    background: "{colors.primary}"
    color: "#ffffff"
    borderRadius: "20px"
    hoverOpacity: 0.85
  button-chip:
    background: "{colors.background}"
    color: "{colors.text-muted}"
    border: "1px solid {colors.border}"
    borderRadius: "16px"
    padding: "8px 14px"
    fontSize: "{typography.caption.fontSize}"
    hoverBorder: "{colors.primary-hover}"
    hoverColor: "{colors.primary}"
  card:
    background: "{colors.surface}"
    border: "1px solid {colors.border}"
    borderRadius: "24px"
    padding: "20px"
  drawer:
    background: "rgba(255, 253, 247, 0.96)"
    border: "1px solid {colors.border}"
    borderRadius: "24px"
    backdropFilter: "blur(18px) saturate(1.12)"
  tag-filled:
    background: "{colors.sage}"
    color: "{colors.primary}"
    borderRadius: "12px"
    padding: "5px 12px"
    fontSize: "{typography.small.fontSize}"
  tag-missing:
    background: "rgba(18, 55, 47, 0.04)"
    color: "{colors.text-muted}"
    borderRadius: "12px"
    padding: "5px 12px"
    fontSize: "{typography.small.fontSize}"
  badge-match-strong:
    background: "{colors.success}"
    color: "{colors.primary}"
    borderRadius: "11px"
    padding: "4px 12px"
    fontSize: "{typography.label.fontSize}"
    textTransform: uppercase
  badge-match-good:
    background: "{colors.warning}"
    color: "{colors.warning-text}"
    borderRadius: "11px"
    padding: "4px 12px"
    fontSize: "{typography.label.fontSize}"
    textTransform: uppercase
  badge-match-possible:
    background: "{colors.info}"
    color: "{colors.info-text}"
    borderRadius: "11px"
    padding: "4px 12px"
    fontSize: "{typography.label.fontSize}"
    textTransform: uppercase
---

## Overview

CMatch is a patient-to-practitioner matching interface for Chinese Medicine in Hong Kong.
The design philosophy is **calm, minimal, and organic** — no drop shadows, no heavy borders,
no aggressive contrast. Surfaces float on a warm cream background using subtle 1px borders
and soft sage tints. The brand color is a deep forest green (`#12372f`) that evokes nature,
trust, and tradition.

All UI elements should feel unhurried and gentle. Use purposeful animation for entrances
(250–500ms) and quick, subtle feedback for interactions (160ms).

## Colors

**Primary palette**
- `primary` `#12372f` — Deep forest green. Used for key headings, active states, the send button, and user chat bubbles. The brand anchor.
- `primary-hover` `#2d7a4f` — Lighter green for focus rings, hover accents, and input focus borders.
- `primary-muted` `#e3f0e5` — Very light green for avatars and subtle highlights.

**Backgrounds**
- `background` `#fffdf7` — Warm cream. The global page background.
- `surface` `#ffffff` — Pure white for cards, chat panels, and understanding panels.
- `surface-muted` `#f4f9f5` — Soft mint-cream for hover states and subtle fills.
- `sage` `#e8f0e9` — Light sage for filled schema tags and success-adjacent surfaces.

**Text**
- `text` `#1a1a1a` — Near-black for primary text.
- `text-muted` `#6b6b6b` — Warm gray for secondary text, meta data, captions.

**Borders**
- `border` `rgba(222, 213, 196, 0.55)` — Warm, barely-there border color used on nearly every card, panel, and input.

**Semantic**
- `success` / `danger` / `warning` / `info` — Used only for safety banners, confidence badges, and match-quality chips. Never use semantic colors for primary branding.

**Accent**
- `accent` `#b58a44` — Warm gold. Reserved for future premium or highlighted moments; use sparingly.

## Typography

The type system uses the system sans-serif stack for maximum clarity and native feel.

**Scale**
- Hero: `26px`, weight 700, letter-spacing `-0.02em`
- Heading: `16px`, weight 700
- Title: `15px`, weight 700
- Body: `14px`, weight 400, line-height `1.5`
- Small: `13px`, weight 400
- Caption: `12px`, weight 500
- Label: `11px`, weight 600, uppercase, letter-spacing `0.03em`

**Rules**
- Headings are always in `primary` green, never pure black.
- Body text is `text` (#1a1a1a) on light surfaces and `#ffffff` on dark green surfaces.
- Never use more than two weights on a single screen.
- Numeric data should use `tabular-nums` where aligned columns are needed.

## Layout

**Container widths**
- Main content max-width: `720px`, centered.
- Panels and chat max-width: `680px`.
- Side drawer width: `min(280px, calc(100vw - 28px))`.

**Spacing rhythm**
- Base unit is `4px`. All spacing values are multiples of 4.
- Common values: 4, 8, 12, 14, 16, 18, 20, 24, 48px.

**Responsive**
- Breakpoint at `640px`. On mobile:
  - Reduce page padding to `16px`.
  - Shrink chat panel height to `400px`.
  - Reduce large radii from `20px` to `16px`.
  - Stack match card headers vertically.

## Elevation & Depth

**No drop shadows.** CMatch achieves hierarchy through:
1. Background color shifts (cream → white)
2. 1px subtle borders
3. Backdrop blur on the drawer only (`blur(18px) saturate(1.12)`)

This is a hard rule. Do not introduce `box-shadow` for cards, panels, or buttons.

## Shapes

**Proportional radius system**

The base reference is a **24px diameter circle** (radius = `12px`).  
Every element’s border-radius is proportional to its own smallest dimension, **capped at 24px** (the card/panel maximum):

> **`border-radius = min(min(width, height) / 2, 24px)`**

This means small elements become pills while large containers stay softly rounded without turning into stadiums.

**Reference values**

| Element | Typical min dimension | Raw half | Capped radius |
|---|---|---|---|
| Menu dot, send button, avatar | 12–32px | — | `50%` (true circles) |
| Thinking dot | 6px | — | `50%` |
| Scrollbar thumb | 4px | — | `50%` |
| Confidence badge | 20px | 10px | `10px` |
| Schema tag | 24px | 12px | `12px` |
| Match band, reason tag, caution tag | 22px | 11px | `11px` |
| Quick-pick chip | 32px | 16px | `16px` |
| Chat bubble, text input, drawer link | 40px | 20px | `20px` |
| Match error, safety banner | 40–50px | 20–25px | `20–24px` |
| Match card | ~200px | 100px | **24px (cap)** |
| Understanding panel | ~350px | 175px | **24px (cap)** |
| Chat panel | 460px | 230px | **24px (cap)** |
| Side drawer | 280px | 140px | **24px (cap)** |

**Tail corners**
Chat bubble tails remain sharp at `4px` as a stylistic exception.

**Circle rule**
Only perfectly square elements (`1:1` aspect ratio) may use `50%`. All other rectangles use the capped proportional formula.

## Components

**Chat Panel**
- White surface, 1px warm border, `24px` radius (capped maximum).
- Fixed height `460px` (desktop), `400px` (mobile).
- No header bar. Messages scroll with a thin custom scrollbar (`50%` circle thumb).

**Chat Bubbles**
- User: `primary` green background, white text, `20px` radius with sharp bottom-right tail (`4px`).
- AI: cream background, 1px border, `20px` radius with sharp bottom-left tail (`4px`).
- Max-width `80%` (desktop), `88%` (mobile).

**Understanding Panel**
- White surface, 1px border, `24px` radius (capped maximum).
- Category rows separated by 1px border.
- Tags animate in with a `350ms` scale pop (`cubic-bezier(0.16, 1, 0.3, 1)`).

**Schema Tags**
- Filled: `sage` background, `primary` text, `12px` radius (pill-like on ~24px height).
- Missing: `rgba(18, 55, 47, 0.04)` background, `text-muted`, italic, `12px` radius.

**Match Cards**
- White surface, 1px border, `24px` radius (capped maximum), `20px` padding.
- Header: practitioner name (`16px` bold, `primary`) + clinic name (`13px` muted).
- Match band: `strong-match` (green), `good-match` (yellow), `possible-match` (blue); all use `11px` radius.
- Reason tags: `primary-muted` background, `primary` text, `11px` radius.
- Caution tags: `warning` background, `warning-text`, `11px` radius.

**Side Drawer**
- Fixed, inset `14px` from viewport edges.
- Cream background at `96%` opacity with backdrop blur.
- `24px` radius (capped maximum).
- Nav links: `14px`, weight 500, `20px` radius, full width.
- Active/hover state: `primary-muted` background, `primary` text.

**Text Input**
- Cream background, 1px border, `20px` radius (perfect pill on 40px height).
- Focus: border switches to `primary-hover`.
- Send button: absolute, inside the input, `32px` circle (`50%`), `primary` background.

**Quick-Pick Chips**
- Cream background, 1px border, `16px` radius (pill-like on ~32px height).
- Hover: border switches to `primary-hover`, text to `primary`.

## Do's and Don'ts

- **Do** use the `primary` green only for the most important action per screen (send button, active nav, hero heading).
- **Don't** use drop shadows anywhere. Use borders and background color to create depth.
- **Do** maintain generous whitespace. The interface should breathe.
- **Don't** use arbitrary spacing values. Stick to the 4px base grid.
- **Do** follow the proportional radius formula: `border-radius = min(min(width, height) / 2, 24px)`.
- **Don't** use `999px`. The capped proportional formula already produces pills for small elements without distorting large containers.
- **Do** use `50%` only for true circles (elements with a `1:1` aspect ratio).
- **Don't** mix sharp and rounded corners on the same element or in the same container.
- **Do** use semantic colors exclusively for safety banners, confidence badges, and match bands.
- **Don't** use semantic colors for primary branding or decorative elements.
- **Do** animate entrances with `cubic-bezier(0.16, 1, 0.3, 1)` and a 250–500ms duration.
- **Don't** animate layout properties that cause reflow (width, height, margin).
- **Do** keep all borders at `1px` and use the warm `rgba(222, 213, 196, 0.55)` color.
- **Don't** introduce heavy or high-contrast borders.
- **Don't** use internal divider lines (`border-top`, `border-bottom`, `hr`, etc.) inside components unless explicitly requested. Use whitespace and background color shifts to separate sections instead.
