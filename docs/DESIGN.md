# DESIGN.md — Melodio

## Thesis

The interface is a **neutral frame around the music**. Chrome, lists and
navigation are drawn in paper and graphite; the only saturated colour on screen
comes from the music itself — album artwork, and the accent that marks state.
This is a music player you look at briefly and then look away from.

## Own world

- **Ground:** cool paper in light mode (`#f3f3f5`), near-black in dark
  (`#0c0c0e`). Content sits directly on it; there are no floating cards.
- **Structure:** hairline rules (`rgba(17,17,20,.08)`, drawn at half a device
  pixel) separate rows and groups. Structure comes from lines, not shadows.
- **Rows:** flat, full-bleed, 60px minimum, artwork at 44–48px with a 6px
  radius and an inset hairline. Pressing tints the row; nothing lifts or moves.
- **Type:** system stack, 32px large titles with tight tracking, 15px body,
  11px uppercase section labels, tabular numerals for times and sizes.
- **Accent:** one user-chosen colour, default muted cobalt `#3d63dd`
  (`#8b9dff` in dark). It marks state, never decoration: the current track and
  its row wash, selection, switches, progress, the active segmented view, the
  one committed action on a screen (search submit, play-all, the player's
  transport), a changed rate, and focus borders. Type drawn on a filled accent
  surface uses `--on-primary-color`, computed from the accent's lightness.
- **Player:** the one place the interface takes colour from content — a soft
  radial wash tinted by the cover's dominant colour, extracted on a 24×24
  canvas and normalised to a usable saturation and lightness.
- **Motion:** short and functional. Sheets slide up, covers fade in, rows do
  not animate on entry. `prefers-reduced-motion` is respected.
- **Icons:** outline icons in `--text-secondary`; they are markers, not
  decoration. Filled colour is reserved for state.

## Explicitly not

Gradients on surfaces, backdrop blur, glass panels, floating card stacks,
hover lift, per-row entrance animation, coloured halo shadows, primary-coloured
icons used decoratively, pill-shaped everything.

## Tokens

Defined in `src/theme/theme.scss` (`:root` and `.dark`), with all legacy custom
property names retained so older call sites stay coherent:

- Spacing `--space-1 … --space-10` (4–40px)
- Type `--font-size-xs … --font-size-title` (11–32px)
- Radius `--radius-xs … --radius-full`; `--radius-pill` for chips and toggles
- Elevation `--elevation-0 … --elevation-4` (only for things that float)
- Motion `--duration-*`, `--ease-out-expo`
- Surfaces `--bg-color`, `--bg-elevated`, `--bg-input`, `--bg-secondary`,
  `--chip-bg`, `--bg-card-dimmed`
- Lines `--hairline`, `--hairline-strong`
- Text `--text-color`, `--text-secondary`, `--text-tertiary`, `--text-disabled`
- Accent `--primary-color`, `--primary-color-rgb`, `--selection-bg`,
  `--on-primary-color` (type on a filled accent surface)
- Player wash `--wash-rgb`, `--wash-strength`
- Ground layers `--bg-solid` (always opaque, for the native status bar and strips
  that must occlude), `--bg-page` (the single tint layer the router wrapper
  paints), `--bg-page-soft` (the same tint for overlays that sit above it)

## Wallpaper (the one sanctioned exception)

A user-supplied background image is the only decoration allowed behind the
interface. It never reaches the components: one fixed layer at `.router-view-wrapper`
z-index 0 carries the image, and `html.has-wallpaper` turns page-level
`--bg-color` transparent so the tint lands exactly once at `--bg-page`
(`rgba(--bg-color-rgb, --wallpaper-ground-alpha)`, floor 0.08 so text stays
legible). Strips that must occlude content — the now-playing bar, swatch rings,
`html, body`, the native status bar — keep using opaque `--bg-solid`. Controls:
transparency 0–100 %, blur 0–40 px, fit cover/contain/stretch. The image is
downscaled to 1600 px, encoded as JPEG, and written through Capacitor Filesystem
to the app data directory under a fixed name (`wallpaper.jpg`); `localStorage`
holds only that managed filename, never image data, and the renderable URL is
resolved at read time by the same file-src path as other local artwork.
`setWallpaper` accepts the managed filename and nothing else — `data:` URLs,
remote URLs, `javascript:`, and any other scheme are rejected before the value
can reach a CSS `url()` or the store. The blur is the CSS `filter` on that
layer, not a glass panel on any surface.

## Shared patterns

`src/theme/mixins.scss` is injected into every SCSS block by `vite.config.ts`.
The patterns that carry the world:

- `list-row` — flat row, hairline at the bottom, tint on hover/active/selected
- `section-label` — 11px uppercase group heading
- `large-title` — screen title
- `icon-button` — quiet 40px square tap target
- `cover-thumbnail` — artwork with inset hairline
- `empty-state` — centred placeholder
- `dialog-overlay` / `dialog-container` / `dialog-*` — opaque sheet, no blur
- `bottom-actions` / `action-btn` — fixed hairline-topped select bar

## Screen notes

- **Library:** large title with play and overflow actions, search field, a
  segmented control for songs/playlists, then a flat list.
- **Song list:** back/search/overflow nav, 96px cover + title identity, a
  primary pill for play-all, then rows.
- **Player:** cover wash, large artwork, title, progress with tabular times,
  transport row with a solid play/pause disc, queue below with drag handles.
- **Settings:** 52px bar, group labels, 52px rows with hairline separators and
  indented descriptions; switches 44×26 in the accent colour.
- **Downloads:** segmented active/history control, rows with a 3px progress
  rule inside the row.
- **Online search:** back + search field, history chips, flat results, bottom
  action bar in select mode.
- **Sort editor:** nav with a primary save button, sort select and order toggle,
  draggable rows marked by a 2px accent line at the drop edge.
