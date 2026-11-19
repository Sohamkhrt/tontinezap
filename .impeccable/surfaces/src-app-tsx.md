---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/components"]
---

# TontineZap app shell (home, create, circle dashboard + panels)

Scope: the whole PWA, every screen. Mode: Operate. Primary user: the circle organizer on a mid-range Android phone outdoors; secondary: members verifying; judges via phone video + laptop URL.
Task: run a round (see whose turn, who paid, pay shares, prove it), start the next round, bid, read the advisor, share the report.
Constraints: < 200 KB gz JS+CSS, sunlight legibility (AA+), FR/EN, offline, test-sats labelled, no invented claims.
New product facts carried by this build: circle type label (Tontine, Bhishi, Kameti, Chit, Tanda, Susu, Hui, Gye) and display currency (XOF default, INR), plus a second demo (Mumbai bhishi in ₹).

## Direction contract

THESIS: The pot travels the circle like a painted Dakar car rapide or an Indian truck: each member is a stop and a route board says who is next. Refuses the category default of a white wallet app with a balance card and one brand accent.

OWN-WORLD: Car-rapide yellow (#F5B700) owns the shell and the plates; ultramarine (#1C3FAA) route plates; ink (#141414) for text, the bottom bar and primary buttons with yellow lettering; cream (#FFFDF5) work ground; signal red (#D7261E) only for the pot numerals and overdue; truck green (#0F8A4B) only for paid ticks. Bungee sign-writer lettering for the wordmark, headings and money numerals; system sans for everything read or tapped. Panels are enamel plates: white with a 2px ink rim, 14px radius, no shadows.

STORY: The organizer sees at once whose turn it is, how much is in, and who still owes; taps Contribute; watches the tick land and the pot fill; when the round closes, the pot moves one stop down the route. The organizer believes nobody is holding the money and every payment is proven.

FIRST VIEWPORT: (dashboard, 390x844) Yellow header with the TONTINEZAP wordmark and FR/EN; the circle name and kind/frequency/amount line on yellow; a full-bleed ultramarine route plate with member stops (done = green tick, current = lit yellow, upcoming = outline) and a pot marker; on cream, "Next stop: Moussa · due 3 Dec", the pot in big red sign numerals with "of 1,141 FCFA · 2,000/3,000 sats" and a blue track; "CONTRIBUTIONS" rows with receipt N°, name, a one-line amount/time/proof, and a painted tick or an ink "Contribute 380 FCFA" button; ink bottom tab bar with the yellow active tab. Home: yellow header, a sign-lettered headline, the demo route plate as the hero object, the ink "Launch demo" button.

FORM: Painted Route Board (car rapide × truck-art sign painting), candidate 5 of 7 in the grounded list; seed: 4bccf6e377dae33b. Signature move: the route plate, a strip of member stops whose pot marker slides to the next stop when a round begins and whose current stop is lit. Raises: data text one ink on one ground, colour carries state only (Datamatics); one reserved route colour for the current stop only (orienteering); a painted receipt number on every payment, N° 0007 (catalog sleeve); amount, time and proof in one dense row (high-density web); paid shown as a painted tick on the member's row (event catalog). Motion grammar: one authored moment, the pot sliding stop to stop plus the tick landing; everything else instant; reduced motion holds still.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
