# ☕ MASTER BUILD PROMPT — KOOB COFFEE WEBSITE
### "Happiness is one drink away" · Jawhra, Sousse, Tunisia · Founded by Amir Ghzel
#### Animation References: bryhel.com (clip-path panels, kinetic type, spring snaps) + igloo.inc (scroll-scrubbed 3D object, persistent nav, void spawn, waypoint immersion)

---

## 🎯 CONCEPT & IDENTITY

Build a single-page immersive website for **KOOB**, a real specialty café founded by **Amir Ghzel** in **Jawhra, Sousse, Tunisia**. The site fuses the warm editorial product-forward feel of Milton's coffee (catalog-style, coffee-as-craft) with the dark dramatic energy of Bodrin (moody tones, emotional storytelling) — BUT the scroll architecture, animation system, and interaction model are modelled directly on **bryhel.com** and **igloo.inc**.

**From bryhel.com**, borrow:
- Clip-path panel wipe transitions between every section (venetian-blinds horizontal slat reveals)
- Spring-physics GSAP panels that snap upward like magazine pages turning
- Kinetic XXL typography that reacts to scroll velocity — text warps, stretches slightly faster than the scroll, then snaps back
- Hover-to-full-bleed expansion on cards (neighbouring cards shrink 3–4px when one is hovered)
- A charcoal editorial canvas where content "explodes" with colour and warmth

**From igloo.inc**, borrow:
- A single pinned hero object (a large 3D-CSS coffee cup or SVG cup) that **scroll-rotates** in real time via GSAP `scrub` — as the user scrolls down, the cup slowly rotates, pours, fills, steams
- A "spawn inside a void" opening — user enters a near-black space that dissolves into the world
- A persistent contextual breadcrumb/progress bar on the right edge showing which section you are in
- Waypoint-locked ambient micro-interactions — specific scroll positions trigger teal glow pulses, steam puffs, or golden particle bursts
- Infinite-scroll feeling between sections — no hard page boundaries, one seamless narrative descent

**Brand tagline**: *"Happiness is one drink away."*  
**Wall quote**: *"You Are Where You Need To Be"* — pulled from the real café interior  
**Identity markers**: Deep hunter green walls · Arabic calligraphy column · Glowing KOOB mirror entrance · Black pendant lights · Warm wood floor

---

## 🎨 VISUAL DESIGN SYSTEM

### Color Palette (CSS Variables)
Extracted from KOOB's real interior photography:
```css
--koob-void:        #040d08   /* hero spawn black — near-absolute dark */
--koob-deep:        #082518   /* main dark bg */
--koob-forest:      #0d3b2e   /* dominant wall green */
--koob-teal:        #1a6b52   /* mid green, glows and accents */
--koob-teal-light:  #2a8a6a   /* highlight green, calligraphy column */
--koob-gold:        #c8a96e   /* warm gold — signage, prices, CTAs */
--koob-cream:       #f5f0e8   /* off-white text and light surfaces */
--koob-sand:        #e8dcc8   /* warm light section backgrounds */
--koob-charcoal:    #111411   /* editorial canvas, bryhel-inspired */
--koob-muted:       #6b7c6e   /* secondary body text */
--koob-glow:        rgba(26, 107, 82, 0.4)
--koob-gold-glow:   rgba(200, 169, 110, 0.18)
```

### Typography
- **Display / Hero**: `Playfair Display` — italic, 900 weight, clamp(72px–200px). Used for section openers and the kinetic hero word
- **Subheadings**: `Cormorant Garamond` — light 300, wide tracking, elegant. Used for taglines and pull-quotes
- **Body / UI**: `DM Sans` — 300–500 weight, airy and readable
- **Prices / Labels / Mono**: `Space Mono` — all prices (in DT), section counters, breadcrumb labels
- **Import**: `https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,900;1,700&family=Cormorant+Garamond:ital,wght@0,300;1,300&family=DM+Sans:wght@300;400;500&family=Space+Mono&display=swap`

