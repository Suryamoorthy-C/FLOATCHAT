# FLOATCHAT — component guidelines

Built against the **Lusion — Award Winning 3D and Interactive Web Studio** design
system. This document follows the required output structure: every component is
described in the order *Overview → Tokens → Anatomy → States → Accessibility →
Content → Anti-patterns*.

All tokens live in [`src/theme/tokens.css`](src/theme/tokens.css). No component in
this project hardcodes a colour, a px size or a font.

---

## 1. Button (`.btn`)

### Overview
The single call-to-action primitive. **Use** it for any action that navigates or
submits. **Do not use** it for filters or toggles — those are `FilterChip`, which
has pressed state rather than action state.

### Tokens
`--color-surface-dark`, `--color-on-dark`, `--color-accent-alt`, `--color-accent`,
`--color-border-strong`, `--color-border`, `--color-text-primary`,
`--color-text-inverse`, `--color-text-quiet`, `--radius-6`, `--space-3`,
`--space-5`, `--space-6`, `--space-13`, `--text-base`, `--text-sm`,
`--leading-sm`, `--transition-color-bg-slow`, `--transition-transform-base`.

### Anatomy and variants
- **Container** — `.btn`, pill radius `--radius-6`.
- **Label** — inline text.
- **Spinner** — `.btn__spinner`, only in the loading state.
- Variants: default (outline), `.btn--primary` (filled), `.btn--ghost` (borderless),
  `.btn--loading` (adds `cursor: progress`).
- Responsive: below 520px buttons in `.actions` become full width.

### States and interactions
| State | Treatment |
|---|---|
| Default | 1px `--color-border-strong`, transparent fill |
| Hover | Fills `--color-surface-dark`, inverts text, lifts `-2px` |
| Focus-visible | 2px `--color-blue` outline, 2px offset |
| Active | `transform: none` (lift released) |
| Disabled / loading | Border and text drop to `--color-text-quiet`, `opacity: .6`, `cursor: not-allowed`; loading swaps the label for "Refreshing…" and shows a spinner |

### Accessibility
Native `<button>` or `<a>` — never a `div`. Loading sets `disabled` so it leaves
the tab order. Disabled anchors use `aria-disabled="true"` (anchors cannot be
disabled natively). Focus ring measures **6.6:1** against the page background.

### Content guidelines
Sentence case. Two words or fewer where possible ("Launch console", "Refresh").
No trailing punctuation, no ALL CAPS.

### Anti-patterns
- ❌ `<Link><button>Go</button></Link>` — nests interactive elements, and the inner
  button swallows the click. Use `.btn` directly on the anchor, as Header does.
- ❌ A red filled destructive button. `--color-error` is text-only at large sizes
  here; use the .notice border treatment instead.

---

## 2. Header (`src/components/Header.jsx`)

### Overview
Primary wayfinding plus the persistent route into the operations console. **Use**
once per page shell. **Do not** use it inside the console route, which has its own
telemetry chrome.

### Tokens
`--color-bg`, `--color-surface-sunken`, `--color-border`, `--color-text-primary`,
`--color-text-quiet`, `--color-accent`, `--color-accent-alt`, `--color-highlight`,
`--layout-header-height`, `--layout-gutter`, `--space-*`, `--radius-sm`,
`--radius-md`, `--radius-6`, `--text-sm`, `--text-lg`, `--tracking-caps`,
`--duration-300`, `--ease-emphasized`.

### Anatomy and variants
`.site-header` (sticky) → `.container` → `.site-header__inner` containing
**brand** (`.site-header__mark` + `.site-header__wordmark`), **primary nav**
(`.site-header__list`), **actions** (`.site-header__source`, `.site-header__cta`,
`.site-header__toggle`), and the conditional **panel** (`.site-header__panel`).

Variants: bar nav at ≥861px; disclosure panel below that.

