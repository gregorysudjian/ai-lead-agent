# Overnight plan — the website generator, 2026-09-11

Written before you went to sleep. Every decision below is made in advance so I
never stop to ask a question. Where something new comes up, I take the
conservative option, write it under **Decisions I made for you**, and keep going.

**Results are appended at the bottom as I work. Read that section first when you
wake up.** (The previous overnight plan, with its results, is in git history at
commit `540f6e8`.)

---

## The goal, made measurable

A generator that turns any business in the catalog into a website that is
**unique, personal and genuinely well designed** — the kind of page an owner
looks at and thinks "that's mine", built with the techniques Awwwards rewards:
big confident typography, parallax depth, scroll-driven storytelling,
micro-interactions.

"Done" means all of these are true in the morning:

| Promise | How it is checked |
|---|---|
| **Unique** | A test generates designs for 1,000 real catalog businesses and asserts ≥ 99% distinct designs; every barber on one street differs visibly. |
| **Stable** | The same business always gets the same design; a demo already shown to someone never changes appearance (old demos keep rendering exactly as today). |
| **Personal** | The page uses the business's name as a brand (wordmark/monogram), its neighbourhood, its trade's vocabulary and icons, its real phone, address, hours and social links when we hold them. |
| **Well done** | Every palette passes WCAG AA contrast (tested). Screenshots of 20+ varied businesses, desktop and mobile, reviewed by me image by image. No overflow, no broken long names, no empty-looking sections. |
| **Alive** | Parallax, scroll reveals, marquees, sticky sections, hover and cursor effects — all respecting "reduce motion", and never hiding content from a browser that lacks the effects. |
| **Honest** | Every existing honesty rule still holds: sample copy marked, no invented prices/years/awards/testimonials, no fake photographs of the business. |
| **Bilingual** | Every site carries French and English with a switch in the nav, opening in French. Every line of copy exists in both languages and passes the honesty tests in both. |

---

## Why today's sites look like one template

- **4 layouts × 5 palettes × 5 fonts**, chosen by trade plus a name hash. Two
  salons get one of two palettes — a street of salons repeats.
- **Every section is one fixed shape.** The hero, the services, the gallery are
  the same arrangement on every site of a layout.
- **Placeholders are flat gradient boxes.** The single biggest reason a page
  reads "generated" is imagery, and today there is none.
- **Nothing moves.** No depth, no reveal, no rhythm — the opposite of what
  Awwwards rewards.
- **Copy is one template per trade**, so the words repeat as much as the look.

---

## The design language (what Awwwards rewards, and how we build each)

From the current nominees and parallax collection: animated single-page
storytelling, parallax, scrolling, typography-led layouts, microinteractions,
transitions, bold colour or strict minimalism. Built within our rules — no
third-party runtime requests, the demo renderer stays a Server Component — so
motion is **CSS-first** (native scroll-driven animations, zero JavaScript) with
a tiny client "motion island" only for what CSS cannot do.

| Technique | How we build it |
|---|---|
| Giant display type, wordmark heroes | Fluid `clamp()` type up to ~16vw; the business name set as a logotype, with italic/serif emphasis on one word |
| Split-line heading reveal | Headings split into line/word spans on the server; staggered CSS keyframes on load |
| Layered parallax | Background art, mid shapes and foreground text on different scroll-timeline speeds (`animation-timeline: scroll()`) |
| Scale / clip reveal on scroll | `animation-timeline: view()` — frames zoom 1.12→1, sections unmask with `clip-path` |
| Sticky stacking cards | Services stack with `position: sticky` and increasing offsets |
| Horizontal scroll gallery | A pinned section whose track translates sideways as you scroll |
| Infinite marquee | Services / neighbourhood ticker, pure CSS keyframes, duplicate copy `aria-hidden` |
| Scroll progress + condensing nav | Scroll-timeline progress bar; the nav shrinks after the hero |
| Section colour shifts | Alternating ground colours from the palette, with soft transitions |
| Grain and texture | An inline SVG noise filter, no image file |
| Custom cursor, magnetic buttons | Client island, only on fine pointers, off under reduced motion |
| Bento / editorial index | Numbered sections ("01 — Services"), bento grids, ruled lists |
| Giant footer wordmark | The business name across the full width of the footer |

**Progressive enhancement is a hard rule:** every effect is wrapped in
`@supports` and `prefers-reduced-motion: no-preference`. A browser without
scroll-driven animations (Firefox today) gets a complete, static, still-beautiful
page — never invisible content waiting for an animation that never runs. A small
IntersectionObserver fallback adds the reveals there.

---

## Architecture decisions