### Textures & Atmosphere
- Global background: `var(--koob-deep)` + SVG `feTurbulence` grain overlay at `opacity: 0.035` — raw roasted wall texture
- Repeating faint arabesque tile SVG pattern at `opacity: 0.03` across dark sections — nods to the calligraphy column
- Radial **teal ambient glow** behind every focal element — echoes KOOB's glowing mirror entrance
- Floating coffee bean particles: JS canvas layer, ~28 beans, teal-brown, slow drift + rotation at all times
- All section colour shifts are scroll-scrubbed, not triggered — background hue transitions smoothly as you pass through

---

## 🏗️ PAGE ARCHITECTURE — ONE SEAMLESS SCROLL NARRATIVE

The page is one continuous scroll. No scroll-snap, no section jumps. The user descends through a single world. GSAP `ScrollTrigger` + `ScrollSmoother` (or Lenis) drives everything.

---

### SECTION 0 — VOID SPAWN / PRELOADER
*(igloo.inc reference: "spawn inside a matte-black void")*

- Screen opens: pure `var(--koob-void)`, zero content visible
- A single point of **teal light** (`var(--koob-teal)`) appears at exact center, radius 2px
- Over 1.2s, it expands via `radial-gradient` scale into a 300px glow circle — like KOOB's mirror entrance illuminating
- Inside the glow: the **KOOB logo** SVG draws itself stroke-by-stroke using `stroke-dashoffset` animation (1.4s total)
- Steam wisps (3 SVG paths) rise above the logo, staggered GSAP timeline: t=1.4s, 1.6s, 1.8s
- Brand name `"KOOB"` fades in letter-by-letter at t=2.0s — Playfair Display, cream, massive
- Tagline `"Happiness is one drink away"` types in character-by-character at t=2.4s — Cormorant Garamond italic, gold
- At t=3.0s: the entire screen splits — **venetian-blinds effect** (bryhel.com reference): 8 horizontal slats each `clip-path: inset(...)` from center outward, staggered 40ms apart, revealing the hero underneath
- The preloader slats slide to `opacity: 0` and `display: none` after split completes

---

### SECTION 1 — HERO "YOU ARE WHERE YOU NEED TO BE"
*(Full viewport · igloo.inc "within the void" aesthetic · bryhel.com kinetic type)*

**Layout**: Full 100vh. The void continues. No hard background change — this IS the void, slightly warming.

**Background**: `var(--koob-void)` fading toward `var(--koob-deep)` at bottom. The grain texture lives here. A large radial teal glow (300px, `opacity: 0.25`) pulses behind the hero cup — the mirror entrance glow.

**PINNED SCROLL-ROTATED COFFEE CUP** *(igloo.inc reference: the rotating 3D shard)*:
- A large SVG or CSS 3D-perspective coffee cup sits center-right, **pinned** while the user scrolls 200vh
- GSAP `ScrollTrigger` with `scrub: 1.5`: as user scrolls from 0→100% of pin, cup rotates `rotateY: 0 → 25deg`, tips slightly `rotateX: 0 → -8deg`, and coffee liquid inside (a separate SVG layer) appears to fill upward `scaleY: 0 → 1` from bottom
- Steam paths on the cup animate `opacity: 0→1` and `y: 0→-30px` as scroll progresses through the pin
- Mouse parallax on top of the scrub: cup shifts `±15px` opposite cursor direction via GSAP `quickTo`
- Teal glow behind cup breathes independently (CSS `@keyframes breathe`, 4s cycle)

**KINETIC HERO HEADLINE** *(bryhel.com reference: scroll-velocity type warping)*:
- `"KOOB"` — Playfair Display, 900 italic, `clamp(100px, 18vw, 200px)`
- Line 1: ghost text (`-webkit-text-stroke: 1.5px var(--koob-cream)`, `color: transparent`)
- Line 2: `"Coffee"` — solid `var(--koob-gold)`, slightly smaller (clamp 60px–120px)
- On scroll: text `scaleX` subtly warps 1→1.04→1 using GSAP `scrub` on scroll velocity — as if the type is dragged by the scroll inertia, then springs back with `ease: "elastic.out(1, 0.5)"`
- Character-by-character entry at page load: GSAP `staggerFrom`, `y: 100, opacity: 0, rotationX: -80deg`, `stagger: 0.05`, `ease: "power4.out"`

