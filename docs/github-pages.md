# Publishing with GitHub Pages

> Slate's own documentation is a Slate host deployed by GitHub Actions.
> The workflow publishes a curated static artifact, not the repository checkout or development
> dependencies. No site dependency installation or Jekyll build is required.

## Site addresses

| Destination | URL |
| --- | --- |
| Documentation | <https://prabinpebam.github.io/slate/> |
| A guide | <https://prabinpebam.github.io/slate/#docs/getting-started.md> |
| Standalone demo | <https://prabinpebam.github.io/slate/demo/> |

These are the default project-site URLs. A successful first deployment is required before they
serve content. The workflow's deployment environment reports the actual published URL.
Forks use their owner's Pages URL; a custom domain is optional and is not configured here.

## Build and deployment flow

<ol class="slate-steps">
  <li class="slate-step">
    <p class="slate-step__title">Validate the artifact contract</p>
    <p>Pull requests and deployment runs check routes, links, runtime digests, demo parity, and a non-root project-site prefix.</p>
  </li>
  <li class="slate-step">
    <p class="slate-step__title">Build a clean staging directory</p>
    <p>The build copies selected guides and demo fixtures, generates host entry pages, and synchronizes canonical runtime assets.</p>
  </li>
  <li class="slate-step">
    <p class="slate-step__title">Upload only the static site</p>
    <p>GitHub Actions uploads <code>_site/</code> as the Pages artifact. Source code, package dependencies, and repository internals stay out.</p>
  </li>
  <li class="slate-step">
    <p class="slate-step__title">Deploy from the default branch</p>
    <p>Pushes to <code>main</code> and manual runs on <code>main</code> deploy through the protected <code>github-pages</code> environment. Pull requests never deploy.</p>
  </li>
</ol>

## Enable Pages in this repository

An administrator performs this one-time setup:

1. Ensure GitHub Actions is enabled for the repository.
2. Open **Settings > Pages > Build and deployment**.
3. Set **Source** to **GitHub Actions**, not a branch-based Jekyll build.
4. Put `.github/workflows/pages.yml` and its referenced site files on `main`.
5. Push to `main`, or run **Actions > Deploy Slate documentation > Run workflow** on `main`.
6. Wait for both the build and deploy jobs to succeed, then open the URL reported by the deployment.

The workflow uses `contents: read` for building. Only the deploy job receives `pages: write` and
`id-token: write`; it depends on the successful build and uses the `github-pages` environment.
There are no personal access tokens or deployment secrets to add.
Repository or organization environment policies can still require approval.

Concurrent deploys are serialized. A pull request validates and builds but cannot upload a
deployable Pages artifact or run the deploy job.

## Local preview

From the Slate repository root, with Node.js 22 or later:

```powershell
npm run test:site
npm run build:site
python -m http.server 8080 --bind 127.0.0.1 --directory .\_site
# Open http://127.0.0.1:8080/
# Open http://127.0.0.1:8080/demo/
```

The build and site tests use only built-in Node modules and checked-in runtime assets.
They do not run `npm install`, download browser binaries, or rebuild Canvas.
The HTTP server must remain bound to loopback. Do not use `file://`.

`_site/` is ignored by Git and recreated by each build. Edit the source files, not the artifact.
The build only replaces this named output directory; there is no configurable cleanup target.

## Artifact layout and ownership

```text
_site/
  index.html              reader entry from the package's host template
  docs-manifest.json      site navigation plus non-Canvas demo pages
  slate.config.json       first-party host configuration
  project.theme.css       first-party host token overrides
  .slate-runtime.json     root host runtime digests
  .nojekyll               explicit static hosting marker
  docs/                   guides registered by the site manifest
  shell/                  canonical generated runtime
  demo/
    index.html            separate demo host entry
    docs-manifest.json    original demo navigation, including Canvas
    slate.config.json    original demo configuration
    .slate-runtime.json   demo host runtime digests
    shell/                generated demo runtime
    ...                   unchanged demo content and companion JSON
```

The site's host-owned metadata lives in `site/`; guide content lives in `docs/`.
The builder uses the same entry-generation and runtime synchronization helpers as initialization.
Demo content is copied unchanged. Canvas stays in the standalone demo so its host-relative source
links resolve against the correct manifest.

Relative asset paths work both at a domain root and under a project prefix such as `/slate/`.
Page and heading navigation use hash routes. Do not add root-relative `/shell/` paths, hard-code a
repository base URL in runtime code, or add a server-side router.

## Update the published documentation

1. Edit a guide in `docs/`, or add a new guide and register it in `site/docs-manifest.json`.
2. Set a meaningful title, icon, logical group, and reading order.
3. Edit `site/slate.config.json` or `site/project.theme.css` only for this site's composition.
4. Run `npm run test:site` and inspect affected pages using the local preview.
5. Commit the source changes and merge them to `main`; the workflow rebuilds and deploys.

For demo updates, edit `demo/` and its manifest. For runtime changes, edit canonical package source,
validate the affected contracts, and rebuild Canvas first if its source changed.
Never hand-edit either generated host's `shell/`.

## Publish a consuming repository

A normal initialized host already contains everything a static server needs:

1. Initialize and author the host as described in [Getting started](getting-started.md).
2. Update the pinned Slate revision, synchronize runtime assets, and run the drift check.
3. Enable GitHub Actions as that repository's Pages source.
4. Use the same configure/upload/deploy action pattern, but upload the **host directory**,
   such as `docs/`, rather than all repository files.
5. Keep the host's content, config, theme, entry page, runtime manifest, and generated `shell/`
   together in the artifact.

Slate's `build:site` script is specific to this package's own guides and demos; it is not required
by downstream hosts. If a workflow checks out Slate as a submodule, enable submodule checkout.
Adapt the branch filters and environment rules to the consuming repository's default branch.
Install any development dependencies only through your organization's approved package sources.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Pages URL returns 404 | Pages source is GitHub Actions, the workflow is on `main`, and its first deploy succeeded |
| No deploy job on a pull request | Expected: pull requests validate only; deployment is restricted to `main` |
| Deploy is waiting | Review `github-pages` environment approval or branch protection settings |
| Reader is blank or cannot fetch pages | Use HTTP and upload the complete host, including manifest, config, content, and `shell/` |
| Assets fail only on a project site | Remove root-relative paths and test under a non-root prefix |
| Canvas cannot load | Use the built demo host and include its generated `demo/shell/canvas/` and companion JSON |
| Runtime drift check fails | Rebuild Canvas if needed, synchronize from canonical package assets, then rebuild the site |
| A missing image appears on the sanitizer page | Intentional fixture; other pages should have no missing resources |
| Published content is old | Check the latest `main` workflow and deployed commit; refresh after deployment completes |

Official references:
[custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
and [publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
