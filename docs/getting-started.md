# Getting started

> Add Slate unchanged, initialize a host, then author content beside its generated runtime.
> A documentation host is a static directory: it needs HTTP, not a server-side application or build.

## Before you begin

- Use a repository where you control the documentation content and publication policy.
- Install Node.js to run initialization and runtime-management scripts. This site's build and CI use
  Node.js 22 or later.
- Have a static HTTP server available; the examples below use Python.
- A normal host uses vendored runtime assets and does not require `npm install`.
  Chart generation, Canvas rebuilding, and some package validators need development dependencies.

## Create a host

<ol class="slate-steps">
  <li class="slate-step">
    <p class="slate-step__title">Add the complete Slate package</p>
    <p>Pin it as a submodule or copy it into a <code>slate/</code> directory. Keep its internal layout unchanged.</p>
  </li>
  <li class="slate-step">
    <p class="slate-step__title">Run the initializer</p>
    <p>Choose a content directory and project name. Existing host-owned files are preserved.</p>
  </li>
  <li class="slate-step">
    <p class="slate-step__title">Replace starter content and preview</p>
    <p>Register each page in the manifest, set branding in host config, and open the host over HTTP.</p>
  </li>
</ol>

Run from the consuming repository root:

```powershell
git submodule add https://github.com/prabinpebam/slate.git slate
node .\slate\scripts\init-project.mjs --repo . --for copilot --host docs --project "Project name"
python -m http.server 8080 --bind 127.0.0.1
# Open http://127.0.0.1:8080/docs/
```

Copying the repository into `slate/` is an alternative to the first command.
Do not open the viewer using `file://`: fetching the manifest and pages requires HTTP.

## Understand the generated layout

```text
repository/
  slate/                         pinned source checkout
  .kits/slate/                   installed complete authoring package
  .kit-state/slate.json          exact installer ownership record
  .github/skills/slate/SKILL.md   thin discovery adapter
  docs/
    index.html                   host-owned reader entry
    landing.html                 host-owned starter content
    docs-manifest.json           host-owned navigation
    slate.config.json            host-owned branding and reader options
    project.theme.css            host-owned token overrides
    .slate-runtime.json          generated package identity and digests
    shell/                       generated runtime; never hand-edit
```

The package owns reusable capability. The host owns content, source authority, root entry page,
configuration, theme, and policy. The adapter only points an agent at the canonical contract.

## Add a page

Create `docs/guide.md`:

```markdown
# Project guide

> The short takeaway a reader should understand first.

## Start here

Explain the source-grounded task or decision.
```

Register it in `docs/docs-manifest.json`:

```json
{
  "version": 2,
  "entries": [
    { "path": "landing.html", "title": "Overview", "order": 0, "icon": "home" },
    { "path": "guide.md", "title": "Project guide", "group": "Guides", "order": 1, "icon": "auto_stories" }
  ]
}
```

Paths are relative to the host content root. Give every page a meaningful icon.
Use [Authoring](authoring.md) for visual routing, component rules, and source attribution.

## Brand the host

Set `projectName`, `defaultTheme`, `landing`, and optional reader personas in `slate.config.json`.
Put project token overrides in `project.theme.css`, outside generated `shell/`.
If you rename the theme file, update both the host entry link and config's `themeStylesheet` so the
reader and Canvas load the same theme.

## Update the runtime safely

For a contract-managed host, update through the installer so its ownership record
stays current. Keep the same host and agent arguments:

```powershell
node .\slate\scripts\init-project.mjs --repo . --for copilot --host docs --project "Project name" --dry-run --json
node .\slate\scripts\init-project.mjs --repo . --for copilot --host docs --project "Project name" --json
node .\.kits\slate\scripts\runtime-host.mjs check --repo . --host docs
```

Edited managed files stop the update without being overwritten. Resolve them
before proceeding. Hosts initialized through the older importable API, without a
kit ownership record, can still synchronize directly after updating their source:

```powershell
node .\slate\scripts\runtime-host.mjs sync --repo . --host docs
node .\slate\scripts\runtime-host.mjs check --repo . --host docs
```

Synchronization refreshes generated assets, not the host's root entry or content.
When a new release adds header controls, compare your host entry with the package's
`shell/index.html` and adopt the relevant host-owned markup explicitly.
See [Maintaining Slate](maintaining.md) for Canvas build ordering and content validation.

## Publish

Any static HTTP host can serve the generated directory.
For GitHub Actions permissions, artifact layout, repository subpaths, and deployment steps, read
[GitHub Pages](github-pages.md#publish-a-consuming-repository).