**Sub-tagline**: `"You are where you need to be."` — Cormorant Garamond, light italic, `opacity: 0.65`, `letter-spacing: 0.08em`. Second line: `"Jawhra · Sousse · Tunisia"` in Space Mono, micro, gold. Fades up at load t=3.5s.

**CTA**: `"Explore The Menu"` — outlined, gold border. On hover: `clip-path` wipe from left (bryhel.com reference). On scroll past hero: button floats into the persistent nav bar.

**Rotating scroll ring**: SVG `textPath` circle, `"SCROLL DOWN · SCROLL DOWN · "`, gold, `animation: spin 10s linear infinite`. Centered bottom of viewport. Arrow bounces below.

**PERSISTENT BREADCRUMB BAR** *(igloo.inc reference)*:
- Fixed right edge, vertical, `writing-mode: vertical-rl`
- Shows current section in Space Mono, 0.6rem, gold
- A thin vertical progress line grows from top to bottom as total scroll % increases
- Sections: `01 HOME · 02 STORY · 03 MENU · 04 AMBIANCE · 05 FIND US`
- On section change: current label fades out and new one types in with GSAP `staggerFrom` characters

**CUSTOM CURSOR**:
- 10px gold circle, lagging behind mouse via GSAP `quickTo(duration: 0.25)`
- On hover of interactive elements: expands to 38px ring, `background: transparent`, `border: 1.5px solid var(--koob-gold)`
- On hover of the cup: cursor transforms into a small ☕ emoji that bounces
- `cursor: none` on `body`

**AMBIENT WAYPOINT PULSE** *(igloo.inc reference: waypoint-locked interactions)*:
- When scroll reaches the exact point where the cup is "fully filled" (scrub 100%), a single gold particle burst radiates from the cup's rim — 12 tiny gold ellipses that `scale: 0→1` and `opacity: 1→0` radially outward, staggered 20ms
- A brief teal flash rings the glow circle (CSS `animation` one-shot, `duration: 0.4s`)

---

### SECTION 2 — MARQUEE IDENTITY STRIP

Full-width strip, `var(--koob-forest)` background. 1px gold border top and bottom.

CSS `animation: marquee 20s linear infinite` scrolling ticker:
`Hand Crafted With Love ✦ Sousse, Tunisia ✦ Founded by Amir Ghzel ✦ Happiness is one drink away ✦ صنعت بحب ✦ Specialty Coffee ✦`

Arabic phrase `صنعت بحب` ("Made with love") — honoring KOOB's real Arabic lettering. Gold dots separating items. Cormorant Garamond italic, 1rem.

**On scroll into view** *(bryhel.com magazine snap reference)*: the strip enters with a `clip-path: inset(0 0 100% 0)` → `inset(0 0 0% 0)` wipe from top to bottom — like a page fold opening. GSAP `ScrollTrigger`, `start: "top 90%"`, duration 0.6s.

---

### SECTION 3 — STORY "A CAFÉ BORN FROM PASSION"
*(bryhel.com: spring-physics panels snapping · editorial charcoal canvas)*

**Layout**: Two-column, 50/50. The background shifts from `var(--koob-deep)` to `var(--koob-forest)` via GSAP scroll-scrub color tween — imperceptibly gradual.

**On scroll entry** *(bryhel.com reference: panels snap upward like magazine pages)*:
- The entire section enters as a single panel: `transform: translateY(80px), opacity: 0` → `translateY(0), opacity: 1` with `ease: "power3.out"` and GSAP spring physics (`mass: 0.5, stiffness: 100, damping: 15`)
- Sub-elements stagger in 0.12s apart

**Left — Visual Panel**:
- Tall portrait-ratio card, `var(--koob-forest)` bg, rounded `6px`
- Inside: the real wall quote typeset in Playfair Display:
  ```
  "YOU ARE
   WHERE
   YOU
   NEED
   TO BE"
  ```
  Gold color, bold, `letter-spacing: 0.18em` — exactly as it appears on KOOB's real wall
