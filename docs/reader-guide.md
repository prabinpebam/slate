# Reader guide

> Use the navigation tree to browse, search to jump to a topic, and the table of contents to move
> within a page. Links and reader preferences do not create alternate versions of the content.

## Find your way

| Control | Behavior |
| --- | --- |
| Navigation tree | Browse logical groups and pages; the current page's ancestors expand automatically |
| Breadcrumb folders | Reveal and focus a folder in navigation without changing the page |
| Header navigation button | Hide or show the desktop sidebar; open a temporary drawer on narrow screens |
| Search | Find indexed content; `Ctrl+K` or `Cmd+K` focuses the search field |
| On this page | Jump to a heading and reveal its collapsed section |
| Page links and pager | Move between registered content pages without leaving the reader |

Desktop navigation remembers its visibility, expanded folders, and resized width.
Mobile navigation is temporary: Escape, the backdrop, or selecting a page closes the drawer.
Mobile use does not overwrite the desktop visibility preference.

## Share a page or heading

Slate uses hash routes rather than server-side page routing:

```text
https://prabinpebam.github.io/slate/#docs/getting-started.md
https://prabinpebam.github.io/slate/#docs/github-pages.md#local-preview
```

Copy the URL after navigating to a page or heading. Refreshing a hash route loads the same static
entry page, so GitHub Pages does not need a custom rewrite rule or a fallback 404 page.

## Links that leave the documentation

Links to the domain serving the documentation stay in the reader's tab.
Links to other domains open in a new tab and include an accessible "opens in a new tab" label.
A host can set `parentDomain` in `slate.config.json` to include that domain and its subdomains
in its own-domain policy. For example, `parentDomain: "example.github.io"` keeps links to the
published site in the same tab even when reading the documentation locally.

## Choose a theme

The header theme button switches the reader's theme preference.
Automatic mode follows your system color scheme. Slate supports light and dark themes, and
Canvas resolves the same preference independently in its own tab.

## Prioritize for a reader persona

When a host configures reader personas, a **View for** selector prioritizes tagged sections.
It changes initial expansion, not meaning or availability: content, search results, table-of-contents
entries, and deep links remain available. **All readers** restores the shared view.

An existing host must include the reader-persona header controls to expose this feature.
Runtime synchronization does not overwrite a host-owned root entry page.
The [component gallery](../demo/components.html) includes author and reviewer perspectives.

## Explore visuals and presentations

- Figures can expose a zoomed view; captions and data alternatives provide context.
- SVG illustrations can have finite entry animation and replay controls. Reduced motion keeps a
  readable fallback.
- Presentation examples have slide navigation and presenter controls. Motion is experimental.
- Canvas opens in a separate tab for pan, zoom, search, selection details, perspectives, and fit
  controls. It is intentionally read-only.

See the [demo guide](demos.md) to try these experiences.

## If something looks broken

Check that the site is served over HTTP and that its manifest, content, and runtime files are
available. The [GitHub Pages troubleshooting guide](github-pages.md#troubleshooting) distinguishes
deployment problems from intentional sanitizer fixtures.
