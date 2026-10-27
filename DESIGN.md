# proofofheika — Design System (proposal v0)

Status: built as a static prototype (home, projects, events, blog, one sample post). Projects, events and blog entries are placeholders. Hex values are my choices, not sourced: the pigment research returned no swatches.

## 1. Concept

**An engraver's proof, set in monospace.** "Proof" is the site's double meaning: a printer's proof sheet (the first pull, checked before the edition) and proof of work. A Renaissance folio supplies proportion, rubrication, marginalia and numbered folios. A character-cell grid supplies the engine and the texture. The two meet at one fact: engraving shades with line direction and density, and ASCII shades with glyph direction and density.

One image carries the home page: the hands from Michelangelo's *Creation of Adam*, almost touching. The left hand (Adam) is classical, the fresco itself in ink-on-vellum duotone. The right hand (God) is the same fresco turned into hatching glyphs on a cell canvas. The gap between the fingertips is the whole site: classical on one side, ASCII on the other, never quite meeting. Everything else stays quiet. This is the daoho.dev idea (living ASCII canvas behind a calm text column) with a different subject and a different typographic voice.

Mode: Experience (portfolio). The artifact leads, the interface recedes.

## 2. What the reference does (measured on daoho.dev)

- Light `#f5f4f1` on `#262523`, muted text = foreground at 64% via `color-mix`. Dark mode is a near-black warm grey with one orange accent (koi).
- Geist Mono for everything, 15px/23px body, 13px lowercase nav, fixed and centered, inactive items at 50% opacity, 150ms opacity transitions.
- Home is a single full-bleed `<canvas>` of square character cells (a grid of pixels with a glyph in each). The text column floats over it, and the canvas steers around text (`data-koi-avoid`).
- Page changes use View Transitions: 0.65s `cubic-bezier(0.65,0,0.35,1)`, forward drifts left, back slides out. Theme switch is a radial mask reveal from the toggle, 0.8s.
- Projects is a horizontal scroller of large screenshots with a name, season tag and one-line description.
- Copy is one line per fact, with inline underlined links.

Keep: canvas-behind-text, monospace chrome, muted-opacity nav, view-transition navigation, radial theme reveal, one-line project captions.
Change: subject (an engraved object, not koi), typographic voice (Garamond joins the mono), palette (vellum and iron-gall ink, not grey), and the grid (proportioned page, not fluid).

## 3. Color

One accent, used the way a scribe used red: for initials and marks, never for fills.

| Token | Light (vellum) | Dark (umber) | Use |
|---|---|---|---|
| `--paper` | `#EFE9DA` | `#15120F` | page |
| `--ink` | `#211D18` | `#E7DEC9` | text, rules, hatching |
| `--ink-muted` | ink at 62% | ink at 62% | captions, inactive nav (use `color-mix`, as the reference does) |
| `--ink-faint` | ink at 14% | ink at 16% | hairlines, quiet cells |
| `--rubric` | `#A8321E` | `#D4573C` | drop cap, folio numerals, active mark, one hover state |

Rules: the accent covers under 5% of any screen. No gradients. No paper texture image and no aged-edge effects (reads as costume). Lapis blue and gold leaf were considered and dropped as a second accent; add one only if a real need appears.

Contrast: verify `--rubric` on `--paper` at 4.5:1 for text use before shipping. Dark rubric is lifted for that reason.

## 4. Typography

Two voices, strict roles.