**1. A design genome, chosen by application code — not by the generator.**
A pure, deterministic function `designFor(business, seed)` returns a complete
design: an *art direction* plus every choice inside it. Application code picks
the look from facts (trade, name, neighbourhood); a generator — mock today,
Claude tomorrow — only ever writes words. This is CLAUDE.md's "look derived from
facts, not prose", extended.

**2. Art directions keep every site coherent.** Uniqueness without coherence is
noise. About ten curated directions — e.g. *Editorial Serif, Swiss Grid, Soft
Organic, Luxe Noir, Retro Poster, Brutalist Bold, Minimal Gallery, Neo Grotesk,
Botanical, Pop Colour* — each defines which fonts, palettes, hero shapes, section
variants, motifs and motion styles belong together. The seed chooses *within* a
direction, never across them. Trades map to the directions that suit them (a
tattoo studio never gets pastel; a nail salon never gets brutalist).

**3. Colour becomes parametric, under contrast tests.** Instead of five fixed
palettes, each direction defines hue/chroma ranges in OKLCH and the seed picks a
point in them; the palette engine derives the full token set and **a test proves
every generated palette passes WCAG AA** across thousands of seeds. Tokens reach
the page as CSS custom properties, not assembled Tailwind classes (CLAUDE.md's
literal-class trap does not apply to CSS variables).

**4. The design is stored with the demo.** The genome is saved inside the demo
spec, versioned and validated on read. Changing the algorithm later can never
silently redesign a site already shown to someone.

**5. Old demos render exactly as today.** Specs without a genome go through the
existing renderer, untouched. New generations use the new renderer.

**6. No photographs we do not have.** ROADMAP already declined stock photos ("a
photo of a salon that is not theirs"). Instead: **seeded generative art** — SVG
compositions built from each trade's own shapes (scissor arcs, comb teeth, ink
strokes, petals, gems), gradients, grain — plus beautifully framed photo slots
that say plainly "Your storefront", "Your chair", "Your work". Decorative art is
`aria-hidden` and can never be mistaken for a photo of the business.

**7. More fonts, still self-hosted.** Add roughly eight more families via
`next/font` (downloaded at build, served by us — no runtime Google request), so
the type pairings carry real personality.

