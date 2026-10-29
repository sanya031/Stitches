# Design system checklist

Order: rough interface → controls list → foundations → atoms → components → panel.
Everything is built on the design page (`/design/`), never in the lab.
Light and dark themes from the start: every colour is a token with a light and a dark value.

## 0. Inputs
- [x] The panel design (Figma link or screenshots)
- [x] The tonal palettes made so far: neutrals, primary, surface, plus whatever else is started
- [x] Decide which palettes are still missing (see 3. Colour)

## 1. Rough interface (grey boxes, no styling)
- [ ] Header: piece name and summary line, mode pill (Stitch / Animate / Export), undo/redo, theme, account, save state
- [ ] Tool bar (floating, left)
- [ ] Canvas area with a placeholder cloth
- [ ] Zoom cluster (floating, bottom right)
- [ ] Selection bar (floating over a selection)
- [ ] Properties panel (right) with its sections stubbed out
- [ ] Sheets and popovers: piece settings, stitch library, colour picker, shortcuts
- [ ] Check at narrow widths: where the panel goes on a tablet or phone

## 2. Controls list
- [ ] Agree on the list below: every control, what kind it is, where it's used
- [ ] Note every state each one needs: rest, hover, pressed, focus, disabled, mixed (a selection with different values), loading, error

## 3. Foundations (tokens)
Colour
- [x] Tonal ramps: primary (terracotta), neutral, status (crimson), brand (ochre, periwinkle, leaf, lilac) in `tokens.css`
- [x] Status: crimson only, for errors; saved, unsaved and tips use neutral text and icons
- [x] Semantic roles that point at ramp steps, in both themes: background, surface levels (bench, panel, raised, well, overlay), text (strong, default, muted, disabled), border (subtle, default, strong), accent (fill, ink on it, hover, pressed), focus ring, selection, status colours
- [x] Cloth and thread stay out of the UI ramps: they're content, not chrome
- [x] Light mode keeps the cloth the brightest thing (the bench sits a step darker than the cloth, or the cloth gets a frame)
- [x] Light mode stays warm, not light grey (must not resemble Epoch): neutrals are warmed
- [x] Contrast check: 4.5:1 for text, 3:1 for control edges and icons, in both themes

Type
- [x] Scale: title, heading, subheading, body, label, label-strong, caption, eyebrow in Golos Text; no mono, numbers use tabular figures
- [x] Weights, line heights, letter spacing; tabular numbers for readouts

Space and shape
- [ ] Spacing scale (4-based)
- [ ] Radius scale (control, card, panel, pill)
- [ ] Border widths
- [ ] Elevation: shadows for floating controls, popovers and sheets in both themes
- [ ] Sizes: 44 px targets, icon sizes, panel width
- [ ] Motion: durations, easings and springs; reduced-motion rules
- [ ] Layering order (z-index): canvas, floaters, panel, popovers, sheets, toasts

Delivery
- [x] One `tokens.css`: ramps as raw values, roles as variables, switched by `[data-theme]` and the system setting
- [ ] Token pages on the design page: swatches with contrast numbers, type specimens, spacing and radius rulers
- [ ] Light/dark switch on the design page itself

## 4. Atoms
- [ ] Button: primary, secondary, ghost, danger; sizes; with icon
- [ ] Icon button (44 px target)
- [ ] Segmented pill (mode switcher, small option switches)
- [ ] Toggle switch
- [ ] Checkbox
- [ ] Slider (plain) and stage slider (with the preview bubble)
- [ ] Number field with steppers and a unit
- [ ] Text input, text area, search field
- [ ] Select / dropdown
- [ ] Label and helper text, error text
- [ ] Tooltip (with shortcut)
- [ ] Shortcut key (kbd)
- [ ] Badge / count
- [ ] Divider
- [ ] Skein (a thread colour as a skein, not a flat swatch)
- [ ] Spinner and progress bar
- [ ] Focus ring