- **Prose and display: Michelangelus first, EB Garamond as the fallback.** Michelangelus (Studiogusto, shipped by Microsoft, described as inspired by Michelangelo's handwriting) matches the concept by name and character. Microsoft's redistribution FAQ says Windows-supplied fonts may be named in a CSS font stack but may not be self-hosted or converted to WOFF/WOFF2. Michelangelus is a separate download whose own licence I could not confirm. So the stack is `"Michelangelus", "EB Garamond"`: it renders where installed (not installed on this machine, so I have not seen it) and everyone else gets EB Garamond from Google Fonts. Self-hosting needs a web licence from the foundry first. Used for the name, page titles, blog body, pull lines, drop caps.
- **Chrome and data: Fragment Mono** (Google Fonts, neutral). Used for nav, dates, tags, folio numbers, figure labels, the canvas.

Scale (perfect fourth, hand-rounded), in px:

| Step | Size / line | Voice | Use |
|---|---|---|---|
| mono-s | 12 / 18 | mono | dates, tags, folio |
| mono-m | 13 / 20 | mono | nav |
| body-mono | 14 / 22 | mono | home intro lines (matches the reference's feel) |
| prose | 18 / 29 | Garamond | blog body, about |
| title-s | 24 / 30 | Garamond italic | project and post titles |
| title-m | 32 / 38 | Garamond | page titles |
| display | 56 / 58 | Garamond | name on home, optional |

Measure: 58–66ch for prose. Lowercase for nav, as the reference does. Old-style figures (`font-variant-numeric: oldstyle-nums`) in Garamond prose, tabular lining in mono.

## 5. Layout and proportion

- Mono cell: 8 x 16px at base size. All vertical rhythm snaps to the 16px line, so the canvas grid and the text grid share one lattice.
- Page frame: margins follow the 2 : 3 : 4 : 6 (inner : top : outer : bottom) canon from book design, applied as `clamp()` values around a single centered column. This is a loose Van de Graaf-style page, and I have not verified its historical details beyond general book-design practice.
- Text column: 62ch max, left-aligned with a fixed inset (the reference puts it at roughly one fifth of the viewport).
- Marginalia: at 1100px and up, blog sidenotes and figure captions sit in the outer margin. Below that they collapse inline under the paragraph.
- Dividers: 1px `--ink-faint` rules, plus one fleuron-like ornament `* * *` or `❦` as a section break. No boxes, cards or shadows.
- Mobile: single column, 16px gutters, nav becomes a horizontal row of four items.

## 6. The ASCII layer

- **Ramp (as built).** The right hand uses a 14-step light-to-dense ramp, `. , : ; i l t f L C G 0 8 @`, at roughly 4–8px cells. A fine ramp reads as continuous tone, which matches the reference image you sent. The earlier hatching-direction idea (`/ \ x X #`) read as noise at this size and was dropped.
- **Subject (decided):** the hands of *The Creation of Adam* (Sistine Chapel, 1508–12). Adam is on the left, God on the right, as in the fresco, so the brief maps directly: left = classical, right = ASCII.
- **Left half, classical (as built):** the real fresco in full colour, cut out of the wall with an alpha matte derived from the painting (skin is warmer than the cream wall in CIELAB), so only the hand and forearm remain. No glyphs, no texture overlay. Pipeline: `tools/make_hands.py` cuts the hands from the 14090px scan (Wikimedia Commons, CC0) into `assets/hands.webp` at 3× the original detail, with the matte built at a coarser scale and edge colours pulled in from the skin so no wall fringe survives. Rerun it if the crop changes. It fades into the page at the outer edge.
- **Framing (as built):** zoomed to the hands, like your reference. Each hand is cropped on its own, with the same amount of forearm showing on both sides, and the fingertips are pushed apart by `EXTRA_GAP` (60 source px, about 12% of the width at desktop). Change that constant to widen or close the gap.
- **Right half, ASCII (as built):** the same cutout, with alpha as coverage and luminance as tone. Dark theme: lit skin is denser (chalk on slate). Light theme: a firmer floor keeps the silhouette readable on vellum. A bright outline keeps the hand crisp. Shading uses an unsharp mask (each cell is pushed away from its neighbourhood mean), so knuckles, nails and finger gaps read as light and dark rather than flat tone. Fade to empty at the outer edge.
- **The seam:** the fingertips sit just left and right of the page's vertical center, about 3 cells apart. Cells in the gap are blank except one `·` in `--rubric` that pulses slowly (the spark). The two renderings cross-dissolve over roughly the 6 cells either side of the gap, so the left hand gains a few glyphs near the fingertip and the right hand keeps some continuous tone.
- **Interaction (the cursor is the lamp):** cells around the pointer brighten or darken along the ramp and settle back over ~400ms. As the pointer nears the gap the spark brightens. Neither hand moves, so the gap never changes. Touch devices get a slow idle drift of the lamp instead.
- **Placement:** hands sit in the upper 40% of the viewport, full bleed. The intro text column sits below, as on the reference. At mobile width the crop shifts to center on the gap and the outer arms crop away.
- **Source image:** *Creation of Adam (cropped)* on Wikimedia Commons, tagged public domain (author d. 1564, published before 1931 for US purposes). Commons notes reuse in some jurisdictions can be restricted for PD-Art photographs, so I'd keep the credit in the colophon.
- **Rubrication on canvas:** a handful of cells (under 3%) in `--rubric`, the same role as the koi's orange.
- **Avoid zones:** the canvas dims behind the text column to protect legibility.
- Implementation: Canvas 2D with a cell grid (no WebGL needed at this scale), DPR-aware, `IntersectionObserver` pause off-screen, static single frame under `prefers-reduced-motion`. Measured 60fps on a 992px-wide viewport. See `hero.js`; the prototype is plain HTML/CSS/JS with no build step, so it ports into Next.js unchanged. The Codrops article on ASCII and dithering shows the same cell-grid approach in WebGL if more is ever wanted.

## 7. Information architecture

Navigation is plain lowercase words with a roman folio numeral beside the active one. Plain labels keep it usable, and the numerals carry the codex flavor.

| Folio | Route | Name | Content |
|---|---|---|---|
| i | `/` | home | Engraved canvas, a rotating line, the short intro with the About text beneath. About lives here, as on the reference. |
| ii | `/projects` | projects | Horizontal scroll of plates. Each: image, title (Garamond italic), season tag (mono), one line. |
| iii | `/events` | events | Chronological list, newest first: date (mono), title, place, role (speaking, hosting, attending), link. Past and upcoming split by a fleuron. |
| iv | `/blog` | blog | Index as a table of contents with dotted leaders (`title ........ date`). Posts in Garamond with marginal notes and a rubricated first letter. |

Footer (every page): colophon line in mono: "Set in EB Garamond and Fragment Mono." plus the social links.

## 8. Components

- **Nav:** fixed, centered, mono-m lowercase, 32px gap. Inactive at 50% opacity, 150ms to 100% on hover or focus. Active item gets a `--rubric` folio numeral. A sun/moon toggle sits last.
- **Initial:** two-line drop cap in Garamond, `--rubric`, first paragraph of about and of each post only.
- **Plate (project):** edge-to-edge image, 1px `--ink-faint` frame, caption underneath: `Fig. 3` in mono, title in Garamond italic, tag in mono muted. Hover raises the image from a 1px hatch overlay to clean.
- **Index row (events, blog):** a single flex row with a dotted leader between title and date.
- **Link:** underline offset 3px, 1px, `--ink` at 40%, going to 100% on hover. Focus ring is 2px `--rubric`.
- **Figure caption / sidenote:** mono-s, muted, numbered with a superscript in `--rubric`.

## 9. Motion

- Page navigation: View Transition at 0.65s `cubic-bezier(0.65,0,0.35,1)`. A page turn reads as a horizontal drift with a soft edge shadow, as in the reference, no skeuomorphic curl.
- Theme toggle: radial reveal from the toggle, 0.8s, the same technique the reference uses. Narrative: lighting a candle.
- Canvas: lamp easing around 300–600ms decay.
- Text: no entrance animation except the home line typing in once (the reference types its tagline). Stop under `prefers-reduced-motion`.

## 10. Bans

Parchment or burnt-paper textures, blackletter, gold gradients, scrolls and ribbons, emoji, drop shadows, glassmorphism, full-page scanlines or phosphor green (that is a hacker terminal, not an engraving), ASCII used as decoration on every element. One canvas per site.

## 11. Open decisions (need Heika)

1. ~~Hero subject~~ Decided and prototyped: Creation of Adam hands, left classical painting, right ASCII. Still open: which side reads as you. One reading is Adam (classical) = the made, God (ASCII) = the maker/code. Pick one and I'll write the hero caption around it.
2. What goes under events (talks, hackathons, community, travel).
3. Real project list and screenshots; the daoho.dev project layout assumes strong imagery.
4. Stack: the reference is Next.js with Tailwind, and I'd match it unless you prefer Astro.

## 12. Sources

- daoho.dev, inspected live (computed styles and CSS read from the page).
- [Codrops: real-time ASCII and dithering with WebGL shaders](https://tympanus.net/codrops/2026/01/04/efecto-building-real-time-ascii-and-dithering-effects-with-webgl-shaders)
- [A List Apart: More Meaningful Typography](https://www.alistapart.com/article/more-meaningful-typography) (modular scale, Renaissance-informed type).
- [Aino style reference on Refero](https://styles.refero.design/style/2ef27b47-36b6-46a3-b325-512bccc76abc) (ASCII-as-hero in a light theme).
- [Eclectic Light: pigments and technique up to 1700](https://eclecticlight.co/2015/09/22/pigments-technique-→-style-2-up-to-1700/) (vermilion, lapis, verdigris, lead-tin yellow).
- Leiden dissertation on Jenson's type, via search: it questions the claim that early punchcutters worked to golden-ratio formulas, so proportion here is a guide, not a doctrine.
