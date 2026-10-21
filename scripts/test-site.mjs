import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { buildSite } from "./build-site.mjs";
import { initializeProject } from "./init-project.mjs";
import { checkRuntimeHost } from "./runtime-host.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "slate-site-"));
const markedContext = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(sourceRoot, "shell", "vendor", "marked.min.js"), "utf8"), markedContext);
const marked = markedContext.marked;

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function localReferences(markup) {
  return Array.from(markup.matchAll(/\b(?:href|src)=["']([^"']+)["']/g), (match) => match[1])
    .filter((href) => !/^(?:[a-z][a-z\d+.-]*:|#)/i.test(href));
}

function assertLocalFile(root, fromPath, href) {
  assert.ok(!href.startsWith("/"), `${fromPath}: root-relative link breaks project sites: ${href}`);
  const target = path.resolve(root, path.dirname(fromPath), decodeURIComponent(href.split(/[?#]/)[0]));
  assert.ok(target.startsWith(`${root}${path.sep}`), `${fromPath}: link escapes published host: ${href}`);
  assert.ok(fs.existsSync(target) && fs.statSync(target).isFile(), `${fromPath}: missing target ${href}`);
  return target;
}

function treeFiles(root, relativePath = "") {
  return fs.readdirSync(path.join(root, relativePath), { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(relativePath, entry.name);
      return entry.isDirectory() ? treeFiles(root, entryPath) : [entryPath];
    })
    .sort();
}

async function checkProjectPrefix(outputRoot) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (!url.pathname.startsWith("/slate/")) {
      response.writeHead(404).end();
      return;
    }
    const relativePath = decodeURIComponent(url.pathname.slice("/slate/".length)) || "index.html";
    const target = path.resolve(outputRoot, relativePath);
    if (!target.startsWith(`${outputRoot}${path.sep}`) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200).end(fs.readFileSync(target));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/slate/`;
    for (const entryPath of ["index.html", "demo/index.html"]) {
      const entryUrl = new URL(entryPath, base);
      const response = await fetch(entryUrl);
      assert.equal(response.status, 200);
      for (const reference of localReferences(await response.text())) {
        const resourceUrl = new URL(reference, entryUrl);
        assert.ok(resourceUrl.pathname.startsWith("/slate/"), `Resource escaped project prefix: ${resourceUrl}`);
        assert.equal((await fetch(resourceUrl)).status, 200, `Missing resource: ${resourceUrl}`);
      }
    }
    for (const host of ["", "demo/"]) {
      const manifest = await (await fetch(new URL(`${host}docs-manifest.json`, base))).json();
      for (const entry of manifest.entries) {
        assert.equal((await fetch(new URL(`${host}${entry.path}`, base))).status, 200, `Missing published route: ${entry.path}`);
        if (entry.presentation?.motion) {
          const motionUrl = new URL(entry.presentation.motion, new URL(`${host}${entry.path}`, base));
          assert.equal((await fetch(motionUrl)).status, 200, `Missing motion manifest: ${motionUrl}`);
        }
        if (entry.type === "canvas") {
          const documentUrl = new URL(`${host}${entry.path}`, base);
          const document = await (await fetch(documentUrl)).json();
          for (const source of document.recordSources) {
            assert.equal((await fetch(new URL(source.path, documentUrl))).status, 200);
          }
          for (const href of [document.source.href, "shell/canvas/index.html", "shell/canvas/canvas.js", "shell/canvas/canvas.css"]) {
            assert.equal((await fetch(new URL(`${host}${href}`, base))).status, 200, `Missing Canvas resource: ${href}`);
          }
        }
      }
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

try {
  const outputRoot = buildSite({ repoRoot: temporaryRoot });
  const manifest = readJson(outputRoot, "docs-manifest.json");
  const config = readJson(outputRoot, "slate.config.json");
  const routes = new Set(manifest.entries.map((entry) => entry.path));
  assert.equal(routes.size, manifest.entries.length, "Published routes must be unique");
  assert.ok(routes.has(config.landing), "Landing page must be registered");
  assert.ok(fs.existsSync(path.join(outputRoot, ".nojekyll")));
  assert.equal(readJson(outputRoot, ".slate-runtime.json").sourceVersion, readJson(sourceRoot, "package.json").version);
  for (const href of localReferences(marked.parse(fs.readFileSync(path.join(sourceRoot, "README.md"), "utf8")))) {
    assert.ok(!href.startsWith("/"), `README link must be repository-relative: ${href}`);
    const target = path.resolve(sourceRoot, decodeURIComponent(href.split(/[?#]/)[0]));
    assert.ok(target.startsWith(`${sourceRoot}${path.sep}`) && fs.existsSync(target), `Broken README link: ${href}`);
  }

  for (const host of ["", "demo"]) {
    const hostRoot = path.join(outputRoot, host);
    assert.deepEqual(checkRuntimeHost(hostRoot, sourceRoot, temporaryRoot), []);
    for (const entry of readJson(hostRoot, "docs-manifest.json").entries) {
      assert.ok(entry.title && entry.icon, `Each route needs a title and icon: ${entry.path}`);
      assertLocalFile(hostRoot, "docs-manifest.json", entry.path);
    }
  }
  for (const entry of readJson(sourceRoot, path.join("site", "docs-manifest.json")).entries) {
    const content = fs.readFileSync(path.join(outputRoot, entry.path), "utf8");
    const html = marked.parse(content);
    assert.equal((html.match(/<h1(?:\s[^>]*)?>/g) || []).length, 1, `One H1: ${entry.path}`);
    assert.ok(html.includes("<blockquote>"), `Opening takeaway: ${entry.path}`);
    assert.doesNotMatch(html, /<(?:script|style|iframe|head|html)\b|\sstyle=|\son\w+=/i, `Unsafe guide markup: ${entry.path}`);
    for (const href of localReferences(html)) {
      const target = assertLocalFile(outputRoot, entry.path, href);
      const relative = path.relative(outputRoot, target).split(path.sep).join("/");
      const toolLink = href.includes("?") || /index\.html(?:#.*)?$/.test(href);
      assert.ok(toolLink || routes.has(relative), `Unregistered content link: ${entry.path} -> ${href}`);
      if (href.includes("#") && relative.endsWith(".md")) {
        const fragment = href.split("#")[1];
        const headings = marked.lexer(fs.readFileSync(target, "utf8"))
          .filter((token) => token.type === "heading")
          .map((token) => token.text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-"));
        assert.ok(headings.includes(fragment), `Missing heading anchor: ${entry.path} -> ${href}`);
      }
    }
  }

  const demoManifest = readJson(sourceRoot, path.join("demo", "docs-manifest.json"));
  assert.deepEqual(readJson(outputRoot, path.join("demo", "docs-manifest.json")), demoManifest);
  assert.deepEqual(readJson(outputRoot, path.join("demo", "slate.config.json")), readJson(sourceRoot, path.join("demo", "slate.config.json")));
  for (const file of treeFiles(path.join(sourceRoot, "demo")).filter((file) => file !== "index.html")) {
    assert.deepEqual(fs.readFileSync(path.join(outputRoot, "demo", file)), fs.readFileSync(path.join(sourceRoot, "demo", file)));
  }
  const consumerRoot = path.join(temporaryRoot, "consumer");
  fs.mkdirSync(consumerRoot);
  const initialized = initializeProject({ repoRoot: consumerRoot, projectName: config.projectName });
  assert.equal(fs.readFileSync(path.join(outputRoot, "index.html"), "utf8"), fs.readFileSync(path.join(initialized.hostRoot, "index.html"), "utf8"),
    "The site must use the same entry template as consumers");
  const outputFiles = treeFiles(outputRoot);
  for (const file of outputFiles) {
    assert.doesNotMatch(file, /(?:^|[\\/])(?:node_modules|\.git|\.github|scripts|canvas[\\/]src)(?:[\\/]|$)|package(?:-lock)?\.json$/);
  }
  const before = outputFiles.map((file) => [file, fs.readFileSync(path.join(outputRoot, file))]);
  fs.writeFileSync(path.join(outputRoot, "obsolete.html"), "stale build artifact");
  assert.equal(buildSite({ repoRoot: temporaryRoot }), outputRoot);
  assert.equal(fs.existsSync(path.join(outputRoot, "obsolete.html")), false, "Rebuild must remove stale artifacts");
  for (const [file, bytes] of before) assert.deepEqual(fs.readFileSync(path.join(outputRoot, file)), bytes, `Non-deterministic build: ${file}`);

  await checkProjectPrefix(outputRoot);

  const junctionRepo = path.join(temporaryRoot, "junction-repo");
  const protectedDirectory = path.join(temporaryRoot, "protected");
  fs.mkdirSync(junctionRepo);
  fs.mkdirSync(protectedDirectory);
  fs.writeFileSync(path.join(protectedDirectory, "keep.txt"), "preserve");
  fs.symlinkSync(protectedDirectory, path.join(junctionRepo, "_site"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => buildSite({ repoRoot: junctionRepo }), /symbolic link or junction/);
  assert.equal(fs.readFileSync(path.join(protectedDirectory, "keep.txt"), "utf8"), "preserve");

  console.log(`Slate site tests passed: ${routes.size} routes, guide links/anchors, both host digests, consumer-entry parity, deterministic rebuild, project-prefix HTTP, and safe cleanup.`);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

export async function testSiteBrowser(browser, { url, screenshots } = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const errors = [];
  const missing = [];
  const canvasRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) missing.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    if (/shell\/canvas\/(?:canvas\.(?:js|css)|index\.html)/.test(request.url())) canvasRequests.push(request.url());
  });
  let canvasPage;
  try {
    await page.goto(url);
    await page.locator("#document h1").waitFor();
    assert.equal(await page.evaluate(() => document.visibilityState), "visible", "Interaction checks need a visible browser context");
    const expectedRoutes = readJson(sourceRoot, path.join("site", "docs-manifest.json")).entries.length
      + readJson(sourceRoot, path.join("demo", "docs-manifest.json")).entries.filter((entry) => entry.type !== "canvas").length;
    assert.equal(await page.locator(".nav-item").count(), expectedRoutes);
    for (const entry of readJson(sourceRoot, path.join("site", "docs-manifest.json")).entries) {
      const title = fs.readFileSync(path.join(sourceRoot, entry.path), "utf8").match(/^# (.+)$/m)[1];
      await page.goto(`${url}#${entry.path}`);
      await page.waitForFunction((expected) => document.querySelector("#document h1")?.textContent === expected, title);
      assert.equal(await page.locator("#document h1").count(), 1);
    }
    await page.locator(".search-input").fill("GitHub Pages");
    await page.locator(".search-result").first().waitFor();
    assert.match(await page.locator(".search-results").innerText(), /GitHub Pages/);
    await page.locator(".search-input").fill("");
    await page.goto(`${url}#docs/github-pages.md#local-preview`);
    await page.locator("#local-preview").waitFor();
    await page.reload();
    await page.locator("#local-preview").waitFor();
    assert.match(page.url(), /#docs\/github-pages\.md#local-preview$/);
    assert.deepEqual(canvasRequests, [], "Ordinary reader routes must not load Canvas");

    await page.goto(`${url}#docs/overview.md`);
    await page.waitForFunction(() => document.querySelector("#document h1")?.textContent === "Slate documentation");
    if (screenshots) await page.screenshot({ path: `${screenshots}-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No mobile overflow in ${theme}`);
      if (screenshots) await page.screenshot({ path: `${screenshots}-mobile-${theme}.png` });
    }
    await page.getByRole("button", { name: "Show navigation", exact: true }).click();
    assert.equal(await page.locator(".menu-toggle").getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".menu-toggle").getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator(".menu-toggle").evaluate((element) => element === document.activeElement), true);

    await page.goto(`${url}#demo/components.html`);
    await page.locator(".slate-card").first().waitFor();
    await page.goto(`${url}#demo/landing.html`);
    const specRef = page.locator(".slate-spec-ref", { hasText: "DEC-02" }).first();
    await specRef.waitFor();
    await specRef.focus();
    await page.locator("#slate-xref-pop:not([hidden])").waitFor();
    assert.match(await page.locator("#slate-xref-pop").innerText(), /Send a small company on foot/);
    await specRef.blur();
    await page.goto(`${url}#demo/presentation-motion.html`);
    await page.locator(".slate-slide").first().waitFor();
    await page.goto(`${url}#docs/demos.md`);
    await page.waitForFunction(() => document.querySelector("#document h1")?.textContent === "Demo guide");
    const popup = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Open the read-only Canvas directly" }).click();
    canvasPage = await popup;
    canvasPage.on("pageerror", (error) => errors.push(error.message));
    await canvasPage.locator(".react-flow__node").first().waitFor();
    assert.ok(await canvasPage.locator(".react-flow__node").count() >= 7, "Canvas must render its groups and placements");
    assert.ok(await canvasPage.locator('a[href$="index.html#landing.html"]').count() > 0, "Canvas source link stays in the demo host");
    assert.deepEqual(errors, [], "No browser runtime errors");
    assert.deepEqual(missing, [], "No missing reader resources");
    console.log("Slate site browser checks passed: guide routes, search, deep-link reload, reader isolation, desktop/mobile themes, keyboard navigation, gallery, ID reference preview, presentation, and Canvas.");
  } finally {
    if (canvasPage) await canvasPage.close();
    await page.close();
  }
}
