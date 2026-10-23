# Getting started

> Add Slate unchanged, initialize a host, then author content beside its generated runtime.
> Reading works on any static HTTP host. Use Slate's local server to also save revisions
> automatically in the parent project's fixed revision directory.

## Before you begin

- Use a repository where you control the documentation content and publication policy.
- Install Node.js to run initialization and runtime-management scripts. This site's build and CI use
  Node.js 22 or later.
- Use Slate's built-in Node server for local reading and automatic revision persistence.
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
node .\slate\scripts\init-project.mjs --repo . --host docs --project "Project name"
node .\slate\scripts\serve-revisions.mjs --repo . --host docs --port 8765
# Open http://127.0.0.1:8765/
```

Copying the repository into `slate/` is an alternative to the first command.
Do not open the viewer using `file://`: fetching the manifest and pages requires HTTP.

## Understand the generated layout

```text
repository/
  slate/                         unchanged package
  .github/skills/slate/SKILL.md   thin discovery adapter
  .slate/revisions/              automatically saved revision JSON (created on first revision)
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
Revision JSON belongs to the parent project, outside the package and generated documentation.
See [Revisions](revisions.md) for selection, automatic persistence, and agent completion.

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

After updating the pinned Slate package, run:

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
