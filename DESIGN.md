---
name: TontineZap
description: Rotating savings circles on Lightning, painted like a Dakar car rapide route board.
colors:
  sun: "#f5b700"
  sun-deep: "#dfa500"
  sun-soft: "#fff0c2"
  route: "#1c3faa"
  route-deep: "#142f82"
  ink: "#141414"
  cream: "#fffdf5"
  paper: "#fbf3dc"
  card: "#ffffff"
  line: "#e6d9b0"
  muted: "#4a4636"
  signal: "#d7261e"
  signal-soft: "#fbe1de"
  paid: "#0f8a4b"
  paid-soft: "#dcf0e3"
typography:
  display:
    fontFamily: "Bungee, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "0em"
  pot-numeral:
    fontFamily: "Bungee Shade, Bungee, system-ui, sans-serif"
    fontSize: "3.4rem"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
  headline:
    fontFamily: "Bungee, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.25
  title:
    fontFamily: "Bungee, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.4
  plate-label:
    fontFamily: "Bungee, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    letterSpacing: "0.04em"
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
  meta:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.375
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
rounded:
  chip: "6px"
  tab: "8px"
  control: "12px"
  plate: "14px"
  full: "9999px"
spacing:
  gutter: "16px"
  row: "12px"
  card: "16px"
  card-sm: "20px"
  stack: "20px"
  stack-home: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sun}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "#2a2a2a"
  button-sun:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  button-sun-hover:
    backgroundColor: "{colors.sun-deep}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  button-secondary-hover:
    backgroundColor: "{colors.sun-soft}"
  button-ghost:
    textColor: "{colors.route}"
    padding: "12px 16px"
  button-danger:
    backgroundColor: "{colors.card}"
    textColor: "{colors.signal}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  button-danger-hover:
    backgroundColor: "{colors.signal-soft}"
  card-plate:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "16px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "48px"
  chip-good:
    backgroundColor: "{colors.paid}"
    textColor: "{colors.card}"
    rounded: "{rounded.chip}"
    padding: "2px 8px"
  chip-warn:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "2px 8px"
  chip-info:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "2px 8px"
  header:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.ink}"
    height: "64px"
  route-plate:
    backgroundColor: "{colors.route}"
    textColor: "{colors.cream}"
    padding: "12px 16px 16px"
  tab-bar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cream}"
  tab-active:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tab}"
    height: "52px"
---

# Design System: TontineZap

## Overview

**Creative North Star: "The Painted Route Board"**

The pot travels the circle the way a Dakar car rapide or an Indian goods truck travels its route: every member is a stop, and a hand-painted board says who is next. The shell is car-rapide body yellow, the route plate is ultramarine enamel, the lettering is sign-writer Bungee in ink, and the work happens on a cream ground in plain system sans. It deliberately refuses the category default of a white wallet app with a balance card and one brand accent.

Density is that of an operating tool, not a brochure. One dense row per payment carries a painted receipt number, the name, amount, time and proof. Colour carries state, never decoration: green means paid or confirmed, red means the pot numerals or something late or wrong, the yellow disc means "this stop, now". There are no shadows; depth is a 2px ink rim, the way an enamel sign is edged.

Motion is a single authored moment: the pot disc slides stop to stop when a round begins, and a painted tick lands when a share is paid. Everything else is instant, and reduced-motion users get a still board.

**Key Characteristics:**
- Yellow shell (header and title band), ultramarine route plate, cream work ground, ink bottom bar.
- Bungee for the wordmark, headings, plate labels, receipt numbers and the pot numerals; system sans for everything read or tapped.
- Enamel plates: white, 2px ink rim, 14px corners, no shadow.
- The route plate is the signature object on every circle screen and on Home.
- Thumb-first: 48px controls, a fixed bottom tab bar on phones.

## Colors

A painted-vehicle palette: one loud body yellow, one enamel blue, sign black, and two state colours kept on a short leash.

### Primary
- **Car-Rapide Yellow** (sun): the shell. The sticky header, the circle title band, the Home hero band, the active tab, the pot disc on the route plate, the round-complete plate, warn chips and the cash tick. Also the lettering colour on ink buttons and the plate title on blue. `sun-deep` is its hover/pressed tone; `sun-soft` is the pale wash for notice plates, row hover and the warn advisor notes.