## 5. Components
Panel pieces
- [ ] Section: heading, collapse, optional action
- [ ] Field row: label, control, value, "Mixed" state
- [ ] Stitch row: preview, name, submenu arrow
- [ ] Stitch library: grouped list (Counted, Fill, Freeform), submenu for variants
- [ ] Colour picker: sources as tabs (In this piece, Floss library, My palettes, From image), search, recent
- [ ] Skein list (In this piece): count, skeins needed, click to select by colour
- [ ] Layer row: show/hide, lock, drag to reorder
- [ ] Image object controls: drop zone, Pattern and Stitched toggles, conversion settings
- [ ] Text object controls: text, style, font, size, spacing, baseline
- [ ] Context header: what the panel is acting on (tool, selection, object)

Floating
- [ ] Tool bar with tool options on hold or right-click
- [ ] Zoom cluster
- [ ] Selection bar
- [ ] Popover and menu

Page level
- [ ] Header and summary line
- [ ] Sheet / modal (piece settings, shortcuts)
- [ ] Toast
- [ ] Save state indicator
- [ ] Empty state, loading state, error banner

## 6. Panel
- [ ] Stitch tab with nothing selected (tool settings)
- [ ] Stitch tab with a selection (one stitch type, mixed stitch types)
- [ ] Stitch tab with an image selected
- [ ] Stitch tab with text selected
- [ ] Animate tab
- [ ] Export tab
- [ ] Both themes, keyboard only, narrow widths

---

## Controls list

| Control | Kind | Where |
|---|---|---|
| Mode switch: Stitch / Animate / Export | Segmented pill | Header |
| Piece name, summary line | Text button that opens a sheet | Header |
| Undo, redo | Icon buttons with tooltip and shortcut | Header |
| Theme | Icon button or 3-way pill (light, dark, system) | Header / account menu |
| Save state | Status text with icon | Header |
| Tools: select, stitch, fill, pattern, text, image, erase, pan | Icon buttons, one pressed at a time, options menu | Tool bar (floating) |
| Select mode: rectangle, wand, by colour | Menu off the select tool | Tool bar |
| Zoom out, zoom %, zoom in, fit, real size | Icon buttons and a menu | Zoom cluster (floating) |
| Move, recolour, stitch type, duplicate, delete | Icon buttons | Selection bar (floating) |
| What the panel is acting on | Context header with actions | Panel top |
| Stitch | Stitch row that opens the stitch library | Panel: Stitch |
| Stitch variant | Submenu off a stitch row | Stitch library |
| Thread colour | Skein that opens the colour picker | Panel: Thread |
| Colour sources | Tabs inside the picker | Colour picker |
| Floss search | Search field | Colour picker |
| Colours from an image | Drop zone, then a row of skeins | Colour picker |
| Thread type | Select | Panel: Thread |
| Strands | Stage slider | Panel: Thread |
| Perle weight | Segmented pill | Panel: Thread (perle only) |
| Density | Stage slider | Panel: Fill |
| Angle | Dial or number field | Panel: Fill, satin |
| Fill variant | Small grid of previews | Panel: Fill |
| Colours in this piece | Skein list | Panel |
| Layers | Layer rows | Panel |
| Image: Pattern, Stitched | Toggle switches | Panel: Image |
| Image: colours, detail, dither, background, outline | Number field, slider, toggles | Panel: Image |
| Image: size on fabric | Number fields with unit | Panel: Image |
| Text content | Text input | Panel: Text |
| Text style: Sampler / Script | Segmented pill | Panel: Text |
| Font | Select with previews | Panel: Text |
| Size, spacing | Number fields / sliders | Panel: Text |
| Baseline: straight / arc | Segmented pill plus a slider | Panel: Text |
| Fabric | Grid of fabric previews, in two groups | Piece settings |
| Count | Stage slider | Piece settings |
| Fabric colour | Skein / colour picker | Piece settings |
| Piece size | Number fields, unit pill, presets | Piece settings |
| Stitch-in order, speed | Select, slider | Animate |
| Playback | Play button and a scrub bar | Animate |
| Tug strength, spring back | Sliders | Animate |
| Wear rate, snap threshold, heals or stays worn | Sliders, toggle | Animate |
| Wear stage preview | Segmented pill | Animate |
| Mend | Tool button | Animate |
| Embed code | Code block with copy | Export |
| Wear mode: off / per visitor / shared | Segmented pill | Export |
| Format and size | Segmented pill, number fields | Export |
| Download | Primary button with progress | Export |
