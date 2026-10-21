# Demo guide

> These examples run on the same Slate runtime as the guides. Explore individual examples here,
> or open the standalone demo host to try its complete navigation and Canvas launch.

## Pick an example

<div class="slate-card-grid" data-cols="2">
  <article class="slate-card slate-card--interactive">
    <a href="../demo/components.html">
      <h3 class="slate-card__title">Component gallery</h3>
      <p class="slate-card__body">Inspect reusable content patterns and author/reviewer disclosure.</p>
    </a>
  </article>
  <article class="slate-card slate-card--interactive">
    <a href="../demo/markdown-parity.md">
      <h3 class="slate-card__title">Markdown parity</h3>
      <p class="slate-card__body">See headings, tables, code, callouts, and rich content through the shared pipeline.</p>
    </a>
  </article>
  <article class="slate-card slate-card--interactive">
    <a href="../demo/svg-illustration.html">
      <h3 class="slate-card__title">SVG illustration</h3>
      <p class="slate-card__body">Try semantic, theme-aware illustration with viewport entry and replay.</p>
    </a>
  </article>
  <article class="slate-card slate-card--interactive">
    <a href="../demo/presentation-motion.html">
      <h3 class="slate-card__title">Presentation motion</h3>
      <p class="slate-card__body">Explore presenter-controlled animation and static reading fallbacks.</p>
    </a>
  </article>
</div>

Additional fixtures include a worked strategy brief,
[Operation Mount Doom](../demo/quest-brief.html), the generated
[Council briefing deck](../demo/generated-motion.html), and the
[demo overview](../demo/landing.html).
The demo content follows one fictional storyline: a small company carrying a Ring to Mount Doom. It
is an affectionate homage, not affiliated with any rights holder, and every number in it is made up.
These are illustrative fixtures, not statements of a consuming project's policy or product truth.

## Open the standalone demo

<p><a href="../demo/index.html" target="_blank" rel="noopener">Open the complete demo reader in a new tab</a>.</p>

The demo has its own manifest, config, and generated runtime in the published artifact.
Its navigation includes the structured-information Canvas as a separate full-viewport tool.

<p><a href="../demo/shell/canvas/index.html?document=structured-information.canvas.json" target="_blank" rel="noopener">Open the read-only Canvas directly</a>.</p>

The direct Canvas link is available in the built site. When serving the source repository's
`demo/` without a site build, use `npm run build:site` and serve `_site/` to get that generated
demo runtime.

## Understand the sanitizer fixture

The [sanitizer test](../demo/sanitizer.html) deliberately contains unsafe markup and a missing
image to demonstrate stripping and failure behavior. A broken image or blocked action on that
specific page is expected. Do not copy its unsafe authoring patterns into documentation.

## Use the examples responsibly

Copy documented component structure rather than adding page-specific scripts or styles.
For a new topic, replace the example meaning with real source material and follow
[Authoring](authoring.md). For package changes, validate the specific example and affected behavior
as described in [Maintaining Slate](maintaining.md).