### Secondary
- **Ultramarine Route Blue** (route): the route plate background, sign-lettered section headings on cream ("COTISATIONS", "My circles"), the pot progress fill, links and text buttons, inline icons beside headings, the focus ring, caret and native accent colour. `route-deep` is its reserved deep tone.

### Tertiary (state colours)
- **Signal Red** (signal): the pot numerals; overdue due dates and the "late" marker; validation errors; destructive actions (danger button, disconnect, remove); risk insights and risk toasts. Also the "ZAP" half of the wordmark. `signal-soft` is the wash behind risk notes and danger-button hover.
- **Truck Green** (paid): paid and confirmed only. The painted tick on a paid row, done stops on the route plate, the proof shield, the live-rate dot, the NWC-connected chip, good advisor insights. `paid-soft` is the wash behind good notes.

### Neutral
- **Sign Black** (ink): all body text, the 2px rims on plates and buttons, the bottom tab bar and the primary button.
- **Cream Ground** (cream): page background and the light lettering on blue and black.
- **Paper Well** (paper): recessed wells: the progress track, proof detail block, info chip.
- **Enamel White** (card): plate and row surfaces.
- **Rule Tan** (line): dividers between rows inside a plate, resting input border, idle radio-card border, upcoming-stop dots in Home's mini route.
- **Warm Muted** (muted): secondary text, metadata lines, receipt numbers (9:1 on cream per the source note).

### Named Rules
**The State-Only Colour Rule.** Green appears only for paid, verified or "good"; red only for the pot numerals, overdue, errors and destructive actions. Neither is ever used as decoration or brand fill.

**The One Lit Stop Rule.** The yellow pot disc marks the current stop and nothing else on the route plate. Done stops are green ticks, upcoming stops are blue discs with a cream outline.

**The One Ink, One Ground Rule.** Data text is ink on cream or white; secondary data is muted. Colour does not tint data text.

## Typography

**Display Font:** Bungee (self-hosted via @fontsource/bungee, latin 400), with system-ui fallback
**Shade Font:** Bungee Shade (self-hosted via @fontsource/bungee-shade), falling back to Bungee
**Body Font:** system sans stack (system-ui, -apple-system, Segoe UI, Roboto, Noto Sans)

**Character:** Bungee is sign-writer capitals: it paints the wordmark, headings and the money; the system sans stays out of the way for everything a person reads, types or taps, and costs no bytes.

### Hierarchy
- **Display** (Bungee 400, 2rem rising to 2.75rem from sm, line-height 1.08): the Home hero headline on yellow. `h1` and `h2` are Bungee by default with balanced wrapping.
- **Pot Numeral** (Bungee on phones, Bungee Shade from 640px, 2.4rem rising to 3.4rem, line-height 1, tabular): the amount collected, in signal red; the currency unit is set at 0.45em in ink Bungee beside it (₹ prefix set in heavy sans).
- **Headline** (Bungee 400, 1.2rem rising to 1.5rem; 1.75rem on Create): the circle name in the yellow title band, clamped to two lines.
- **Title** (Bungee 400, 1.125rem): section headings ("COTISATIONS" in route blue on cream; card headings in ink). The round-complete heading is 1.25rem.
- **Plate Label** (Bungee 400, 0.8rem, 0.04em tracking, yellow): the route plate title. Receipt numbers (N°0001, padded to four digits) are Bungee 0.7rem in muted.
- **Wordmark** (Bungee 1.4rem, leading none): "TONTINE" in route blue, "ZAP" in signal red.
- **Body** (sans 500, 1rem / 1.05rem for hero sub, max 46ch on Home): prose and button labels (buttons are 700).
- **Row Name** (sans 700, 1.05rem, tight): member name on a contribution row.
- **Meta** (sans 400, 0.8rem, muted): the one-line amount · time · proof under the name.
- **Label** (sans 600, 0.875rem): field labels, hints, chips (700), tab labels (0.75rem, 700).

### Named Rules
**The Sign-Writer Rule.** Bungee is for painted things only: wordmark, headings, plate labels, receipt numbers, avatar initials, stop initials and the pot. Never for paragraphs, inputs, buttons or metadata.

**The Sunlight Numeral Rule.** The pot is solid Bungee on phones for outdoor legibility; the painted drop-shade (Bungee Shade) only appears at 640px and up.

**The Unbroken Amount Rule.** Every amount is non-wrapping and tabular (`amt`), so "379 FCFA" never splits across lines.

