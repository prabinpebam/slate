import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime = fs.readFileSync(new URL('../shell/slate.js', import.meta.url), 'utf8');
const context = vm.createContext({
  URL,
  document: {
    createElement: () => ({
      textContent: '',
      get innerHTML() { return String(this.textContent).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); },
    }),
  },
});
const bootstrap = runtime.indexOf("  if (document.readyState === 'loading')");
assert.ok(bootstrap > 0);
vm.runInContext(runtime.slice(0, bootstrap) + 'globalThis.navigation = { state, navigationGroups, buildFileTree, renderBreadcrumbs, leavesParentDomain }; })();', context);
const { state, navigationGroups, buildFileTree, renderBreadcrumbs, leavesParentDomain } = context.navigation;
state.landing = 'home.html';
state.docs.set('generated/2027/frameworks/navigation.html', { title: 'Navigation', group: 'Product/Mobile/Frameworks', order: 1 });
state.docs.set('guides/setup/install.md', { title: 'Install', order: 2 });
state.docs.set('hidden/private.md', { title: 'Hidden', group: 'Private', hidden: true });
state.docs.set('home.html', { title: 'Overview', order: 0 });
state.docs.set('quotes.html', { title: '<Page>', group: 'Research/Costs & benefits/Reader "questions"', order: 3 });

assert.deepEqual(Array.from(navigationGroups('generated/2027/frameworks/navigation.html')), ['Product', 'Mobile', 'Frameworks']);
assert.deepEqual(Array.from(navigationGroups('guides/setup/install.md')), ['guides', 'setup']);
assert.deepEqual(Array.from(navigationGroups('home.html')), []);
buildFileTree();
assert.equal(state.fileTree.children.get('Product').children.get('Mobile').children.get('Frameworks').files[0].path, 'generated/2027/frameworks/navigation.html');
assert.equal(state.fileTree.children.has('generated'), false);
assert.equal(state.fileTree.children.has('Private'), false);
assert.equal(state.fileTree.children.get('guides').children.get('setup').files[0].title, 'Install');
const crumbs = renderBreadcrumbs('generated/2027/frameworks/navigation.html');
assert.match(crumbs, /data-nav-folder="Product%2FMobile%2FFrameworks">Frameworks<\/button>/);
assert.match(crumbs, /aria-current="page">Navigation<\/span>/);
assert.doesNotMatch(crumbs, /Generated|2027/);
assert.match(renderBreadcrumbs('guides/setup/install.md'), /data-nav-folder="guides%2Fsetup">Setup<\/button>/);
assert.match(renderBreadcrumbs('quotes.html'), /Costs &amp; benefits/i);
assert.match(renderBreadcrumbs('quotes.html'), /Reader%20%22questions%22/);
assert.match(renderBreadcrumbs('quotes.html'), /&lt;Page&gt;/);
// links: the documentation's own domain (served, or parentDomain and its subdomains) keeps the tab; anywhere else leaves it
assert.equal(leavesParentDomain('https://example.github.io/site/', 'localhost', 'example.github.io'), false);
assert.equal(leavesParentDomain('https://docs.example.github.io/', 'localhost', 'example.github.io'), false);
assert.equal(leavesParentDomain('https://localhost/other/', 'localhost', ''), false);
assert.equal(leavesParentDomain('https://github.com/example/repo', 'localhost', 'example.github.io'), true);
assert.equal(leavesParentDomain('https://notexample.github.io/', 'localhost', 'example.github.io'), true);
assert.equal(leavesParentDomain('https://github.com/x', 'example.github.io', ''), true);
assert.equal(leavesParentDomain('guide.md', 'localhost', 'example.github.io'), false);
console.log('Slate navigation hierarchy and link tests passed (21 assertions).');

export async function testNavigationBrowser(browser, { url, groups, screenshots }) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(url);
    await page.locator('#document h1').waitFor();
    assert.equal(await page.evaluate(() => document.visibilityState), 'visible', 'Use a visible browser for interaction checks');
    assert.deepEqual(await page.locator('.breadcrumbs button').allTextContents(), groups);
    assert.equal(await page.locator('.nav-item.active').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('.nav-folder.expanded').count(), groups.length);
    const original = await page.locator('#content').boundingBox();
    await page.getByRole('button', { name: 'Hide navigation', exact: true }).click();
    assert.equal(await page.locator('#sidebar').isVisible(), false, 'Desktop sidebar is hidden');
    assert.equal(await page.locator('#sidebar-resize-handle').isVisible(), false, 'Hidden sidebar has no resize control');
    assert.ok((await page.locator('#content').boundingBox()).width > original.width, 'Article receives freed space');
    await page.reload();
    await page.locator('#document h1').waitFor();
    assert.equal(await page.locator('#sidebar').isVisible(), false, 'Collapse persists on reload');
    await page.locator('.breadcrumbs').getByRole('button', { name: groups.at(-1), exact: true }).click();
    assert.equal(await page.locator('#sidebar').isVisible(), true, 'Breadcrumb reopens sidebar');
    assert.equal(await page.evaluate(() => document.activeElement.closest('.nav-folder').dataset.folderPath), groups.join('/'));
    if (screenshots) await page.screenshot({ path: screenshots + '-desktop.png' });
    await page.getByRole('button', { name: 'Hide navigation', exact: true }).click();
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForFunction(() => !document.querySelector('.app').classList.contains('sidebar-collapsed'));
    assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false', 'Mobile starts closed');
    await page.getByRole('button', { name: 'Show navigation', exact: true }).click();
    assert.equal(await page.locator('#sidebar').evaluate(element => element.inert), false, 'Open mobile navigation is interactive');
    assert.equal(await page.locator('#content').evaluate(element => element.inert), true, 'Covered article is not keyboard-focusable');
    await page.locator('#sidebar button:visible, #sidebar a[href]:visible').last().focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.menu-toggle').evaluate(element => element === document.activeElement), true, 'Tab stays in mobile navigation');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false', 'Escape closes mobile navigation');
    assert.equal(await page.locator('.menu-toggle').evaluate(element => element === document.activeElement), true, 'Escape returns focus');
    await page.locator('.breadcrumbs').getByRole('button', { name: groups.at(-1), exact: true }).click();
    await page.locator('.nav-item.active').click();
    assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false', 'Selecting the current page closes navigation');
    assert.equal(await page.locator('#content').evaluate(element => element.inert), false, 'Article becomes interactive');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Narrow reader has no horizontal overflow');
    if (screenshots) await page.screenshot({ path: screenshots + '-mobile.png' });
    await page.emulateMedia({ colorScheme: 'dark' });
    if (screenshots) await page.screenshot({ path: screenshots + '-mobile-dark.png' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => document.querySelector('.app').classList.contains('sidebar-collapsed'));
    assert.equal(await page.locator('#sidebar').isVisible(), false, 'Mobile use preserves collapsed desktop preference');
    assert.deepEqual(errors, [], 'No runtime errors');
    console.log('Slate browser navigation checks passed: ' + url);
  } finally {
    await page.close();
  }
}