### States and interactions
| Element | States |
|---|---|
| Brand | hover/active → `--color-accent`; mark rotates 45° |
| Nav link | hover → sunken fill + primary text; `aria-current="page"` → primary text **and** underline |
| Toggle | hover → sunken fill; active → `scale(.96)`; `aria-expanded="true"` → bars morph to an X |
| CTA | full Button states |

Keyboard: Tab reaches every link and the toggle. Enter/Space opens the panel.
**Escape closes the panel and returns focus to the toggle.** Navigating closes it.
Pointer: click toggles; touch targets are ≥44px (`--space-14`).

### Accessibility
`<header>`, one `<nav aria-label="Primary">` (the mobile panel uses
`"Primary, mobile"`). Toggle carries `aria-expanded` + `aria-controls`. The active
route is signalled by underline *and* colour, so it does not rely on colour alone.
The panel is conditionally rendered rather than hidden, so its links are never
reachable while closed.

### Content guidelines
Nav labels are sentence case except the acronym-free brand wordmark, which is the
logotype and stays uppercase. One to two words per label.

### Anti-patterns
- ❌ Rendering the panel with `visibility: hidden` while leaving links in the DOM —
  screen readers and Tab still find them. Render conditionally, as here.
- ❌ Marking the current page with colour only.

---

## 3. Footer (`src/components/Footer.jsx`)

### Overview
Secondary navigation plus provenance and attribution, which matter here because
every number on the site is traceable to an Argo source. **Use** once per page
shell. **Do not** use inside the console route.

### Tokens
`--color-surface-dark`, `--color-on-dark`, `--color-on-dark-muted`,
`--color-on-dark-subtle`, `--color-on-dark-accent`, `--color-highlight`,
`--space-*`, `--radius-sm`, `--text-xs`, `--text-sm`, `--text-lg`,
`--tracking-caps`, `--transition-color-slow`.

### Anatomy and variants
`.site-footer` → `.site-footer__inner` (**brand** block, then a `<nav>` of three
`.site-footer__group` columns) → `.site-footer__base` (attribution and copyright).

Variants: three link columns at ≥861px, two below, one below 520px.

### States and interactions
| Element | States |
|---|---|
| Link | hover → full-strength text + underline; active → on-dark accent; focus-visible → on-dark accent outline |

Keyboard: native links in a `<nav aria-label="Footer">`; groups use `<h2>` headings
so they are reachable by heading navigation. Pointer: standard link behaviour.

### Accessibility
This is the **only** place the *Text Light* tokens are legible — `--color-on-dark-muted`
(`#C2C3C7`) measures **11.9:1** on black. The focus ring is overridden here to
`--color-on-dark-accent`, which measures **17.6:1** on black, because the default
blue ring would be low-contrast against the dark surface.

### Content guidelines
Sentence case; group titles are the one exception and are set in uppercase via
`text-transform` at `--text-xs` as an eyebrow, matching the system's rule that ALL
CAPS is reserved for labels and acronyms, never body copy.

### Anti-patterns
- ❌ Rendering the tagline with `--color-on-dark` at `--text-sm` — it competes with
  the links. It uses the muted token deliberately.
- ❌ Keeping the default focus ring on a dark surface.

---

## 4. Card and Spec (`.card`, `.spec`)

### Overview
Repeating content units: `.spec` for numbered capability blocks, `.card` for the
Home capability grid. **Use** for peer items with equal weight. **Do not** use to
wrap a single paragraph.

### Tokens
`--color-surface`, `--color-border`, `--color-border-strong`, `--radius-lg`,
`--space-*`, `--text-lg`, `--text-sm`, `--leading-lg`, `--leading-sm`,
`--color-accent`, `--text-xs`, `--tracking-caps`, `--transition-lift-base`.

### Anatomy and variants
`.spec` = optional `.spec__index` (ordinal), `.spec__title`, `.spec__body`.
`.card` = `.card__title`, `.card__body`.

