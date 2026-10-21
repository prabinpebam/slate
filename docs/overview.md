# Slate documentation

> Slate is a portable, visual-first documentation system. This site is built with Slate itself:
> the guides and demos use the same reader, component vocabulary, and runtime shipped to adopters.

## Choose a starting point

<div class="slate-card-grid" data-cols="3">
  <article class="slate-card slate-card--interactive">
    <a href="getting-started.md">
      <h3 class="slate-card__title">Adopt Slate</h3>
      <p class="slate-card__body">Add the package to a repository and initialize a documentation host.</p>
    </a>
  </article>
  <article class="slate-card slate-card--interactive">
    <a href="authoring.md">
      <h3 class="slate-card__title">Author a page</h3>
      <p class="slate-card__body">Turn source material into visual explanations and consistent pages.</p>
    </a>
  </article>
  <article class="slate-card slate-card--interactive">
    <a href="demos.md">
      <h3 class="slate-card__title">Try the examples</h3>
      <p class="slate-card__body">Explore components, Markdown, SVG, presentations, and read-only Canvas.</p>
    </a>
  </article>
</div>

## How Slate fits together

<ol class="slate-steps">
  <li class="slate-step">
    <p class="slate-step__title">Start with source material</p>
    <p>The host owns the facts, content, authority, branding, and publication policy.</p>
  </li>
  <li class="slate-step">
    <p class="slate-step__title">Compose a visual-first explanation</p>
    <p>An author or agent follows Slate's contract, chooses a representation, and uses catalog components.</p>
  </li>
  <li class="slate-step">
    <p class="slate-step__title">Register and validate</p>
    <p>A manifest gives pages their navigation, titles, ordering, and icons. Runtime hashes detect drift.</p>
  </li>
  <li class="slate-step">
    <p class="slate-step__title">Publish static files</p>
    <p>The reader fetches content over HTTP. GitHub Pages is this site's host, not a required Slate service.</p>
  </li>
</ol>

## What you can publish

| Content | Representation |
| --- | --- |
| Prose and technical guidance | Markdown with headings, code, tables, and callouts |
| Rich layouts | Sanitized HTML fragments composed from Slate components |
| Quantities | Declarative chart specs rendered offline to static SVG |
| Concepts and relationships | Semantic SVG illustrations |
| Presenter-led narratives | Slide sections with presenter controls and optional motion |
| Explorable structured records | Read-only Canvas in a separate full-viewport tab |

Canvas does not support editing or write-back. Presenter-controlled motion is experimental.
Ordinary reader pages do not load the Canvas application.

## Read, publish, or contribute

- [Reader guide](reader-guide.md): navigation, search, deep links, themes, and reader perspectives.
- [GitHub Pages](github-pages.md): how this site is assembled, deployed, and maintained.
- [Maintaining Slate](maintaining.md): package boundaries, focused validation, and host upgrades.
- [Repository](https://github.com/prabinpebam/slate): source code and canonical authoring references.
