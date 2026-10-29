# Slate

**Visual-first documentation. A portable viewer. One authoring contract.**

Slate turns Markdown, HTML fragments, and structured records into a navigable static documentation
site. Copy the package into a repository, give an agent your source material, and publish the result
over plain HTTP. Readers need no installation, and documentation hosts need no build step.

**[Documentation and live demos](https://prabinpebam.github.io/slate/)** |
[Getting started](docs/getting-started.md) |
[Authoring contract](SKILL.md) |
[GitHub Pages guide](docs/github-pages.md)

## What Slate provides

| Capability | What you get |
| --- | --- |
| Documentation reader | Navigation, breadcrumbs, search, table of contents, deep links, and light/dark themes |
| Consistent authoring | One sanitized pipeline for Markdown and HTML, reusable components, and manifest-driven navigation |
| Visual explanations | Offline chart rendering, native SVG illustrations, and approved vector icon sources |
| Presentations | Slide-like documents, presenter controls, and experimental manifest-driven motion |
| Structured information | Read-only Canvas with nested groups, repeated placements, perspectives, search, and viewport controls |
| Portable hosting | Vendored runtime assets, non-destructive initialization, and SHA-256 runtime drift checks |

The package is `@slate/docs`; [package.json](package.json) is the version authority.
Canvas editing and authority-aware write-back are not implemented.

## Explore the documentation

Slate documents itself using the same viewer, components, manifests, and runtime that adopters use.
The [GitHub Pages site](https://prabinpebam.github.io/slate/) combines task-oriented guides with
working component, Markdown, illustration, and presentation examples. The
[standalone demo](https://prabinpebam.github.io/slate/demo/) also includes the interactive,
read-only Canvas and intentional sanitizer test cases. Every demo example follows one fictional
storyline, a small company carrying a Ring to Mount Doom, so a single plot runs through the brief,
slides, illustrations, and Canvas.

| Start here | Purpose |
| --- | --- |
| [Overview](docs/overview.md) | Understand Slate and choose a next step |
| [Getting started](docs/getting-started.md) | Initialize Slate in another repository |
| [Authoring](docs/authoring.md) | Compose pages, choose visuals, and register navigation |
| [Reader guide](docs/reader-guide.md) | Use search, navigation, themes, and reader perspectives |
| [Demo guide](docs/demos.md) | Find examples and understand what each demonstrates |
| [GitHub Pages](docs/github-pages.md) | Build, preview, deploy, troubleshoot, and adapt hosting |
| [Maintaining Slate](docs/maintaining.md) | Validate package changes and synchronize hosts |

### Preview locally

To try the existing demo directly:

```powershell
python -m http.server 8080 --bind 127.0.0.1
# Open http://127.0.0.1:8080/demo/
```

To preview the complete documentation site, including its demos:

```powershell
npm run build:site
python -m http.server 8080 --bind 127.0.0.1 --directory .\_site
# Open http://127.0.0.1:8080/
```

The site build requires Node.js 22 or later and uses only built-in Node modules; **no dependency
installation is needed**. The Python command is one option for serving static files.
Keep preview servers bound to loopback. The viewer fetches content, so `file://` does not work.

### Links that leave the documentation

Links to the documentation's own domain stay in the reader's tab. Other domains open in a new tab
with an accessible "opens in a new tab" label. Hosts can set `parentDomain` in
`slate.config.json` to also treat that domain and its subdomains as their own, including during
local preview. See the [reader guide](docs/reader-guide.md#links-that-leave-the-documentation).
Run `npm run test:navigation` for the link-policy checks.

## Adopt Slate in your repository

### Noninteractive installer contract (unreleased)

```powershell
node scripts\init-project.mjs --repo <project> --for copilot --dry-run --json
node scripts\init-project.mjs --repo <project> --for copilot --json
node scripts\init-project.mjs --repo <project> --for copilot --uninstall --json
```

Choose `--for copilot,claude,agents` explicitly; `claude-code` maps to `claude`,
and `codex`/`cursor` map to `agents`. Slate supports project scope only. The CLI
installs the complete authoring package under `.kits/slate/`, the documentation
host (`--host docs` by default), and discovery adapters. `--project` names the site.
Existing authored pages, configuration and theme files are kept, not claimed.
The existing importable `initializeProject` API is unchanged; the safe CLI is the
contract entry point.

JSON has `status`, `plan`, `written`, `changed` and `next`. Plans enumerate every
file and prior/result hash, declare `writes-project-files` and no network use, and
dry runs write nothing. `--approve-plan <plan.digest>` refuses changes since review.
Exit codes are 0 (done), 1 (error), 2 (decision needed).

The `.kit-state/slate.json` record keeps original bytes and directory ownership.
Repeated installation changes nothing. Edited runtime or newly authored starter
content is never silently overwritten or deleted: resolve it or keep the kit.
Uninstall restores recorded originals and only removes owned, unchanged files. It
never touches a file it did not record, such as starter content that existed before
installation or a later `CLAUDE.md`. Where a file also holds owner text or another
kit's marked section, it removes only Slate's section. Paths reject traversal and links, and caught failures
roll back. Preserve recovery originals when an error names them; recovery from
power loss is manual. The standalone contract engine is vendored, not a dependency
on another kit. Run `npm run test:install-contract` for the real-installer checks.

These are source changes for the next release, not a claim that existing pinned
revisions support the contract.

The installer copies only files listed in `package-files.json`, never arbitrary untracked files
from its checkout. Maintainers review source additions before regenerating that
list with `node scripts/package-files.mjs`; `--check` detects stale lists.

### 1. Add the complete package

From the consuming repository root, pin Slate as a submodule:

```powershell
git submodule add https://github.com/prabinpebam/slate.git slate
```

Alternatively, copy the repository contents unchanged into a `slate/` directory.
Do not copy only selected components or duplicate the package under agent discovery folders.

### 2. Initialize a documentation host

```powershell
node .\slate\scripts\init-project.mjs --repo . --for copilot --host docs --project "Project name"
```

The initializer creates host-owned content, configuration, an entry page, and a thin
`.github/skills/slate/SKILL.md` discovery adapter. It preserves existing host-owned files while
refreshing the generated runtime.

Contract-managed hosts should update through this initializer again, so their
ownership record stays current. Use the runtime checker from `.kits/slate/` for
those hosts. The direct synchronization commands below remain for API-initialized,
unmanaged hosts; using them to bypass a contract conflict is not safe.

### 3. Author and preview

- Add Markdown pages or HTML body fragments and register them in `docs/docs-manifest.json`.
- Set branding in `docs/slate.config.json` and tokens in `docs/project.theme.css`.
- Give your agent [SKILL.md](SKILL.md), the source material, and the desired documentation task.
- Serve the host over HTTP and open `docs/index.html`.

See [Getting started](docs/getting-started.md) for the resulting layout and upgrade procedure.

## Ownership and portability

| Layer | Owns |
| --- | --- |
| Package | Generic skill, runtime, components, templates, schemas, visualizations, Canvas, demo, initializer, and tests |
| Host | Content, sources, manifest, root entry page, config, theme, authority, and policy |
| Adapter | Repository-specific discovery and additional rules only |

**Never hand-edit a host's generated `shell/`.** Synchronize and check it from the consuming
repository root:

```powershell
node .\slate\scripts\runtime-host.mjs sync --repo . --host docs
node .\slate\scripts\runtime-host.mjs check --repo . --host docs
```

The host's `.slate-runtime.json` records package identity and canonical hashes. The checker rejects
missing, changed, stale, obsolete, or unmanaged runtime files. Host branding and project policy
never become generic package defaults.

## Publish with GitHub Pages

The [Pages workflow](.github/workflows/pages.yml) validates and builds a curated `_site/` artifact,
then deploys it on pushes to `main`. Pull requests validate the same artifact without deploying.
The published root is the Slate documentation reader; `demo/` remains a separate runnable host.

Repository administrators must select **Settings > Pages > Build and deployment > Source >
GitHub Actions**. Once the workflow is on the default branch, a push to `main` or a manual workflow
run publishes the site. No custom domain, Jekyll build, or committed generated site is required.

The [GitHub Pages guide](docs/github-pages.md) covers initial setup, permissions, URL structure,
local preview, content updates, troubleshooting, and deployment from another repository.

## Repository map

| Path | Role |
| --- | --- |
| [SKILL.md](SKILL.md) | Complete generic authoring contract |
| [AGENTS.md](AGENTS.md) | Contribution, ownership, validation, and release rules |
| [docs/](docs/) | Slate's guides and capability specifications |
| [site/](site/) | First-party site manifest, config, and host theme |
| [demo/](demo/) | Runnable examples and feature fixtures |
| [shell/](shell/) | Canonical runtime and host entry template |
| [components/](components/README.md) | Component catalog and few-shot patterns |
| [templates/](templates/) | Page, presentation, and Canvas starters |
| [visualization/](visualization/README.md) | Chart, SVG illustration, and iconography subskills |
| [presentation/](presentation/SKILL.md) | Presentation authoring and motion contracts |
| [canvas/](canvas/README.md) | Read-only Canvas source and domain model |
| [schema/](schema/) | Manifest, config, Canvas, and motion schemas |
| [scripts/](scripts/) | Initialization, runtime management, site build, and validation |
| [examples/](examples/) | Worked before/after conversion |
| [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | Licenses of redistributed third-party components |

## Develop and validate

Choose checks for the behavior being changed; do not run every suite for a prose edit.
The documentation publishing path has a dependency-free regression suite:

```powershell
npm run test:site
npm run build:site
```

For package development, install dependencies through your organization's approved package source,
then run the relevant checks:

```powershell
npm install
npm run test:runtime-host
npm run test:portability
npm run test:attributions
npm run test:navigation
npm run test:reader-personas
npm run test:presentation-motion
npm run test:canvas-contracts
npm run test:third-party-notices
npm run test:chart
npm run test:svg-illustration
npm run validate:svg-illustration
```

`shell/canvas/` is generated from `canvas/src/` by `npm run build:canvas`. Rebuild it **before**
synchronizing any host. The Pages build uses the checked-in Canvas output; it does not rebuild or
modify canonical runtime assets. See [Maintaining Slate](docs/maintaining.md) and
[AGENTS.md](AGENTS.md) for validation scope and release ordering.

## Third-party notices

Slate's runtime redistributes open-source libraries, an icon font, and a bundled Canvas
application. Their license texts ship beside them in `shell/vendor/LICENSES/` and
`shell/canvas/THIRD_PARTY_NOTICES.txt`, and every host receives them through runtime
synchronization. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the
[Third-party notices guide](docs/third-party-notices.md).