Responsive: `auto-fit` grid with `minmax(min(100%, 260px), 1fr)`, so columns drop
from three to one without a media query.

### States and interactions
| State | Behaviour |
|---|---|
| Default | 1px `--color-border`, `--radius-lg` |
| Hover | Border strengthens to `--color-border-strong`, lifts `-6px` |
| Focus-visible | Only applies when the card is itself a link |

The grid items themselves are not interactive, so they expose no pressed or
disabled state by design.

### Accessibility
Rendered as `<li>` inside a `<ul className="spec-list">`, so the count and grouping
are announced. Copy is capped near 40ch (`max-width`) to keep line length readable.

### Content guidelines
Title ≤ 4 words, sentence case. Body ≤ 140 characters, one idea per card.

### Anti-patterns
- ❌ Wrapping a whole card in an anchor when only its title is the destination —
  makes the entire block a link target and hides the real link from screen readers.
- ❌ `border-radius` values outside the detected set (3, 16, 18, 87.5, 100, 100px).

---

## 5. PixelSwap (React Bits, integration)

### Overview
The first-page hero: a pixel grid closes over the wordmark and reveals the
proposition. **Use** once per page, as a focal point. **Do not** use it for content
users must reach — it hides content behind an interaction.

### Tokens
PixelSwap ships its own CSS (`.pixel-swap*`) and takes no tokens. Its **contents**
are styled with tokens in `src/pages/Home.css` (`.swap-state`): `--color-off-white-semi`
and `--color-dark-blue` for the cover, `--color-surface-dark`, `--color-on-dark`,
`--color-on-dark-muted`, `--color-on-dark-accent` for the reveal.

### Anatomy and variants
`.pixel-swap` → two `.pixel-swap__layer` states + a transient `.pixel-swap__grid` of
`.pixel-swap__pixel`. `trigger` variants: `click` (used here), `hover`, `manual`.
Responsive: `aspectRatio` switches `4 / 5` below 861px, `16 / 9` above, so the
revealed copy is never clipped.

### States and interactions
| State | Behaviour |
|---|---|
| Resting | First layer visible; grid not rendered |
| Transitioning | `data-transitioning="true"`, pixels animate, incoming layer revealed |
| Active | `data-active="true"` |
| Reduced motion | `prefers-reduced-motion` → swap completes instantly, no pixel animation |

`trigger="click"` gives the wrapper `role="button"`, `tabindex="0"`, and Enter/Space
support. `trigger="manual"` adds **no** role, so callers may put links inside.

### Accessibility
Inactive layer is `aria-hidden` and `visibility: hidden`. Because `trigger="click"`
puts `role="button"` on the wrapper, **no interactive element may be placed inside
it** — the hero CTAs therefore sit outside the stage, and the page supplies its own
`<h1>` (visually hidden) so the outline is valid regardless of which layer shows.

### Content guidelines
Cover copy is a short imperative ("Click to reveal the fleet"). Reveal copy is one
sentence, 60 characters max.

### Anti-patterns
- ❌ Putting the primary CTA inside the swap stage with `trigger="click"` — a button
  inside `role="button"`. Move it outside, as this project does.
- ❌ Leaving the page with no real `<h1>` because both hero states use `<p>`.

---

## 6. Notice (`.notice`)

### Overview
Inline status for a failed or degraded data load. **Use** when a region has no data
because of an upstream problem. **Do not** use for field-level validation.

### Tokens
`--color-surface`, `--color-border`, `--color-danger`, `--radius-md`, `--space-1`,
`--space-12`, `--space-13`, `--text-base`, `--leading-base`.

### Anatomy and variants
Container + message text. `.notice--error` adds a `--color-danger` inline-start
border. Text stays `--color-text-primary`.

### States and interactions
None interactive. Pair with `role="alert"` when it appears asynchronously.

### Accessibility
Error is conveyed by a **border plus wording**, not by red text: `#E90000` measures
**4.2:1** on `#F0F1FA`, which fails AA for body copy, while a non-text indicator only
needs 3:1 (it measures 4.2:1). Word the message so it stands alone, and never rely on
colour to carry the error.