- Each line of the quote reveals with `clip-path: inset(0 100% 0 0)` → `inset(0 0% 0 0)` staggered 0.18s apart on scroll trigger
- Faint arabesque SVG tile behind the text at `opacity: 0.07`
- Decorative corner brackets: top-right gold, bottom-left teal
- *(bryhel.com reference)*: On hover, card expands `scale: 1.02` with spring ease, neighbouring column shrinks `scale: 0.99` — rack-focus analog

**Right — Text**:
- Section label: `"01 — Our Story"` · Space Mono, gold, 0.65rem
- Headline: `"A café born from passion"` — Playfair Display. `"passion"` in gold italic
- Word-by-word reveal: GSAP `SplitText` (or manual word-spans), each word `y: 40, opacity: 0` → `y: 0, opacity: 1`, stagger 0.08s
- Body copy (Cormorant Garamond, 1.1rem, line-height 1.85):
  > *"KOOB is more than a coffee shop. Founded by Amir Ghzel in the heart of Jawhra, Sousse, it is a sanctuary — where the ritual of coffee meets the warmth of Tunisian culture. Every cup is crafted with intention."*
- Founder badge: avatar circle + `"Amir Ghzel — Founder & Creator"` slides in from left `x: -30, opacity: 0` → `x: 0, opacity: 1`, last to animate

---

### SECTION 4 — MENU "WHAT WE SERVE"

**Background**: Shifts to `var(--koob-sand)` — the only warm light section. Maximum contrast. Background shift is scroll-scrubbed over 60px of scroll, not instant.

**On entry** *(bryhel.com venetian-blinds)*: The section reveals via 6 horizontal clip-path slats, each `clip-path: inset(0 0 100% 0)` → `inset(0 0 0% 0)`, staggered 50ms, duration 0.5s each.

**Header**:
- Section label: `"02 — Full Menu"`, teal
- Headline: `"What we serve"` · Playfair Display, dark forest, large
- Sub: `"Every drink crafted with love · All prices in DT"` · Cormorant Garamond italic, muted

**Tab Navigation**:
7 tabs. Each has a micro SVG icon + label + animated gold underline (`scaleX: 0→1` on active).

Tabs: `Hot Drinks · Iced Coffees · Matchas · Special Coffees · Frappuccinos · Cold Drinks · Extras`

On tab switch: panel cross-fades GSAP `opacity: 0→1`, `y: 8→0`, `duration: 0.35s`.

**Tab Panels** — CSS grid `repeat(auto-fill, minmax(330px, 1fr))`:

Each category has:
- Sub-header: Playfair Display, forest color, `border-bottom: 1px dashed rgba(13,59,46,0.15)`
- Items: name in Cormorant Garamond (1rem) + price in Space Mono pill badge (teal bg, 0.75rem)
- Hover: row gets `background: rgba(13,59,46,0.05)` wash transition 0.2s

**FULL MENU DATA** (all prices in DT):

**Hot Drinks — Classics:**
Espresso · Americano · Espresso Macchiato 3 · Latte 3.5 · Doppio 3.8 · Choco Milk 4 · Nescafé 3.5/3.8

**Hot Drinks — Hot Drinks:**
Hot Chocolate 7 · Spanish Latte 5 · Mocaccino 7 · Cappuccino 5 · Tea 2.5 · Infusion 2.5

**Iced Coffees:**
Iced Americano · Iced Latte · Iced Caramel 6 · Iced Hazelnut 7 · Iced Speculoos 8 · Iced Peanut Butter 8/9

**Iced Matchas:**
Iced Vanilla Matcha Latte · Iced Strawberry Matcha Latte 9 · Iced Caramel Matcha Latte 12 · Iced Matcha Latte 11/8

**Special Coffees:**
Vanilla Latte Macchiato · Caramel Latte Macchiato 5.5 · Hazelnut Latte Macchiato 6 · Peanut Butter 6 · Speculoos 8.5 · Affogato 8.5/5.5

**Frappuccinos:**
Coffee Frappuccino · Caramel Frappuccino 7.5 · Speculoos Frappuccino 8 · Vanilla Frappuccino 10/8

