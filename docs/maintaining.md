# Maintaining Slate

> Fix reusable capability in the package first, prove the affected behavior, then synchronize
> hosts. Keep host content, branding, source authority, and policy outside generic runtime code.

## Change and release order

<ol class="slate-steps">
  <li class="slate-step">
    <p class="slate-step__title">Characterize the change</p>
    <p>Identify authority, changed surfaces, dependency reach, risk, discriminating checks, and expansion triggers.</p>
  </li>
  <li class="slate-step">
    <p class="slate-step__title">Implement in the owning layer</p>
    <p>Reusable behavior belongs in the package with a generic fixture or test. Host-only meaning stays in its host.</p>
  </li>
  <li class="slate-step">
    <p class="slate-step__title">Build and validate</p>
    <p>Rebuild Canvas when its source changes, run the focused checks, and inspect affected rendered output.</p>
  </li>
  <li class="slate-step">
    <p class="slate-step__title">Release and synchronize</p>
    <p>Bump the package version for runtime or public-contract changes, publish the revision, then synchronize and check each adopting host.</p>
  </li>
</ol>

The full contribution rules are in
[AGENTS.md](https://github.com/prabinpebam/slate/blob/main/AGENTS.md).

## Choose focused validation

| Changed behavior | Starting checks |
| --- | --- |
| This site's guides, manifest, or publishing | `npm run test:site`, `npm run build:site`, and affected browser routes |
| Runtime synchronization or initialization | `npm run test:runtime-host`, plus portability when copying or initialization changes |
| Reader navigation or personas | `npm run test:navigation` or `npm run test:reader-personas`, then rendered checks |
| Reader revisions or local persistence | `npm run test:revisions`, rendered selection/lifecycle checks, then runtime/site/portability checks when shared integration changes |
| Excerpt attribution | Production attribution validator; mutation suite when its contract changes |
| Canvas domain or application | `npm run test:canvas-contracts`, build, runtime check, and actual host browser checks |
| Chart or SVG authoring | Corresponding chart/SVG tests, structural validation, and actual render inspection |
| Presentation motion | `npm run test:presentation-motion` and the affected deck in reading/presenter modes |
| Vendored libraries or Canvas dependencies | `npm run test:third-party-notices`, after updating the [notices](third-party-notices.md) |

Expand validation only when an observed failure, shared dependency, or public-contract change
warrants it. Structural validation does not replace accessibility, theme, or viewport inspection.
The site regression suite deliberately uses no development dependencies; other package checks may
require installation through your approved package source.

### Rendered site checks

The [site test module](https://github.com/prabinpebam/slate/blob/main/scripts/test-site.mjs) exports
`testSiteBrowser(browser, { url, screenshots })` for an already-installed Playwright browser.
Pass an HTTP site-root URL ending in `/`; `screenshots` is an optional output-path prefix.
Use a visible browser context, including a normal headless browser rather than a hidden editor tab.
The helper checks guide routes, search, deep-link reload, reader/Canvas isolation, desktop/mobile
themes, keyboard navigation, the component gallery, a presentation, and the Canvas launch.
It does not download browser binaries.

## Keep generated assets replaceable

`shell/canvas/` is generated from `canvas/src/`:

```powershell
npm run build:canvas
```

Build it **before** synchronizing any host, since rebuilding changes the recorded hashes.
Never edit generated bundles directly. The build also writes `shell/canvas/THIRD_PARTY_NOTICES.txt`
with the full license text of every bundled package, so a dependency change updates its notices.

From a consuming repository root:

```powershell
node .\slate\scripts\runtime-host.mjs sync --repo . --host docs
node .\slate\scripts\runtime-host.mjs check --repo . --host docs
node .\slate\scripts\validate-document-attributions.mjs --repo . --host docs
```

Runtime synchronization leaves host content, configuration, theme, and root entry unchanged.
Adopt new entry-page controls explicitly when upgrading an older host.

## Maintain the first-party site

The [Pages guide](github-pages.md) covers metadata, artifact ownership, preview, and deployment.
The build consumes checked-in runtime assets and synchronizes both staged hosts.
It does not change canonical source, run a Canvas rebuild, or publish development dependencies.
Changes to this site's documentation alone do not require a package-version bump.
