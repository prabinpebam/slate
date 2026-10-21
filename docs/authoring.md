# Authoring with Slate

> Preserve source meaning, choose the clearest visual representation, compose from the catalog,
> and register every page. The canonical contract is the package's
> [SKILL.md](https://github.com/prabinpebam/slate/blob/main/SKILL.md).

## Choose a representation before writing

<div class="slate-card-grid" data-cols="3">
  <article class="slate-card">
    <h3 class="slate-card__title">Quantities become charts</h3>
    <p class="slate-card__body">Use the chart skill for measured values, trends, comparisons, proportions, and distributions. Keep the spec and accessible data alternative.</p>
  </article>
  <article class="slate-card">
    <h3 class="slate-card__title">Concepts become illustrations</h3>
    <p class="slate-card__body">Use semantic SVG for explanations, relationships, and spatial models. Use catalog steps for procedures and cards for parallel choices.</p>
  </article>
  <article class="slate-card">
    <h3 class="slate-card__title">Records can become Canvas</h3>
    <p class="slate-card__body">Use a read-only Canvas when named groups, repeated placements, or perspectives help readers explore a source-backed collection.</p>
  </article>
</div>

Do not fabricate values to fill a chart or force a simple list into a Canvas.
Prose is appropriate when a visual would not improve understanding.

## Compose a page

- Use Markdown for prose-heavy pages and HTML fragments for rich layout.
- Include exactly one H1 and a short opening takeaway. H2/H3 headings drive the table of contents.
- Reuse the [component gallery](../demo/components.html): heroes, TL;DR bands, cards, steps,
  comparisons, callouts, figures, tables, definition lists, badges, and attribution components.
- HTML content is a body fragment: no `html`, `head`, `script`, `style`, or `iframe`.
  Do not add inline styles or event handlers.
- Keep visuals local, give them meaningful text alternatives, and include a caption.
  Quantitative figures also need accessible underlying data.
- Use approved vector geometry from one icon library per artifact: Fluent, Material Symbols,
  or Font Awesome. Do not use emoji or hand-draw familiar icons.

The reader runs Markdown and HTML through one sanitized pipeline.
See [Markdown parity](../demo/markdown-parity.md) for rendered examples.

## Register navigation

Each manifest entry needs a host-relative `path`, a useful `title`, a content-appropriate Material
Symbols `icon`, and sensible `order`/`group` metadata.

```json
{
  "path": "guides/decisions.md",
  "title": "Decisions",
  "group": "Guides/Planning",
  "order": 2,
  "icon": "flag"
}
```

`group` defines the complete logical folder path. Without it, physical folders provide the
hierarchy. Links between content pages use their real relative paths; Slate rewrites them to
reader hash routes.

For a standalone tool or another reader host, use an HTML anchor with `target="_blank"` rather
than treating its entry page as a content fragment.

## Keep claims connected to sources

Never invent excerpts, data, sources, or version-history entries.
An excerpt reference must quote text that exists at its target anchor and identify both claim and
evidence provenance. Use ordinary source links when an excerpt preview is not needed.

For authored excerpt references, run from the consuming repository:

```powershell
node .\slate\scripts\validate-document-attributions.mjs --repo . --host docs
```

Install validator dependencies through your approved package source if needed.
The [canonical contract](https://github.com/prabinpebam/slate/blob/main/SKILL.md#excerpt-references-connect-content-to-a-source)
describes the exact attribution markup and rules.

## Validate the changed experience

Check manifest routes and links, then render the changed page over HTTP.
Exercise responsive layout, themes, keyboard access, motion, or Canvas only where the content
affects those surfaces. A structural check is not proof of visual quality.

## Specialized references

- [Component catalog](https://github.com/prabinpebam/slate/blob/main/components/README.md)
- [Visualization routing](https://github.com/prabinpebam/slate/blob/main/visualization/README.md)
- [Presentation authoring](https://github.com/prabinpebam/slate/blob/main/presentation/SKILL.md)
- [Canvas contract](https://github.com/prabinpebam/slate/blob/main/canvas/README.md)
- [Manifest and config schemas](https://github.com/prabinpebam/slate/tree/main/schema)