## Layout

Single column, phone first, 16px side gutter. Containers are 48rem wide; on the circle screen the header, title band, route plate, tab strip and content widen to 72rem from 1024px.

- **Shell order (circle screen):** sticky yellow header (64px, 2px ink rule below) → yellow title band with back arrow, circle name, "kind · frequency · amount" line and a test-sats chip → full-bleed route plate between 2px ink rules → tabs → content.
- **Tabs:** a five-up grid (Round, Bid, Advisor, Report, Group) with icon over label. Below 640px it is a fixed bottom tab bar in ink with safe-area padding; from 640px it becomes a sticky strip directly under the header (top 64px). The page reserves bottom padding (7rem on phones, 3rem from sm) so the bar never covers content.
- **Round tab, ≥1024px:** two columns at 5fr / 7fr. Left: the pot block (current stop, due date, numeral, progress, round-complete plate, pay steps), sticky under the tab strip. Right: the contributions plate and "pay all".
- **Rhythm:** 20px between blocks on the circle screen, 32px between sections on Home, 16px between plates on Create. Plates pad 16px (20px from sm); list rows pad 12px (16px horizontally from sm).
- **Home:** yellow hero band (headline + sub) → demo route plate as the hero object → ink "Launch demo" button and a white secondary demo button (stacked on phones, side by side from sm) → trust line with blue icons → circle list plate → create/join plate.
- **Long routes:** with more than six stops the route plate scrolls horizontally at 68px per stop and auto-centres the current stop.

## Elevation & Depth

Flat. Depth is drawn, not cast: plates, rows, buttons and the header carry a 2px ink rim or rule, and recessed areas use the paper tone. The only glow is on the pot disc, a 5px translucent yellow halo that reads as a lit lamp, not a shadow.

### Shadow Vocabulary
- **Pot halo** (`box-shadow: 0 0 0 5px rgb(245 183 0 / 0.35)`): the pot disc on the route plate only.

### Named Rules
**The Enamel Rim Rule.** Surfaces separate with a 2px ink border and a colour change, never a drop shadow.

## Shapes

Gently rounded enamel. Plates 14px; buttons, inputs, radio cards and notes 12px; tabs 8px; chips 6px; stop discs, avatars, the pot disc, ticks and progress bars fully round. Borders are 2px ink on plates and buttons, 3px on the stop and pot discs (cream on stops, ink on the pot). Dividers inside a plate are 2px tan rules. Inputs rest on a 2px tan border.

## Components