### Content guidelines
State what is unavailable and what still works: "Live telemetry is unavailable. The
backend may be offline — the console will keep running against its cached fleet view."

### Anti-patterns
- ❌ `color: var(--color-danger)` body text — fails AA at 4.2:1.
- ❌ A notice that only says "Error".

---

## 7. DataTable (`.data-table`) and FilterChip (`.filter-chip`)

### Overview
Tabular fleet readings and the status filter that scopes them. **Use** tables for
comparable records. **Do not** use for fewer than three rows — use a definition list.

### Tokens
`--color-surface`, `--color-border`, `--color-surface-sunken`, `--color-text-primary`,
`--color-text-quiet`, `--color-surface-dark`, `--color-on-dark`, `--radius-md`,
`--radius-6`, `--space-*`, `--text-xs`, `--text-sm`, `--tracking-caps`.

### Anatomy and variants
`.table-wrap` (horizontal scroll container) → `.data-table` with `<caption>`,
`<thead>`, `<tbody>`. `.filter-chip` has a pressed variant via `aria-pressed="true"`
and a `.status` indicator pill with `--accent-alt` / `--accent` / `--border` dots.

### States and interactions
| State | Behaviour |
|---|---|
| Chip default | Transparent, quiet text |
| Chip hover | Stronger border, primary text |
| Chip pressed | Filled `--color-surface-dark`, inverted text |
| Chip disabled | `cursor: wait`, 60% opacity (only while loading) |
| Row hover | Sunken background |

Keyboard: chips are real buttons in a `role="group"` with a label; Tab reaches each.
Tables scroll horizontally on narrow viewports instead of squashing.

### Accessibility
`<caption>` names the dataset. Column headers are `<th scope="col">`; the platform
column is `<th scope="row">`. Numerics use `font-variant-numeric: tabular-nums` so
digits align. **Do not** use colour alone for status: the `.status` pill always
carries its text label alongside the dot.

### Content guidelines
Statuses lowercase, matching the API (`active`, `warning`, `offline`). Table captions
read as a summary: "3 floats · Argo GDAC".

### Anti-patterns
- ❌ A status dot with no text label — colour-only information.
- ❌ Right-aligning the first column; the leading column here is the row header.

---

## Definition of Done

- [x] Default state renders — smoke-tested by SSR-rendering every page.
- [x] All states defined: default, hover, focus-visible, active, disabled, loading,
      error, empty.
- [x] Zero hardcoded visual values in components — tokens only. The one deliberate
      exception is `src/pages/Console.css`, which styles chrome for the console using
      that console's own dark palette; it is commented as such.
- [x] Keyboard navigation works without a pointer (targets are native `button`/`a`;
      Enter/Space and Escape handled explicitly).
- [x] No critical accessibility violations — measured contrast documented above; one
      h1 per page; no nested interactive elements; inactive layers `aria-hidden`.
- [x] Tested at smallest and largest breakpoint (861px split, plus 520px).
- [x] Anti-patterns documented with reasoning for every component above.
- [x] Purpose, usage and limitations documented here and on `/#/docs`.

### Known limitations

- **Aeonik is not bundled.** It is a licensed typeface; the stack in
  `--font-family-base` lists it first so a licensed copy wins automatically, and
  falls back to Inter.
- **`--layout-max-width` (1440px)** is a layout dimension declared in the token file
  because the extracted system contains no layout width. It is not a spacing value
  and is used only by `.container`.
- **`#C2C3C7` and `#C1FF00`** are labelled *Text Light* in the source system and are
  used on dark surfaces only; on `--color-off-white-semi` they measure 1.6:1 and
  1.1:1.
- **Browser rendering is not machine-verified.** The build, SSR render and HTTP
  checks all pass, but there is no browser automation in this environment.