**Milkshakes:**
Vanilla Milkshake · Strawberry Milkshake 7.5 · Speculoos Milkshake 8.5 · Chocolate Milkshake 9/7.5

**Smoothies:**
Banana Smoothie · Strawberry & Banana 8 · Blueberry & Banana 9 · Ananas Smoothie 9/8

**Mojitos:**
Virgin Mojito · Blue Mojito 7.5 · Red Mojito 8

**Iced Teas:**
Peach Iced Tea 7 · Mango Iced Tea 8

**Fresh Juices:**
Orange Juice · Lemon Juice 5 · Banana Juice 5 · Strawberry Juice 7

**Drinks:**
Water 0.5L 1.5 · Water 1L 2 · Soda 3.5/2.5 · Sparkling Water · Energy 8

**Extras:**
Sirops · Special Milk 2

---

### SECTION 5 — AMBIANCE "YOUR RITUAL SPACE"
*(bryhel.com: hover-to-full-bleed card expansion · rack-focus shrink on neighbours)*

**Background**: Returns to `var(--koob-forest)` via scroll-scrub.

**Header**: Section label `"03 — The Space"` + headline `"Crafted for your ritual"` — Playfair Display, cream, with `"ritual"` in gold italic.

**3 Feature Cards** in a row:

**Card 01 — Arabic Calligraphy**
> *"Our walls speak in art. Hand-painted Arabic scripts frame every corner with identity and warmth."*

**Card 02 — Forest Green Sanctuary**
> *"Deep hunter green walls, soft pendant lighting — a mood you won't find anywhere else in Sousse."*

**Card 03 — The Mirror Door**
> *"Our iconic glowing KOOB mirror — a portal between the street and your perfect moment inside."*

Each card:
- Dark bg, `border-radius: 6px`, portrait ratio (~3/4)
- Teal radial gradient in background, unique angle per card
- Number label + title + body in Cormorant Garamond italic
- A 1px gold top-border glow animates in on hover
- *(bryhel.com reference)*: On card hover → hovered card `scale: 1.03`, other two cards `scale: 0.975` and `opacity: 0.75` simultaneously — rack-focus analog. All with GSAP `duration: 0.4, ease: "power2.out"`
- *(bryhel.com reference)*: On hover, card background blooms to near-full opacity (`opacity: 0.4 → 0.65`)

**Card entry**: stagger-slide from `y: 60, opacity: 0`, `stagger: 0.15s`, spring ease on scroll trigger.

**WAYPOINT PULSE** *(igloo.inc reference)*: When the ambiance section enters view, a teal wave radiates outward from the center of the section (CSS `box-shadow` expanding ring animation, one-shot, 0.8s).

---

### SECTION 6 — FEATURED DRINK — HORIZONTAL SCROLL CAROUSEL
*(igloo.inc: infinite scroll feeling · bryhel.com: clip-path wipe on card entry)*

**Layout**: GSAP `ScrollTrigger` with `pin: true` and `horizontal: true`. While the section is pinned, scrolling down moves cards to the left. The vertical scroll drives horizontal movement.

**7 featured drink cards** (one per menu category):

Cards in order: `Iced Caramel Coffee · Iced Caramel Matcha Latte · Vanilla Frappuccino · Speculoos Milkshake · Blue Mojito · Strawberry & Banana Smoothie · Affogato`

Each card:
- Portrait, ~300px wide, dark `var(--koob-deep)` bg
- Category pill badge top-left, amber bg
- Drink name: Playfair Display, large
- Price: Space Mono, gold
- Short flavour description: Cormorant Garamond italic, muted
- *(bryhel.com reference)*: On card hover → `rotateY: 6deg`, neighbouring cards `scale: 0.97` — CSS `perspective: 1000px` on parent
- Entry: each card reveals via `clip-path: inset(100% 0 0 0)` → `clip-path: inset(0% 0 0 0)` (bottom-up venetian wipe) staggered 0.1s as they enter the horizontal viewport

**Progress indicator**: thin gold line at section bottom, `width: 0% → 100%` scrubbed to horizontal scroll progress.

**Drag to scroll**: JS `PointerEvent` drag detection as fallback if user prefers dragging.

---

