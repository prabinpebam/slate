import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "schema", "config.schema.json"), "utf8"));
const shell = fs.readFileSync(path.join(root, "shell", "index.html"), "utf8");
const runtime = fs.readFileSync(path.join(root, "shell", "slate.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "shell", "slate.css"), "utf8");

assert.equal(schema.properties.readerPersonas.type, "array");
assert.deepEqual(schema.properties.readerPersonas.items.required, ["id", "label"]);
assert.equal(schema.properties.defaultReaderPersona.type, "string");
assert.match(shell, /<label for="reader-persona-select">View for<\/label>/);
assert.match(shell, /id="reader-persona-status" aria-live="polite"/);
assert.match(runtime, /function configureReaderPersonas\(/);
assert.match(runtime, /function applyReaderPersonaToSections\(/);
assert.match(runtime, /section\.classList\.toggle\('collapsed', secondary\)/);
assert.match(runtime, /if \(heading\.dataset\.readerPersonas\) section\.dataset\.readerPersonas/);
assert.match(runtime, /localStorage\.setItem\('slate-reader-persona'/);
assert.match(styles, /\.reader-persona select/);
assert.match(styles, /\.doc-section\.reader-secondary/);

const storage = new Map();
const selector = {
  value: "",
  replaceChildren() {},
  add() {},
};
const context = vm.createContext({
  document: {
    querySelector: selectorText => ({
      "#reader-persona": { classList: { toggle() {} } },
      "#reader-persona-select": selector,
      "#reader-persona-status": {},
    })[selectorText] || null,
    documentElement: { setAttribute() {} },
  },
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
  Option: function (label, id) { this.label = label; this.value = id; },
});
const bootstrap = runtime.indexOf("  if (document.readyState === 'loading')");
assert.ok(bootstrap > 0);
vm.runInContext(runtime.slice(0, bootstrap) + "globalThis.personas = { state, configureReaderPersonas, applyReaderPersona }; })();", context);
const { state, configureReaderPersonas, applyReaderPersona } = context.personas;
const personas = [{ id: "author", label: "Authors" }, { id: "reviewer", label: "Reviewers" }];
configureReaderPersonas(personas, "author");
assert.equal(state.readerPersona, "author", "Configured default applies on first visit");
applyReaderPersona("reviewer");
configureReaderPersonas(personas, "author");
assert.equal(state.readerPersona, "reviewer", "Saved persona overrides the default");
applyReaderPersona("all");
configureReaderPersonas(personas, "author");
assert.equal(state.readerPersona, "all", "Saved All readers overrides the default");
storage.set("slate-reader-persona", "retired");
configureReaderPersonas(personas, "author");
assert.equal(state.readerPersona, "author", "Removed personas fall back to the configured default");

console.log("Slate reader-persona contract and preference tests passed.");

export async function testReaderPersonasBrowser(browser, { url, screenshots }) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const errors = [];
  const canvasRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (/\/shell\/canvas\//.test(request.url())) canvasRequests.push(request.url()); });
  try {
    await page.route("**/slate.config.json", async route => {
      const response = await route.fetch();
      const config = await response.json();
      await route.fulfill({ response, json: { ...config, defaultReaderPersona: "author" } });
    });
    await page.goto(url);
    await page.locator("#document h1").waitFor();
    assert.equal(await page.evaluate(() => document.visibilityState), "visible", "Use a visible browser for interaction checks");
    const select = page.getByLabel("View for");
    const secondary = page.locator('.doc-section[data-reader-personas="reviewer"]');
    assert.equal(await select.inputValue(), "author");
    assert.equal(await secondary.locator(":scope > .doc-section-body").isVisible(), false, "Secondary content starts collapsed");
    assert.equal(await secondary.locator(".collapse-toggle").getAttribute("aria-label"), "Expand section");
    assert.equal(await page.locator('.toc a[href$="#metrics"]').count(), 1, "Secondary content remains in the TOC");
    await page.locator(".search-input").fill("Leagues walked");
    await page.locator(".search-results.visible").waitFor();
    assert.equal(await page.locator(".search-results .search-result-title").filter({ hasText: "Component gallery" }).count(), 1, "Collapsed content remains searchable");
    await page.locator(".search-input").fill("");
    await select.selectOption("reviewer");
    assert.equal(await secondary.locator(":scope > .doc-section-body").isVisible(), true, "Matching content expands");
    assert.equal(await secondary.locator(".collapse-toggle").getAttribute("aria-label"), "Collapse section");
    assert.equal(await page.locator('.doc-section[data-reader-personas="author"]').first().locator(":scope > .doc-section-body").isVisible(), false);
    assert.equal(await page.locator("#badges").locator("..").locator(":scope > .doc-section-body").isVisible(), true, "Untagged context stays expanded");
    await select.selectOption("all");
    await page.reload();
    await page.locator("#document h1").waitFor();
    assert.equal(await select.inputValue(), "all", "All readers persists over a configured default");
    assert.equal(await secondary.locator(":scope > .doc-section-body").isVisible(), true);
    await select.selectOption("author");
    await page.goto(url + "#metrics");
    await page.locator("#metrics").waitFor();
    await page.waitForFunction(() => !document.querySelector("#metrics").closest(".doc-section").classList.contains("collapsed"));
    assert.equal(await secondary.locator(":scope > .doc-section-body").isVisible(), true, "Deep links reveal secondary sections");
    await page.setViewportSize({ width: 375, height: 812 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Persona controls fit narrow screens");
    if (screenshots) await page.screenshot({ path: screenshots + "-mobile.png" });
    await page.emulateMedia({ colorScheme: "dark" });
    if (screenshots) await page.screenshot({ path: screenshots + "-mobile-dark.png" });
    assert.deepEqual(canvasRequests, [], "Ordinary pages do not request Canvas assets");
    assert.deepEqual(errors, [], "No runtime errors");
    await page.route("**/components.html", route => route.fulfill({
      contentType: "text/html",
      body: '<h1>Reader disclosure fixture</h1><h2 data-reader-personas="author">Author context</h2><p>Shared definition.</p><h3 data-reader-personas="reviewer">Reviewer detail</h3><p id="review-detail">Review checks.</p>',
    }));
    await page.goto(url);
    await page.reload();
    await page.locator("#review-detail").waitFor({ state: "attached" });
    await select.selectOption("reviewer");
    assert.equal(await page.locator("#review-detail").isVisible(), true, "Matching nested sections reveal their ancestors");
    await page.route("**/slate.config.json", async route => {
      const response = await route.fetch();
      const config = await response.json();
      config.readerPersonas = [{ id: "reviewer", label: "Documentation reviewers and maintainers" }];
      await route.fulfill({ response, json: config });
    });
    await page.reload();
    await page.locator("#review-detail").waitFor({ state: "attached" });
    await page.setViewportSize({ width: 320, height: 812 });
    assert.ok(await page.evaluate(() => {
      const controls = document.querySelectorAll(".menu-toggle, #reader-persona-select, .theme-toggle");
      return [...controls].every(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth;
      });
    }), "Long persona labels keep essential header controls within a narrow viewport");
    if (screenshots) await page.screenshot({ path: screenshots + "-long-label.png" });
    await page.route("**/slate.config.json", async route => {
      const response = await route.fetch();
      const config = await response.json();
      delete config.readerPersonas;
      delete config.defaultReaderPersona;
      await route.fulfill({ response, json: config });
    });
    await page.reload();
    await page.locator("#review-detail").waitFor({ state: "attached" });
    assert.equal(await select.isVisible(), false, "Unconfigured hosts have no persona control");
    assert.equal(await page.locator("#review-detail").isVisible(), true, "Unconfigured hosts retain ordinary expanded sections");
    assert.deepEqual(errors, [], "No runtime errors after configuration changes");
    console.log("Slate browser reader-persona checks passed: " + url);
  } finally {
    await page.close();
  }
}