# Slate Licensing Review

Status: **draft for owner review, not committed.** Inventory date: this review covers commit `51572a3`
(`@slate/docs` 0.11.0). This is an engineering inventory, not legal advice.

> **Update (0.11.1):** findings 2, 3, 4, 7, and 8 are resolved. License texts now ship in
> `shell/vendor/LICENSES/`, the Canvas build generates complete `shell/canvas/THIRD_PARTY_NOTICES.txt`,
> `docs/third-party-notices.md` and `THIRD_PARTY_NOTICES.md` document everything, the iconography
> skill carries the Font Awesome attribution rule and the Lucide exception, and
> `npm run test:third-party-notices` guards it. Open: finding 1 (Slate's own license) and 5 (Tolkien homage).

## 1. Summary

| # | Finding | Severity | Decision needed |
|---|---|---|---|
| 1 | The repository is **public on GitHub with no license**. `package.json` is `"private": true` with no `license` field. By default that means all rights reserved: nobody, including hosts that copy Slate, may legally reuse, modify, or redistribute it. | High | Choose a license for Slate |
| 2 | Slate **redistributes third-party code** (vendored viewer libraries and a bundled Canvas) to every host and to GitHub Pages. Only one partial notice file exists. | High | Add a third-party notices file and license texts |
| 3 | `shell/canvas/canvas.js.LEGAL.txt` lists only React and lucide-react. **@xyflow, zustand, classcat, and nine d3 modules are bundled but not credited.** | High | Fix the Canvas build to emit complete notices |
| 4 | `shell/vendor/` ships five libraries and a font **without license texts**. Only minified header comments survive. | Medium | Add license texts beside the vendored files |
| 5 | The demo storyline is a **Tolkien homage** that uses Middle-earth names. It carries a non-affiliation disclaimer, but those names are trademarked and protected. | Medium | Keep the homage, or switch to an original setting |
| 6 | Build-time dependencies include **LGPL-3.0 libvips binaries** (through `sharp` via `semiotic`). They are not shipped, so this is informational. | Low | None, unless that changes |
| 7 | Skill guidance allows **Font Awesome**, whose free icons are CC BY 4.0 and need attribution. No Font Awesome geometry is currently embedded. | Low | Add an attribution rule to the iconography skill |
| 8 | The Canvas uses **Lucide** icons, which falls outside Slate's own three-source icon rule. This is a consistency issue, not a license breach. | Low | Accept as a documented exception, or swap to Material Symbols |
| 9 | Some guidance was synthesized from external skills and Apache-2.0 HyperFrames, and is documented as a clean-room adaptation. No code or assets were copied. | Info | None |

## 2. Slate's own license

Current state:

- GitHub reports `licenseInfo: null`. The repository is public and is not a fork.
- There is no `LICENSE` file, no `license` field, and `"private": true` in `package.json`.
- All 19 commits are by one author (`prabinpebam`), so the owner can relicense freely today. That gets
  harder once outside contributors arrive.

Options:

| License | Fit for Slate | Notes |
|---|---|---|
| **MIT** | Strong | Shortest and most familiar. Hosts copy `shell/` into their repos, and MIT asks only that the notice be kept. Same license as most of the bundled stack. |
| **Apache-2.0** | Strong | Adds an explicit patent grant and contribution terms. Requires keeping a `NOTICE` file if you create one. Matches `semiotic` and DOMPurify's Apache option. Slightly heavier for hosts. |
| **MPL-2.0** | Moderate | File-level copyleft: hosts must share changes to Slate files but not their own content. Conflicts with the "copy and drop in" model. |
| **No license / proprietary** | Weak | Keeps the current all-rights-reserved state. That contradicts publishing Slate as a copyable package and a public demo. |
| Docs/content under **CC BY 4.0** (optional dual) | Optional | Some projects license code under MIT/Apache and prose/demo content under CC BY 4.0. Simpler to keep one license for everything. |

**Recommendation:** MIT for the whole repository. If patent protection matters to you, choose
Apache-2.0 instead.

Changes either choice needs:

1. Add `LICENSE` at the repository root.
2. Add `"license": "MIT"` (or `"Apache-2.0"`) to `package.json`. `"private": true` can stay; it only blocks
   accidental npm publishing.
3. Add a License section to `README.md`.
4. Decide whether `runtime-host sync` should copy `LICENSE` and the third-party notices into each host's
   `shell/` folder. It should, because hosts redistribute that code.

## 3. Third-party code that Slate redistributes

Everything in `shell/` is copied into every host by `scripts/runtime-host.mjs` and published to GitHub Pages
under `_site/shell/` and `_site/demo/shell/`. This is where the license obligations actually apply.

### 3.1 Vendored viewer libraries (`shell/vendor/`)

| File | Project | Version | License | Obligation | Status |
|---|---|---|---|---|---|
| `marked.min.js` | marked | 14.1.4 | MIT | Keep copyright and license notice | Header only; no license text |
| `highlight.min.js` | highlight.js | 11.9.0 | BSD-3-Clause | Keep copyright, conditions, and disclaimer | Header only; no license text |
| `github.min.css`, `github-dark.min.css` | highlight.js themes | 11.9.0 | BSD-3-Clause | As above | No notice |
| `purify.min.js` | DOMPurify (Cure53) | 3.4.11 | Apache-2.0 **or** MPL-2.0 | Choose Apache-2.0; include its text | Header only; no license text |
| `material-symbols-outlined.ttf` | Google Material Symbols | not recorded | Apache-2.0 | Include license text; record the version or source | No notice; version unknown |

Other issues in `shell/vendor/README.md`:

- It lists the files but no licenses or sources.
- It mentions a deferred `mermaid.min.js` that is not present.
- It links to `../../../implementation-plan/...`, which is outside the repository and is a stale internal path.

### 3.2 Canvas bundle (`shell/canvas/canvas.js`)

Built by `scripts/build-canvas.mjs` using esbuild with `legalComments: "linked"`. That setting only collects
`/*! ... */` or `@license` comments, so packages that omit those comments are silently left out of the
notices file. An esbuild metafile shows the bundle actually contains:

| Package | Version | License | In `canvas.js.LEGAL.txt`? |
|---|---|---|---|
| react | 19.1.1 | MIT | Yes |
| react-dom | 19.1.1 | MIT | Yes |
| scheduler | 0.26.0 | MIT | Yes |
| use-sync-external-store | 1.6.0 | MIT | Yes |
| lucide-react | 0.468.0 | ISC (includes Feather-derived icons, MIT) | Yes |
| @xyflow/react | 12.11.2 | MIT | **No** |
| @xyflow/system | 0.0.79 | MIT | **No** |
| zustand | 4.5.7 | MIT | **No** |
| classcat | 5.0.5 | MIT | **No** |
| d3-color | 3.1.0 | ISC | **No** |
| d3-dispatch | 3.0.1 | ISC | **No** |
| d3-drag | 3.0.0 | ISC | **No** |
| d3-ease | 3.0.1 | BSD-3-Clause | **No** |
| d3-interpolate | 3.0.1 | ISC | **No** |
| d3-selection | 3.0.0 | ISC | **No** |
| d3-timer | 3.0.1 | ISC | **No** |
| d3-transition | 3.0.1 | ISC | **No** |
| d3-zoom | 3.0.0 | ISC | **No** |

MIT, ISC, and BSD-3-Clause all require keeping the copyright notice and license text with redistributed
copies. Thirteen bundled packages are currently missing their notices.

**Fix direction:** keep the fix in the build, never hand-edit `shell/canvas/*`. After bundling, read the
esbuild metafile, resolve each input to its package, and write the full `LICENSE` text for each package to a
generated notices file. Add a test that fails when a bundled package has no notice entry.

## 4. Build and authoring-time dependencies (not shipped)

These run only in this repository and in hosts that render charts. None of them are copied into `shell/`
or `_site`.

| Dependency | License | Purpose |
|---|---|---|
| semiotic 3.8.3 | Apache-2.0 | Offline chart rendering (`visualization/skills/chart/scripts/render-chart.mjs`) |
| jsdom 29.1.1, gifenc 1.0.3 | MIT | Pulled in by semiotic |
| sharp 0.35.3 | Apache-2.0 | Pulled in by semiotic for raster export |
| `@img/sharp-libvips-*`, `@img/sharp-win32-*` | **LGPL-3.0-or-later** | Native image binaries installed per platform |
| parse5 8.0.0 | MIT | HTML parsing in validators and tests |
| esbuild 0.28.1 (dev) | MIT | Canvas build |
| Python scripts in `visualization/skills/svg-illustration/scripts/` | Standard library only | No third-party packages |

License counts across all of `package-lock.json`: MIT 75, ISC 26, Apache-2.0 16, LGPL-3.0-or-later 10,
mixed Apache/LGPL/MIT 4, BSD-3-Clause 3, BSD-2-Clause 3, MIT-0 2, and one each of BlueOak-1.0.0, CC0-1.0, and 0BSD.

**LGPL note:** using LGPL binaries at build time places no obligation on Slate's own license. The
obligation would only arise if the libvips binaries were redistributed, for example by committing
`node_modules` or shipping a packaged tool. Neither happens today.

**Chart output:** SVG produced by the chart renderer is your output, not Semiotic's code. No attribution is
required in rendered charts.

## 5. Icons, fonts, and visual assets

| Source | License | Where Slate uses it | Obligation |
|---|---|---|---|
| Google Material Symbols | Apache-2.0 | Viewer chrome font, plus nav icons named in manifests | Ship the license text with the font (see 3.1) |
| Fluent System Icons | MIT | Allowed by the iconography skill. No embedded geometry found in the repo. | Keep the MIT notice wherever geometry is copied |
| Font Awesome Free | Icons CC BY 4.0, fonts SIL OFL 1.1, code MIT | Allowed by the iconography skill. No embedded geometry found. | **Visible attribution** whenever its icons appear |
| Lucide (via lucide-react) | ISC | Canvas toolbar and record icons (`canvas/src/App.jsx`) | Covered by the notices fix in 3.2. Also an exception to Slate's own icon rule. |
| Segoe UI and Segoe UI Variable | Microsoft proprietary | Named only in CSS font stacks and favicons. Not distributed. | None while it stays a system-font reference |
| Demo SVGs and quest map | Original | Authored in this repo with hand-drawn geometry | Covered by Slate's own license |
| `visualization/skills/svg-illustration/assets/starter-slate-inline.svg` | Original | Starter asset | Covered by Slate's own license |

The iconography and svg-illustration skills already say to record source, version, and license for copied
icons. They do not yet tell authors to add the visible Font Awesome attribution that CC BY 4.0 requires.

## 6. Adapted guidance and provenance

| Source | License | How it was used | Assessment |
|---|---|---|---|
| HyperFrames (`heygen-com/hyperframes`, reviewed v0.7.61) | Apache-2.0 | Concepts adapted into Slate's motion contract. Documented in `presentation/hyperframes-provenance.json` as a clean-room adaptation; no runtime, recipes, or code vendored. | Fine. Keep the provenance file. Optionally credit it in the third-party notices. |
| External agent-skill repos and libraries listed in `visualization/skills/svg-illustration/references/research-sources.md` | Various | Practices synthesized in original wording. The file states that no source code or assets were copied. | Fine as documented. Ideas are not copyrightable, and the wording is original. |
| W3C, MDN, WCAG | W3C and CC BY-SA documents | Cited as references only | Fine |

## 7. Demo content: the Tolkien homage

- The demo uses Middle-earth names: Mount Doom, Rivendell, Moria, the Shire, Ring-bearer, and the Fellowship.
  Tolkien's works are under copyright, and Middle-earth Enterprises holds trademarks on many of these names.
- Mitigations already in place:
  - The storyline, numbers, and wording are original.
  - There are no quotations.
  - The demo pages, `docs/demos.md`, and `examples/` carry a "not affiliated with any rights holder" disclaimer.
- Remaining risk: low for a non-commercial demo, but not zero. The public GitHub Pages site uses those names
  in titles and navigation.

Options:

| Option | Effort | Risk after |
|---|---|---|
| Keep the homage and its disclaimers | None | Low |
| Rename to an original fantasy setting with the same structure, for example "The Ember Mountain Expedition" | Medium: text, manifests, SVG labels, tests | Lowest |

## 8. Who inherits these obligations

- **Hosts:** `runtime-host sync` copies `shell/vendor/*` and `shell/canvas/*` into each host. Each host
  therefore redistributes every package in section 3, and needs the license and notice files to travel with
  them.
- **GitHub Pages:** `_site/shell/` and `_site/demo/shell/` publish the same files publicly. A reachable
  "Third-party notices" page or file satisfies notice requirements for the web build.

## 9. Recommended actions

| Priority | Action | Changes |
|---|---|---|
| P1 | Choose and add Slate's license | `LICENSE`, `package.json` `license` field, README License section |
| P1 | Complete the Canvas notices from the build | `scripts/build-canvas.mjs` generates a full notices file from the metafile, plus a test that fails on a missing notice. Rebuild the Canvas and bump the version. |
| P1 | Add license texts for vendored files | `shell/vendor/LICENSES/` (or `shell/THIRD_PARTY_NOTICES.md`) with marked, highlight.js, DOMPurify (Apache-2.0), and Material Symbols texts. Fix `shell/vendor/README.md` with versions, sources, and licenses; remove the stale links. |
| P2 | Add a root `THIRD_PARTY_NOTICES.md` and link it from the README and the docs site | Root file that indexes runtime and build-time dependencies |
| P2 | Ship `LICENSE` and the notices to hosts | `scripts/runtime-host.mjs` includes them in the sync and drift check |
| P3 | Add the Font Awesome attribution rule | `visualization/skills/iconography/SKILL.md` |
| P3 | Decide on Lucide in the Canvas | Document the exception, or switch to Material Symbols |
| P3 | Decide on the Tolkien homage | Keep it, or rename to an original setting |

Items not recommended:

- Do not rewrite git history for licensing. Adding a license applies going forward, and as sole author you
  can grant rights over earlier commits too.
- Do not commit `node_modules` or packaged binaries. That would trigger the LGPL redistribution duties.