### SECTION 7 — WHAT SETS US APART
*(bryhel.com: spring-physics alternating panels)*

**Layout**: Alternating 2-column rows (text-left/visual-right, then text-right/visual-left). Background `var(--koob-deep)`.

**4 features** with oversized ghost number (Playfair 160px, `opacity: 0.05`) behind heading:

`01 · High Quality Beans`
`02 · Individual Approach`
`03 · Inspiring Atmosphere`
`04 · Professional Baristas`

Each feature block enters with spring-physics panel snap *(bryhel.com)*: `y: 70 → 0`, `ease: "elastic.out(0.8, 0.6)"`, `duration: 1.2s` on scroll trigger.

**Center visual**: A CSS 3D coffee cup (same as hero) with live steam animation — 3 SVG wavy paths with staggered GSAP `yoyo: true, repeat: -1` loop, `opacity: 0.4→1, y: 0→-20px`. The cup `rotateY` responds to scroll-scrub over this section: `0 → 15deg → 0` (faces you as you pass through).

---

### SECTION 8 — QUIZ CTA "WHICH COFFEE ARE YOU?"
*(igloo.inc: waypoint interaction · bryhel.com: hover background squeeze)*

**Layout**: Full-width, diagonal split — left half `var(--koob-forest)`, right half `var(--koob-teal)` gradient. `clip-path: polygon(0 0, 55% 0, 45% 100%, 0 100%)` on left div.

**Headline**: `"Which Coffee Are"` + `"*You?*"` — Playfair Display italic, cream, 72px+.

**CTA**: `"Take The Test"` — cream outlined, centered.

*(bryhel.com reference)*: On button hover → both halves animate toward each other: left div `clip-path` expands rightward, right div expands leftward, squeezing toward the button from both sides. On mouse-leave: they spring back. GSAP `to` with `ease: "power3.inOut"`.

*(igloo.inc waypoint reference)*: On scroll into view, a **gold particle burst** fires from the diagonal split line — 16 tiny gold rectangles spin and fade outward. One-shot GSAP timeline.

On click: modal slides up from `y: 100vh → 0` via GSAP — 3 question cards animate in staggered from bottom.

---

### SECTION 9 — NEWSLETTER
*(igloo.inc: persistent immersion · no hard exit)*

**Background**: `var(--koob-charcoal)` — the editorial charcoal from bryhel.com reference. Warm gold accents.

**Headline**: Typewriter reveal — manual JS character loop, one character per 35ms:
`"Get New Updates & Discount Offers."`

Cormorant Garamond italic, large, cream.

**Email input**: Full dark field, gold `border-bottom` only. Placeholder pulses opacity. `"SUBSCRIBE"` button — gold fill, obsidian text, shimmer on hover.

**On subscribe**: Canvas confetti burst (40 tiny amber/cream squares, radial explosion from button). Toast slides from top-right: `"You're in. ✦"`.

**Background decor**: A coffee bag illustration and paper cup float right, mouse-parallax responsive (`±12px` opposite cursor).

---

### SECTION 10 — FOOTER
*(igloo.inc: persistent context bar syncs to footer · smooth narrative close)*

**Background**: `#0a0e0b` — absolute near-black.

**Top border**: 1px gold line with shimmer sweep animation on scroll-entry.

**Logo**: `"KOOB"` — Playfair Display, 900, 3rem, cream. *(Easter egg)*: hover → tiny ☕ emoji rises with bounce and fades.

**4 columns**: Brand blurb · Page links · Social links · Contact

**Brand blurb**: *"Founded by Amir Ghzel in Jawhra, Sousse. A sanctuary where coffee meets culture."* — Cormorant Garamond italic, muted.

**Bottom strip**: `"© 2025 KOOB · All rights reserved · Happiness is one drink away"` — Space Mono, centered, `opacity: 0.35`.

**Persistent breadcrumb bar** (right edge, from igloo.inc) updates to `"05 FIND US"` and progress bar completes to 100%.

---

## ⚙️ FULL TECHNICAL SPEC