**8. Bilingual by design, French first.** Every site carries French and English
copy; it opens in French and a FR/EN switch sits in the nav. Quebec's Charter of
the French language requires a Quebec business's website to be available in
French with French at least as prominent, so French-first is not just a courtesy.
The language lives in the URL (`?lang=en`), so the switch needs no JavaScript,
works on the public share page, and a link can be sent in either language. The
renderer's own words ("Appelez-nous", "Heures", weekday names, the sample tag)
come from a small dictionary; the business's words come from bilingual copy
pools, and the honesty tests gain French patterns (prix, primé, certifié, depuis
19xx, ans d'expérience, avis, étoiles).

**9. A lab to see it all, persisting nothing.** An authenticated `/demos/lab`
page renders the design for **any catalog business** in memory, with "try
another design" and a grid view of many businesses at once. It writes nothing
to the database. It doubles as a product feature: preview a site before making
someone a lead.

---

## Standing rules for the night

1. **No questions.** Decisions are logged, conservative, and cheap to reverse.
2. **No database writes.** Everything renders in memory in the lab. Your 11
   leads, 20 demos and 2,839 catalog businesses are untouched. Regenerating your
   real demos with the new generator is one click for you in the morning.
3. **Nothing costs money.** `DEMO_PROVIDER` stays `mock`; no Anthropic calls, no
   paid API of any kind.
4. **Nothing is contacted.** Hard rule 1. No share links are created.
5. **Never commit red.** Every commit passes typecheck, lint, all tests and the
   production build, checked in an isolated worktree before it lands.
6. **No pushing.** Commits stay local on `main`.
7. **Existing demos never change.** The legacy renderer path stays byte-for-byte.
8. **One new dev dependency, `playwright-core`**, to take screenshots with the
   Edge browser already on this PC (no browser download). Used only by a local
   script; never shipped.
9. **I stay inside the project.** Scratch work goes in the session temp folder.
   Your other projects on ports 3000 and 3001 are left alone; Lead Finder runs
   on 3002.

---

## Work items, in order

Ordered by value, so if the night runs out, everything before the stopping
point is finished, committed and better than today. **Must** items come first.

### 1. The lab and the camera  *(must)*
- `/demos/lab?business=<catalog id>&variant=<n>` — one design, full page.
- `/demos/lab/grid` — twelve businesses side by side, to judge variety.
- `scripts/demo-screens.mts` — screenshots of chosen businesses at desktop
  (1440px) and mobile (390px) into `data/screens/`, plus a contact sheet page.
- "Preview website" link on each business card.

*Done when:* I can look at any catalog business's site as an image. Everything
after this is judged by looking, not only by tests.

### 2. The design genome  *(must)*
- `src/lib/demo-design/`: art directions, trade → direction mapping, seeded
  choice (stable hash of business id + variant), versioned `DemoDesign` type,
  validator, stored in the spec.
- Palette engine in OKLCH → full token set; contrast tests over thousands of
  seeds; uniqueness test over 1,000 catalog businesses.
- Type pairings: ~8 new self-hosted families, pairings per direction.

*Done when:* designs are unique (≥ 99%), stable, contrast-safe, and old specs
still validate and render as before.

### 3. The motion system  *(must)*
- CSS utilities: reveal, stagger, parallax layers, scale-in, clip reveal,
  sticky stack, horizontal track, marquee, progress bar, condensing nav — each
  behind `@supports` and reduced-motion.
- Motion island (client, tiny): IntersectionObserver fallback, cursor, magnetic
  buttons; fine pointers only; disabled under reduced motion.
- Motion intensity is part of the genome (calm / lively / bold) so a spa floats
  and a barber snaps.

### 4. Generative art  *(must)*
- Seeded SVG motif library per trade and per direction: shapes, patterns,
  blobs, gradient meshes, grain; photo-slot frames with honest labels.
- Hero art, section dividers, gallery tiles, footer marks.

### 5. The new renderer  *(must)*
- Variants per section, owned by directions: ~6 heroes (giant wordmark, split
  editorial, full-bleed parallax art, centred monogram, poster, sticky stack),
  ~4 service treatments (sticky cards, bento, numbered rows, horizontal cards),
  ~3 about, ~3 gallery (parallax masonry, pinned horizontal, mosaic), contact
  and hours, CTA bands (marquee, giant type), footers with a wordmark.
- Nav variants: pill, split, minimal-with-menu; mobile menu stays CSS-only.
- Long names, missing phone/address/hours, and one-page sites all designed for.

### 6. Personal, bilingual content  *(must)*
- Seeded copy pools per trade **in French and English** (several headlines,
  subheads and about texts each), so words vary as much as the look.
- FR/EN switch in every nav; French by default; `?lang=en` for English.
- Renderer dictionary for its own words, French weekday names and hour format.
- Neighbourhood in the copy ("in Verdun"), wordmark and monogram from the name,
  trade icons, real hours/phone/address/social when held.
- Every new line passes the existing honesty tests: no prices, years, awards,
  certifications, staff names, testimonials, ratings, clock times, and no
  invitation the page cannot back ("call us" only above a real number).

### 7. Wire it in  *(must)*
- Demo generation computes and stores the genome; the preview page and the
  public `/s/` page render the new design; legacy demos take the old path.
- "Try another design" on the lead's demo panel (a new variant, stored as a new
  demo — the old one is kept, as today).
- The Claude-backed generator keeps working (it writes words only; the design is
  ours), verified by its existing tests without calling the API.

### 8. The QA pass  *(must)*
- Screenshots of 20+ deliberately varied businesses — every trade, long and
  short names, with and without phone/address/hours/website, several
  neighbourhoods — desktop and mobile. I review each image and fix what is off,
  then repeat.

### 9. Stretch, if the night allows
- Page-load intro sequence and section-to-section colour morphs.
- Section transitions tuned per direction; more hero variants.

### 10. Documentation
- CLAUDE.md principles updated (genome, parametric colour under contrast tests,
  motion rules, lab), README, and the results below.

---

## Decisions I made for you

- **No stock or AI photos.** Honest generative art + labelled photo slots. If
  you want real photography later, the clean path is the owner's own photos,
  added per demo.
- **CSS-first motion, no GSAP.** Zero-JavaScript effects keep demo pages fast
  and server-rendered; Firefox gets a static page plus light fallbacks.
- **The design is app-owned.** The generator writes words; it never picks
  colours, fonts or layouts.