### Buttons
Painted, heavy and thumb-sized.
- **Shape:** 12px corners, minimum 48px tall (56px for Home's demo buttons), 16px horizontal padding, bold 1rem labels, icon gap 8px.
- **Primary:** ink with yellow lettering ("Contribute 379 FCFA", "Launch demo", "Start next round"). Hover lifts to #2a2a2a. Disabled is muted at 50% with cream text.
- **Sun:** yellow with a 2px ink rim; used for "Pay all". Hover goes to sun-deep.
- **Secondary:** white with a 2px ink rim; hover washes sun-soft.
- **Ghost:** route-blue underlined text (2px decoration, 4px offset); hover turns the underline yellow.
- **Danger:** white, red text, 2px red rim; hover washes signal-soft.
- **Press:** every button scales to 0.98 on press; loading shows a spinning loader and disables the button.

### Chips
- **Style:** 6px corners, 2px × 8px padding, 0.875rem bold. Good = green with white; warn = yellow with ink ("demo"); risk = red with white; info = paper with ink and a tan hairline ("test sats", "no wallet").

### Cards / Containers (Enamel Plates)
- **Corner Style:** 14px.
- **Background:** white; notice plates use sun-soft; the round-complete plate is yellow.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 2px ink.
- **Internal Padding:** 16px, 20px from sm. List plates (contributions, my circles) use internal 2px tan dividers with 12–16px row padding.

### Inputs / Fields
- **Style:** white, 2px tan border, 12px corners, 48px minimum height, 1rem text, muted placeholder at 70%.
- **Focus:** the border turns route blue (keyboard focus also gets the global ring).
- **Label / hint / error:** label 0.875rem semibold ink above; hint 0.875rem muted below; error 0.875rem semibold red with `role="alert"`.
- **Radio cards (Create, circle type):** 12px corners, 2px border; selected is yellow with an ink rim, idle is white with a tan rim that turns ink on hover.

### Navigation
- **Header:** sticky yellow bar, 64px, ink rule below. Left: the wordmark with a "1 000 sats ≈ … FCFA" line and a rate dot (green when live, cream when cached/offline). Right: an offline icon when offline and the FR/EN toggle, an ink pill with the pressed language in yellow.
- **Tab bar:** ink, five tabs, 0.75rem bold labels under 20px icons, 52px tall, 8px corners. Active tab is a yellow block with ink text; idle tabs are cream at 80% and turn yellow on hover. Fixed to the bottom on phones, sticky under the header from 640px.
- **Offline strip:** ink band with yellow semibold text under the header.

### Contribution Row
One dense row per member: a Bungee receipt number column (3.6rem wide, "N°0007", or "—" if unpaid), name in bold, then a single meta line "amount · date time · proof" with a green shield when Lightning-verified, or the red "late" marker, or the member's balance. The trailing slot is either the painted tick (36px green disc, white check, 2px ink rim; yellow with a banknote for cash) which lands with the `pop` animation, or an ink "Contribute" button. Under the row: a blue "record cash payment" link and an expandable "Proof" block in a paper well with mono hashes.

### Route Plate (signature)
A full-bleed ultramarine band painted like a car-rapide destination board. A yellow Bungee title ("POT ROUTE · ROUND 1 / 4"), then an ordered list of stops on a 4px cream rail (45% opacity). Each stop is a 40px disc: done = green with a 3px cream rim and a white check; current = lit by the yellow pot disc (3px ink rim, 5px yellow halo) with an ink initial and the name in yellow; upcoming = blue with a 3px cream rim and a cream Bungee initial. Names sit below in 0.75rem bold, truncated. The current stop carries `aria-current="step"`; screen-reader text marks done (✓) and current (→). An optional caption ("Next stop: Moussa") follows.

**Motion:** the pot disc is a single element translated along the rail; when a round begins it slides to the next stop over 0.9s on `cubic-bezier(0.16, 1, 0.3, 1)`. Paid ticks and the round-complete plate land with `pop`: 0.5s from scale 0.6, rotate −12°, 30% opacity to rest, same easing. The progress fill eases its width over 700ms. Under `prefers-reduced-motion: reduce` all animation and transition is removed.

### Pot Block
"Current stop: Awa receives the pot" with the due date (calendar icon, muted or red when overdue), the red pot numeral, a muted "of 1 137 FCFA · 1 000 sats / 3 000 sats" line, and a 14px progress bar: paper track, 2px ink rim, route-blue fill.

### Avatar
40px (56px large) round initial in Bungee with a 2px ink rim, colour picked deterministically from route, sun, signal and ink.

### Toast
Bottom-centred, max 28rem, 12px corners, 1rem medium text with a leading icon; good = ink with white, warn = yellow with ink, risk = red with white. Announced via `aria-live="polite"`, auto-dismissed after 5s, at most three.

## Do's and Don'ts

### Do:
- **Do** keep the shell yellow (sun) and the work ground cream; put every circle's route on an ultramarine route plate between 2px ink rules.
- **Do** build containers as enamel plates: white, 2px ink border, 14px corners, no shadow.
- **Do** set money in the pot as red Bungee numerals with the unit smaller in ink, and keep every amount non-wrapping and tabular.
- **Do** make primary actions ink buttons with yellow lettering, at least 48px tall.
- **Do** give every payment a painted receipt number (N° plus four digits) and keep amount, time and proof on one line.
- **Do** keep the 3px route-blue focus ring (yellow on ink or blue surfaces via `on-dark`) on every interactive element.
- **Do** keep motion to the pot slide and the tick landing, with `cubic-bezier(0.16, 1, 0.3, 1)`, and hold still under reduced motion.

### Don't:
- **Don't** use green for anything that is not paid, verified or good, or red for anything that is not the pot, overdue, an error or a destructive action.
- **Don't** put the yellow pot disc, or any second yellow highlight, on a stop other than the current one.
- **Don't** set paragraphs, buttons, inputs or metadata in Bungee; it is sign lettering only.
- **Don't** use Bungee Shade below 640px.
- **Don't** add drop shadows to plates, rows or buttons.
- **Don't** fall back to the white wallet app with a balance card and a single brand accent.