### Library Stack (CDN)
```html
<!-- GSAP Core -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js"></script>
<!-- Lenis Smooth Scroll -->
<script src="https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js"></script>
<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,900;1,700&family=Cormorant+Garamond:ital,wght@0,300;1,300&family=DM+Sans:wght@300;400;500&family=Space+Mono&display=swap" rel="stylesheet">
```

```javascript
gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

// Lenis + GSAP sync (required for scrub accuracy)
const lenis = new Lenis({ lerp: 0.08, smooth: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

### Hero Cup Pin Setup (igloo.inc scrub reference)
```javascript
// The main pinned cup scroll-rotate
ScrollTrigger.create({
  trigger: "#hero",
  start: "top top",
  end: "+=200%",
  pin: true,
  scrub: 1.5,
  animation: gsap.timeline()
    .to(".hero-cup", { rotateY: 25, rotateX: -8, duration: 1 })
    .to(".cup-liquid", { scaleY: 1, transformOrigin: "bottom", duration: 1 }, 0)
    .to(".cup-steam", { opacity: 1, y: -30, duration: 1 }, 0.3)
});
```

### Kinetic Type Scroll Velocity (bryhel.com reference)
```javascript
// Warp headline on scroll velocity
let velocity = 0;
ScrollTrigger.create({
  onUpdate: (self) => {
    velocity = self.getVelocity() / 1000;
    gsap.to(".hero-title", {
      scaleX: 1 + Math.min(Math.abs(velocity) * 0.04, 0.06),
      duration: 0.3,
      ease: "power2.out",
      overwrite: true,
      onComplete: () => gsap.to(".hero-title", {
        scaleX: 1, duration: 0.8, ease: "elastic.out(1, 0.5)"
      })
    });
  }
});
```

### Venetian-Blinds Reveal (bryhel.com reference)
```javascript
// Preloader split: 8 slats
const slats = gsap.utils.toArray(".preloader-slat");
gsap.to(slats, {
  clipPath: "inset(50% 0 50% 0)",
  stagger: 0.04,
  duration: 0.55,
  ease: "power3.inOut",
  delay: 3.0
});
```

### Panel Spring Snap (bryhel.com reference)
```javascript
// Section entry with spring physics
gsap.fromTo(".story-panel", 
  { y: 80, opacity: 0 },
  {
    y: 0, opacity: 1,
    duration: 1.2,
    ease: "elastic.out(0.8, 0.6)",
    scrollTrigger: {
      trigger: ".story-panel",
      start: "top 80%",
      toggleActions: "play none none reverse"
    }
  }
);
```

### Rack-Focus Hover (bryhel.com reference)
```javascript
// Card hover: expand hovered, shrink siblings
document.querySelectorAll(".ambiance-card").forEach(card => {
  const siblings = [...card.parentElement.children].filter(c => c !== card);
  card.addEventListener("mouseenter", () => {
    gsap.to(card, { scale: 1.03, duration: 0.4, ease: "power2.out" });
    gsap.to(siblings, { scale: 0.975, opacity: 0.75, duration: 0.4, ease: "power2.out" });
  });
  card.addEventListener("mouseleave", () => {
    gsap.to([card, ...siblings], { scale: 1, opacity: 1, duration: 0.4, ease: "power2.out" });
  });
});
```

### Persistent Breadcrumb (igloo.inc reference)
```javascript
// Right-edge progress bar + section label
const sections = ["01 HOME","02 STORY","03 MENU","04 AMBIANCE","05 FIND US"];
sections.forEach((label, i) => {
  ScrollTrigger.create({
    trigger: `section:nth-of-type(${i + 1})`,
    start: "top 50%",
    onEnter: () => updateBreadcrumb(label),
    onEnterBack: () => updateBreadcrumb(label)
  });
});

function updateBreadcrumb(label) {
  const el = document.querySelector(".breadcrumb-label");
  gsap.to(el, { opacity: 0, duration: 0.2, onComplete: () => {
    el.textContent = label;
    gsap.to(el, { opacity: 1, duration: 0.3 });
  }});
}