- **Bilingual, French first** (you chose bilingual; French-first follows from
  Quebec's language charter). English is one click away on every site.
- **Old demos are frozen.** New design = new generation, never a silent change.

---

## What you do in the morning

1. Open **http://localhost:3002/demos/lab/grid** and scroll through the variety.
2. Open the contact sheet in `data/screens/` for the reviewed screenshots.
3. On any of your 11 leads, press **Generate demo** to get a new-generation site.
4. Read **Results** below — what got done, what did not, and why.

---

## Results

*Appended as I work. Newest entry last.*

### Item 1 — the lab and the camera · done (`dfad038`)

- `/demos/lab?business=<id>` renders the site generation would produce for any
  catalog business, in memory. It imports the MOCK analyser and generator by
  name, so no setting can make a preview a paid call. Nothing is written.
- Every business card now has **Preview site**.
- `scripts/demo-screens.mts` photographs lab pages with the Edge already on
  this PC (`playwright-core`, dev-only) at 1440px and 390px, on an awkward
  sample: longest/shortest names, missing phone or address, every trade.
- The first run found things the new design must handle: SEO-stuffed names
  ("Klyne Beauty - Salon de coiffure Africaine, Dreadlocks, Tresses, …"), a
  junk record in Overture's own data ("6r5dxckulcvbol/."), and a name with a
  clock time in it ("11:11 Tattoos").

### Item 2 — the design genome · done

- `src/lib/demo-design/`: ten art directions, a colour engine in OKLCH with a
  WCAG contrast fixer, 24 display faces and 5 body faces (keys only; fonts are
  wired in item 5), trade → direction weights, trade motifs, a seeded chooser,
  and a validator for stored designs.
- **Readable, tested:** every direction × ground × 300 seeds (~7,000 palettes)
  passes ink ≥ 7:1, muted text ≥ 4.5:1, accent text ≥ 4.5:1, text on accent
  ≥ 4.5:1, text on the inverted band ≥ 7:1.
- **Unique, measured on your real catalog (2,843 businesses):** 99.89% distinct
  designs (the 3 repeats are Overture listing one shop twice). On a strict
  "visibly different" fingerprint of seven headline choices, 93.2% overall —
  but among the 904,281 pairs of same-trade, same-district businesses (the
  ones you would compare), only 66 pairs match (0.007%), and only 5 once motif,
  nav, about and CTA style are counted.
- **Stable:** same business → same design; "try another design" is a variant.
- **Brand names:** the logo is always a prefix of the real name cut at a
  separator the business wrote ("Klyne Beauty"), never rewritten; monograms
  skip trade words ("Salon Barbier Chez Mostafa" → "M").

### Items 3–5 — motion, generative art, the new renderer · done

- `src/components/demo/v2/`: a new renderer that draws a site from its design
  genome. Six hero compositions (giant wordmark, split with a rotating name
  badge, full-bleed poster, centred monogram, magazine editorial, layered
  stack), four service treatments, three about, three gallery (one pinned
  horizontal), three contact, three closing CTAs, three navs, two footers.
- **Motion is CSS**: reveals, parallax depth layers, clip-unmask, zoom, hero
  exit, reading-progress bar, condensing nav, rotating badges, marquees,
  pinned horizontal gallery — all behind `@supports (animation-timeline)` and
  `prefers-reduced-motion`. The only JavaScript is a tiny island for a
  lagging cursor and magnetic buttons (mouse only) and a fallback for browsers
  without scroll timelines. With reduced motion the page is complete and still.
- **Art, not stock photos**: every trade has line-art glyphs (shears, razor,
  pole, gem, ink drop, petals…) composed per business from its seed; every
  photo slot says what photo belongs there.
- **29 self-hosted typefaces**, loaded only when a page uses them. A test
  fails if the genome can name a font the renderer never loaded.
- **FR by default, EN switch** in every nav (`?lang=en`); the renderer's own
  words, weekday names and "9 h – 18 h 30" hours are French. (The generated
  copy is still English — that is item 6.)
- **The lab now shows v2** with *Try another design* and *Old renderer*
  buttons, and **`/demos/lab/grid`** shows twelve live designs side by side
  (a *Design grid* button sits on the Businesses page).
- **Found by looking at screenshots, then fixed**: hero art striking through
  the business name; a name badge covering a photo label; phone numbers
  wrapping; a 4-tile mosaic leaving a hole; a grid card pushed off-screen by
  CSS auto-placement; a stylesheet silently overriding layout utilities
  (moved into a cascade layer); long names cut off with "…" in the nav;
  "Contact" and "Get in touch" both in the menu; duplicate SVG ids.
- **Tests**: 60 across the renderer — a sweep of 216 renders reaching every
  variant checks one `<h1>` per page, no leaked `undefined`, unique ids, sample
  tags wherever copy is sample, a call link only when a phone is stored,
  hostile names rendered as text, colours only via the genome.

### Items 6–7 — bilingual, personal copy, wired in · done

- **French first, English one click away.** Every sample line now exists in
  Quebec French and English (`demo-samples-fr.ts`, `demo-samples-en.ts`), for
  all 13 trades plus the fallback. French uses Quebec usage ("jasette",
  déjeuner/dîner), French typography (a non-breaking space before ? and :),
  and never puts the city after "de" (a template cannot know "de Anjou" should
  be "d'Anjou").
- **Words vary as much as the look.** For the five catalog trades there are
  4 headlines, 3 subheadings, 3 about paragraphs, 5–6 services (3–4 shown),
  5 about points (3 shown) and 3 closings each, picked by the business's name.
  Among 19,900 pairs of invented salons, fewer than 0.3% get the same page
  copy. A finding worth recording: the first version produced only 72%
  distinct pages because FNV's low bits never mix; a murmur finaliser fixed it.
- **One page in two languages.** The pools are parallel and both languages
  pick the same index, so the French and English pages always say the same
  thing. The stored French page must have exactly the English page's
  structure (sections, counts, buttons, sample flags) — the database layer
  refuses a mismatch.
- **Personal:** copy uses the business's brand ("Klyne Beauty est un salon…"),
  not the keyword-stuffed directory name; the category appears in the page's
  language ("Barbier", "Salon d'esthétique"); service icons match in both
  languages (a test checks every pair).
- **Honest in French too.** New tests sweep every trade × layout × phone/address
  combination × 5 names in French for prices, "depuis 1998", "10 ans", "primé",
  "certifié", "garanti", ratings, payment methods and clock times; and check
  that a page with no phone never says "appelez" and one with no address never
  says "passez"/"venez". They caught three real problems, all fixed in the copy.
  I also removed "Cash and card accepted" (a checkable claim) from the barber copy.
- **Wired in.** Generating a demo now stores a design and a French page
  (`spec.design`, `spec.alternates.fr`). `/demos/[id]` and the public
  `/s/[token]` draw it with the new renderer, in French by default, `?lang=en`
  for English; the share page's disclosure bar is French too. **Every demo
  stored before tonight renders exactly as before** (no design → old
  renderer; checked on St-Viateur Bagel).
- **Try another design** on the lead's demo panel makes a new demo with the
  next design variant: same words, new look, the old demo kept.
- The Claude-backed generator declares itself English-only (it chooses its own
  sections each call, so a French call would rarely match the English page —
  two paid calls for nothing). Its demos get the new design, in English.
- Tests: 2,062 passing (was 1,950).

### Item 8 — the QA pass · done

Photographed 24 deliberately awkward catalog businesses (every trade, the
longest and shortest names, missing phone or address, a junk record, a
misfiled Sephora, several municipalities) at 1440px and 390px, reviewed every
section as contact sheets, fixed, and re-photographed. What looking found:

- **Giant names broke at hyphens** ("ST-" alone on a line): giant type is now
  capped by what the longest word needs to fit.
- **French question marks fell onto their own line**: JavaScript's `\s` also
  matches the non-breaking space French puts before "?", so splitting words
  on it threw the space away. Now split on breakable spaces only, with a test.
- **Brand cut off on phones** ("24KUTS BARBERSH…"): names may take two lines
  on small screens.
- **Galleries started flush against the page edge**: mandatory scroll
  snapping without `scroll-padding` scrolls the padding away.
- **A fourth service card pushed past the edge** on desktop; **long about
  paragraphs set in capitals** (brutalist) read as shouting; **art behind the
  big bento card** competed with its text. All fixed.

The contact sheets are in `data/screens/qa1` (before) and `qa2`/`qa3` (after).
- **Motion checked with motion ON** (every screenshot above used reduced
  motion, which hides motion bugs). Scrolling real pages found the reveal
  range could never complete in the last screen of a page — the footer's
  wordmark and the closing button stayed at ~82% opacity forever. Reveals now
  finish within the element's own entry (at most 240px). The scroll hint's
  dot also left its pill on "bold" sites; it now rolls like a mouse wheel.

### Item 10 — documentation · done

- CLAUDE.md: four new principles (the stored design genome and why old demos
  never change; French first and "two languages, one page"; motion rules
  including the reveal-range and cascade-layer lessons; the lab writes
  nothing). The older demo-look principle now says it describes the original
  renderer.
- README: what a demo now looks like, French first, the lab, the grid and the
  screenshot script.

### Item 9 — stretch · partly done

- **Load curtain:** on lively and bold designs, the page opens under a
  one-second curtain in the site's inverted colour with the business's mark,
  which lifts away as the hero rises in. CSS only, never blocks a click,
  covers only the site (never the "draft proposal" bar above it), absent on
  calm designs and for visitors who ask for reduced motion.
- Not done: section-to-section colour morphs. Everything else on the night's
  list is in.
