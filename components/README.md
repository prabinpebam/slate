# Component Catalog

The authoring vocabulary. Each file is a **copy-paste example** and a **few-shot pattern**. Compose
pages from these components only; never invent CSS. Full contracts:
[specs/04-component-library.md](../../specs/04-component-library.md).

## Reader-persona disclosure

Hosts may configure `readerPersonas` and `defaultReaderPersona` in `slate.config.json` or the
v2 manifest config. Add a space-separated `data-reader-personas` value to an `h2` or `h3` when
that section is especially useful to those readers:

```html
<h2 data-reader-personas="product-manager designer">Experience contract</h2>
```

Selecting a persona expands matching sections and collapses the other tagged sections. Collapsed
sections remain in the document, table of contents, search index, and accessibility tree when
expanded. Untagged sections are shared context and remain expanded. Use this only to prioritize
one canonical document; never duplicate or alter requirements by persona.
Matching nested sections also expand their ancestors so they remain visible. Deep links reveal
secondary sections, and an explicit "All readers" preference is preserved across reloads.

## Naming convention

- Block: `slate-<name>` - e.g., `slate-card`
- Element: `slate-<name>__<part>` - e.g., `slate-card__title`
- Variant: `slate-<name>--<variant>` - e.g., `slate-callout--warning`

## Content shape → component

| If the content is… | Component | Example | MD-native? |
| --- | --- | --- | --- |
| A one-line page summary | TL;DR band | [tldr.html](tldr.html) | auto |
| A page title + lead-in | Hero / page header | [hero.html](hero.html) | auto |
| An aside / warning / tip | Callout | [callout.html](callout.html) | via `[!TYPE]` |
| Parallel items or links | Card grid | [card-grid.html](card-grid.html) | HTML |
| A big number / KPI | Metric tile | [metric-tile.html](metric-tile.html) | HTML |
| A status / label word | Badge | [badge.html](badge.html) | HTML |
| An ordered procedure / phases | Steps / Timeline | [steps.html](steps.html) | HTML |
| Two options side by side | Comparison | [comparison.html](comparison.html) | HTML |
| Key/value specs | Definition list | [defs.html](defs.html) | HTML |
| An image with a caption | Figure | [figure.html](figure.html) | via syntax |
| Tabular data | Table | [table.html](table.html) | yes |
| Code | Fenced code block (Markdown) | - | yes |
| A section's iteration/change history | Version history pill + modal | [version-history.html](version-history.html) | HTML |
| A link to an excerpt on another page | Excerpt reference pill + popover | [xref.html](xref.html) | HTML |
| A slide in a presenter-led deck | Slide (deck section) | [slide.html](slide.html) | HTML |
| A presenter's script for a slide | Talking track (collapsed) | [talk-track.html](talk-track.html) | HTML |

## v1.1 (deferred)

Tabs, accordion, and Mermaid diagrams - see
[specs/12-decisions.md](../../specs/12-decisions.md) (D-SCOPE-1).

## Rules

- Body fragments only (no `<head>`/`<html>`).
- Token-driven classes only; no inline `style=`, no `<style>`/`<script>`.
- One H1 per page; H2/H3 drive the TOC.
- Every page opens with a TL;DR band.