// Global scroll progress line
ScrollTrigger.create({
  start: "top top",
  end: "max",
  onUpdate: (self) => {
    gsap.to(".breadcrumb-progress", { height: `${self.progress * 100}%`, duration: 0.1 });
  }
});
```

### Coffee Bean Canvas Particles
```javascript
// 28 beans, teal-brown, drifting and rotating
const beans = Array.from({ length: 28 }, () => ({
  x: Math.random() * W, y: Math.random() * H,
  r: 7 + Math.random() * 10,
  rot: Math.random() * Math.PI * 2,
  rotSpeed: (Math.random() - 0.5) * 0.014,
  vx: (Math.random() - 0.5) * 0.22,
  vy: (Math.random() - 0.5) * 0.14,
  opacity: 0.12 + Math.random() * 0.25
}));
// Draw as filled ellipses with center-line stroke, color #1a6b52
```

### Page Load Master Timeline
```
t=0.0s  → Void: single teal point appears
t=0.3s  → Teal glow expands to 300px
t=0.8s  → KOOB logo SVG draws stroke-by-stroke
t=1.4s  → Steam wisp 1 rises
t=1.6s  → Steam wisp 2 rises
t=1.8s  → Steam wisp 3 rises
t=2.0s  → "KOOB" letters stagger in
t=2.4s  → Tagline types in character-by-character
t=3.0s  → Venetian-blinds split fires (8 slats, 40ms stagger)
t=3.5s  → Nav fades down from top
t=3.6s  → Hero cup enters from y:120 with elastic ease
t=3.8s  → Sub-tagline fades up
t=4.0s  → CTA button wipes in
t=4.1s  → Breadcrumb bar slides in from right
t=4.2s  → Scroll ring spins to life + bean particles activate
```

---

## 📐 RESPONSIVE

- **Mobile (< 768px)**: Horizontal carousel becomes vertical swipe. Floating cup scales to 60%. Hero type reduces. Breadcrumb bar hides. Kinetic type warping disabled.
- **Tablet (768–1200px)**: 2-col layouts stack. Cup pin still active.
- **All**: `prefers-reduced-motion: reduce` → disable all GSAP animations, keep opacity fades only. Lenis disabled, native scroll used.

---

## 🎬 THE 10 WOW MOMENTS (Priority Order)

| # | Moment | Reference | Why It Stuns |
|---|--------|-----------|--------------|
| 1 | **Void spawn → teal glow expand → venetian split** | igloo.inc + bryhel.com | Sets the entire world before a word is read |
| 2 | **Scroll-rotated coffee cup filling with liquid** | igloo.inc scrub shard | Makes the hero feel alive and physical |
| 3 | **Kinetic type warping on scroll velocity** | bryhel.com | Never seen on a café site — pure editorial luxury |
| 4 | **Rack-focus card hover (expand + siblings shrink)** | bryhel.com | Feels like a physical lens — deeply satisfying |
| 5 | **Waypoint gold particle burst when cup fills** | igloo.inc waypoints | Rewards the scroller — pure delight |
| 6 | **Persistent breadcrumb bar tracking scroll** | igloo.inc | Grounds the user in the narrative without interrupting |
| 7 | **Horizontal pinned drink carousel** | igloo.inc infinite scroll | Breaks scroll expectation — feels native app |
| 8 | **CTA background squeeze on hover** | bryhel.com | Unexpected physical comedy — makes people stay |
| 9 | **Arabic marquee strip with `صنعت بحب`** | KOOB identity | Anchors the Tunisian identity — emotional connection |
| 10 | **Spring-physics panel snap entries** | bryhel.com | Everything feels weighted and real, not floaty |

---

## 🛠️ DELIVERY FORMAT

- Single **HTML file** with embedded CSS and JS
- All libraries from CDN (GSAP, Lenis, Google Fonts)
- All images: Unsplash coffee photography URLs (no local assets needed)
- All icons and cup visuals: inline SVG
- Target: `LCP < 1.5s`, `INP < 200ms` on desktop; graceful degradation on mobile

---

> **Final Directive**: This is KOOB — a real café, a real founder, a real city. Every animation should feel like you are stepping through the actual door. The teal glow is the mirror entrance. The rotating cup is the portafilter locking in. The venetian slats opening are the shutters of the café lifting for the morning. Build it like it matters. Because it does.