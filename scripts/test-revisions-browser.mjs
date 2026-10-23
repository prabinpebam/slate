// Pass an existing Playwright page; no browser binary download is required.
export async function testRevisionsBrowser(page, { url, mode = 'workspace', screenshots } = {}) {
  let assertions = 0;
  function expect(value, message) { assertions += 1; if (!value) throw new Error(message); }
  const errors = [];
  page.on('pageerror', problem => errors.push(problem.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto(`${url}#docs/revisions.md`);
  await page.locator('#document h1').waitFor();
  expect(await page.locator('.revision-block-toggle').count() > 0, 'Initial deep links wait for revision tools before rendering selectable blocks');
  await page.getByRole('button', { name: 'Open revisions', exact: true }).click();
  const panel = page.locator('#slate-revision-panel');
  async function menuAction(name, trigger = 'Revision actions') {
    await panel.getByRole('button', { name: trigger, exact: true }).click();
    await panel.getByRole('menuitem', { name, exact: true }).click();
  }
  async function selectedName() { return panel.locator('#revision-picker option:checked').textContent(); }
  await page.waitForFunction(expected => document.querySelector('.revision-storage').dataset.state === expected,
    mode === 'workspace' ? 'saved' : 'static');
  expect(await panel.getByRole('heading', { name: 'Revision', exact: true }).count() === 1, 'Panel heading is Revision');
  if (mode === 'static') {
    expect(await panel.getByRole('button', { name: 'New revision', exact: true }).isDisabled(), 'Static hosting does not pretend to save project files');
    await panel.getByRole('button', { name: 'Revision actions', exact: true }).click();
    expect(await panel.getByRole('menuitem', { name: 'Import JSON', exact: true }).isDisabled(), 'Static hosting cannot import unsavable revisions');
    await page.keyboard.press('Escape');
    expect(await panel.isVisible(), 'Escape dismisses the tools menu without closing the pane');
    expect(await page.locator('.revision-block-toggle:visible').count() === 0, 'Static reading is not revision editing');
    expect(errors.length === 0, 'Static reader has no runtime errors');
    return { mode, readOnly: true, assertions };
  }
  await panel.getByRole('button', { name: 'New revision', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.revision-select-action')?.getAttribute('aria-pressed') === 'true');
  expect(/^Revision /.test(await selectedName()), 'Revision has an automatic dated name');
  expect(await panel.locator('button:visible').count() <= 5, 'The resting editor has at most five visible buttons, not a wall of actions');
  expect(await panel.locator('.revision-primary:visible').count() === 1, 'The composer has one visually primary action');
  expect(await panel.locator('.revision-dialog:visible,.revision-menu-popover:visible').count() === 0, 'Management forms and backup tools are hidden until requested');
  expect(await panel.getByRole('button', { name: 'Add comment', exact: true }).isDisabled(), 'An empty comment cannot be submitted');
  const options = panel.getByRole('button', { name: 'Revision actions', exact: true });
  await options.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.textContent.includes('Rename revision'));
  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => document.activeElement.textContent.includes('Archive revision')), 'Arrow keys navigate grouped action menus');
  await page.keyboard.press('Escape');
  expect(await options.evaluate(element => element === document.activeElement), 'Menu Escape restores its trigger focus');
  expect(await panel.isVisible() && await panel.locator('.revision-select-action').getAttribute('aria-pressed') === 'true', 'Menu Escape does not close the pane or leave selection mode');
  await options.click();
  await panel.getByRole('heading', { name: 'Revision', exact: true }).click();
  expect(await panel.locator('.revision-menu-popover:visible').count() === 0, 'Outside clicks dismiss action menus');
  await menuAction('Rename revision');
  await panel.locator('#revision-name').fill('Cancelled rename');
  await page.keyboard.press('Escape');
  expect(await panel.getByRole('dialog').count() === 0, 'Escape closes a dialog before changing selection or the pane');
  expect(/^Revision /.test(await selectedName()), 'Cancelling the rename dialog preserves the saved name');
  const name = `Browser acceptance ${Date.now()}`;
  await menuAction('Rename revision');
  await panel.locator('#revision-name').fill(name);
  await panel.getByRole('dialog').getByRole('button', { name: 'Save name', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.revision-storage').dataset.state === 'saved');
  const controls = page.locator('.revision-block-toggle:visible');
  if (await page.evaluate(() => matchMedia('(hover: hover)').matches)) {
    expect(await controls.nth(1).evaluate(element => getComputedStyle(element).opacity === '0'), 'Unselected desktop gutters stay quiet until hover or focus');
  }
  await controls.nth(0).click();
  await controls.nth(2).click({ modifiers: ['Shift'] });
  expect((await panel.locator('.revision-selection-count').textContent()).startsWith('3 blocks'), 'Shift-click selects a range');
  await panel.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await controls.nth(0).focus();
  await page.keyboard.press('Space');
  expect(await controls.nth(0).getAttribute('aria-pressed') === 'true', 'Keyboard toggles a block');
  await panel.locator('#revision-comment-text').fill('Clarify the revision lifecycle and preserve complete targets.');
  await page.evaluate(() => { location.hash = 'docs/reader-guide.md'; });
  await page.waitForFunction(() => document.querySelector('#document h1')?.textContent === 'Reader guide');
  expect((await panel.locator('#revision-comment-text').inputValue()).startsWith('Clarify'), 'Draft survives navigation');
  expect((await panel.locator('.revision-selection-count').textContent()).startsWith('1 block'), 'Selection survives navigation');
  await page.locator('.revision-block-toggle:visible').nth(4).click();
  await panel.getByRole('button', { name: 'Add comment', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.revision-comments h3')?.textContent === 'Comments (1)');
  await page.waitForFunction(() => document.querySelector('.revision-storage').dataset.state === 'saved');
  const revision = await page.evaluate(() => {
    const key = `slate-revisions-v1:${location.pathname.replace(/index\.html$/, '')}`;
    const data = JSON.parse(localStorage.getItem(key));
    return data.revisions.find(item => item.id === data.selectedId);
  });
  expect(revision.name === name, 'Rename is durable');
  expect(revision.host && revision.host !== 'docs/revisions.md', 'JSON declares its host relative to the parent project');
  expect(revision.sources.length === 2, 'One comment can reference multiple pages');
  expect(revision.comments[0].targets.length === 2, 'Complete multi-target comment is saved');
  expect(revision.sources.every(source => source.content && /^[a-f0-9]{64}$/.test(source.sha256)), 'Original sources and hashes are recorded');
  expect(revision.comments[0].targets.every(target => target.html && target.selector && target.headings.length), 'Precise block snapshots and context are recorded');
  await page.evaluate(() => {
    window.__slateOriginalClipboardWrite = navigator.clipboard.writeText;
    navigator.clipboard.writeText = async text => { window.__slateRevisionHandoff = text; };
  });
  try {
    await menuAction('Copy agent handoff');
    const handoff = await page.evaluate(() => window.__slateRevisionHandoff);
    expect(handoff.includes(`.slate/revisions/${revision.id}.json`) && handoff.includes('then archive'), 'The grouped handoff action still points agents to automatically saved files');
  } finally {
    await page.evaluate(() => { navigator.clipboard.writeText = window.__slateOriginalClipboardWrite; });
  }
  if (mode === 'workspace') {
    const saved = await page.evaluate(async id => {
      const response = await fetch(new URL(`__slate/revisions/${id}`, document.baseURI));
      if (!response.ok) throw new Error('Workspace revision is not readable');
      return response.json();
    }, revision.id);
    expect(saved.comments.length === 1, 'Cross-page comment is actually persisted');
  }
  const captured = await page.evaluate(async () => {
    const { captureBlocks } = await import(new URL('shell/revisions.js', document.baseURI));
    const root = new DOMParser().parseFromString('<h1>Fixture</h1><p>Repeated text</p><p>Repeated text</p><figure><img src="assets/source.png" alt="Reference diagram"></figure><table><tr><td>Cell</td></tr></table><pre><code>sample()</code></pre><ul><li>Outer<ul><li>Inner</li></ul></li></ul>', 'text/html').body;
    return captureBlocks(root, {}).map(({ target }) => target);
  });
  const repeated = captured.filter(target => target.text === 'Repeated text');
  expect(repeated.length === 2 && repeated[1].occurrence === 2 && repeated[0].matches === 2, 'Duplicate text is disambiguated');
  expect(captured.some(target => target.tag === 'figure' && target.html.includes('Reference diagram') && target.html.includes('assets/source.png')), 'Non-text source attributes are retained');
  expect(captured.filter(target => target.tag === 'table').length === 1 && !captured.some(target => target.tag === 'td'), 'Tables are complete atomic blocks');
  expect(captured.filter(target => target.tag === 'li').length === 1 && captured.some(target => target.tag === 'li' && target.text.includes('Inner')), 'Nested lists preserve complete outer items');
  await page.evaluate(() => { location.hash = 'demo/markdown-parity.md'; });
  await page.locator('.page-body .slate-callout').first().waitFor();
  expect(await page.locator('.page-body .slate-callout').first().evaluate(element =>
    element.querySelector(':scope > .revision-block-toggle')), 'Transformed Markdown callouts retain selection controls');
  await page.evaluate(() => { location.hash = 'demo/components.html'; });
  await page.locator('.slate-card-grid .revision-block-toggle:visible').first().waitFor();
  expect(await page.locator('.slate-card-grid > .revision-block-toggle').count() === 0, 'Selection controls do not become extra grid items');
  expect(await page.locator('.slate-card > .revision-block-toggle').first().evaluate(element =>
    getComputedStyle(element).position === 'absolute'), 'Component selection controls do not consume layout space');
  expect(await page.locator('ul > .revision-block-toggle,ol > .revision-block-toggle').count() === 0, 'List controls remain inside list items');
  await page.evaluate(() => { location.hash = 'docs/reader-guide.md'; });
  await page.waitForFunction(() => document.querySelector('#document h1')?.textContent === 'Reader guide');
  await menuAction('Edit comment', 'Comment 1 actions');
  await panel.locator('#revision-comment-text').fill('Updated feedback: clarify the lifecycle.');
  await panel.getByRole('button', { name: 'Save comment', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.revision-comment-text')?.textContent.startsWith('Updated feedback'));
  expect(await panel.locator('.revision-target-previews').getAttribute('open') === null, 'Excerpts start collapsed without hiding navigation');
  expect(await panel.locator('.revision-target-link:visible').count() === 2, 'Every block in a multi-page comment has a directly visible navigation link');
  async function expectFocusedTarget(targetIndex) {
    const target = revision.comments[0].targets[targetIndex];
    await page.waitForFunction(() => document.activeElement?.classList.contains('revision-target-focus'));
    const focused = await page.locator('.revision-target-focus').evaluate(element => {
      const copy = element.cloneNode(true);
      copy.querySelectorAll('.revision-block-toggle,.heading-anchor,.collapse-toggle').forEach(control => control.remove());
      const bounds = element.getBoundingClientRect();
      const content = document.querySelector('#content').getBoundingClientRect();
      return {
        tag: element.localName, text: copy.textContent.trim().replace(/\s+/g, ' '),
        revealed: !element.closest('.doc-section.collapsed,details:not([open])'),
        inViewport: bounds.height > 0 && bounds.bottom > Math.max(content.top, 0)
          && bounds.top < Math.min(content.bottom, innerHeight),
      };
    });
    expect(focused.tag === target.tag && focused.text === target.text, 'Navigation highlights and focuses the exact anchored block');
    expect(focused.revealed && focused.inViewport, 'The anchored block is revealed and scrolled into view');
  }
  await page.getByRole('button', { name: 'Collapse all sections', exact: true }).click();
  await panel.getByRole('button', { name: /^View target 2:/ }).click();
  await expectFocusedTarget(1);
  expect((await page.locator('#document h1').textContent()) === 'Reader guide', 'Same-page navigation stays on the target page');
  await panel.getByRole('button', { name: /^View target 1:/ }).focus();
  await page.keyboard.press('Enter');
  await expectFocusedTarget(0);
  expect((await page.locator('#document h1').textContent()) === 'Revisions', 'Target navigation returns to the original page');
  await panel.locator('.revision-target-previews summary').click();
  expect(await panel.locator('.revision-quote:visible').count() === 2, 'Saved excerpts remain available separately from navigation');
  const secondSource = revision.sources.find(source => source.id === revision.comments[0].targets[1].sourceId);
  for (const failure of ['stale', 'missing']) {
    await page.evaluate(({ path, failure }) => {
      window.__slateOriginalTargetFetch = window.fetch;
      const sourceUrl = new URL(path, document.baseURI).href;
      window.fetch = (input, options) => String(input) === sourceUrl
        ? Promise.resolve(new Response('Changed source', { status: failure === 'missing' ? 404 : 200 }))
        : window.__slateOriginalTargetFetch(input, options);
    }, { path: secondSource.path, failure });
    try {
      await panel.getByRole('button', { name: /^View target 2:/ }).click();
      await page.waitForFunction(() => document.querySelector('.revision-error').textContent.includes('stale or missing'));
      expect((await page.locator('#document h1').textContent()) === 'Revisions', `${failure} sources are rejected without guessing a block`);
    } finally {
      await page.evaluate(() => { window.fetch = window.__slateOriginalTargetFetch; });
    }
  }
  await page.reload();
  await page.locator('#document h1').waitFor();
  await page.getByRole('button', { name: 'Open revisions', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.revision-comment-text')?.textContent.startsWith('Updated feedback'));
  expect(await selectedName() === name, 'Revision and edits survive reload');
  await menuAction('Archive revision');
  await panel.locator('#revision-completion-summary').fill('Acceptance fixture: every requested change verified.');
  await panel.getByRole('dialog').getByRole('button', { name: 'Archive revision', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.revision-archived') && !document.querySelector('.revision-meta'));
  expect(await panel.locator('.revision-archived').getAttribute('open') === null, 'Archived group starts collapsed');
  expect(await panel.locator('.revision-comment').count() === 0, 'Archived feedback collapses out of the editor');
  await panel.locator('.revision-archived summary').click();
  await panel.locator('.revision-archived .revision-choice').filter({ hasText: name }).click();
  expect(await panel.locator('.revision-target-link:visible').count() === 2, 'Archived comments retain direct block navigation without reopening');
  await panel.getByRole('button', { name: /^View target 2:/ }).click();
  await expectFocusedTarget(1);
  expect((await panel.locator('.revision-meta').textContent()) === 'Archived', 'Inspecting an archived target does not reopen or change the revision');
  await panel.getByRole('button', { name: 'Reopen revision', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.revision-meta')?.textContent.startsWith('Active'));
  expect(await panel.locator('.revision-comment').count() === 1, 'Reopen preserves existing comments');
  await page.evaluate(() => { location.hash = 'demo/components.html'; });
  await page.waitForFunction(() => document.querySelector('#document h1')?.textContent === 'Component gallery');
  await page.locator('#disclosure-outer > summary').click();
  await page.locator('#disclosure-inner > summary').click();
  await panel.getByRole('button', { name: 'Select blocks', exact: true }).click();
  await page.locator('#revision-disclosure-target > .revision-block-toggle').click();
  await panel.locator('#revision-comment-text').fill('A second comment after reopening.');
  await panel.getByRole('button', { name: 'Add comment', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.revision-comments h3')?.textContent === 'Comments (2)');
  const singleComment = panel.locator('.revision-comment').last();
  expect(await singleComment.locator('.revision-target-link:visible').count() === 1, 'A single-block comment exposes its destination immediately');
  await page.locator('#disclosure-inner > summary').click();
  await page.locator('#disclosure-outer > summary').click();
  await page.evaluate(() => document.querySelector('#content').scrollTo({ top: 0, behavior: 'instant' }));
  await singleComment.getByRole('button', { name: /^View target 1:/ }).click();
  async function expectDisclosureTarget() {
    await page.waitForFunction(() => {
      const element = document.querySelector('#revision-disclosure-target');
      if (!element || document.activeElement !== element) return false;
      const content = document.querySelector('#content');
      const bounds = element.getBoundingClientRect();
      const viewport = content.getBoundingClientRect();
      const destination = Math.max(0, Math.min(content.scrollHeight - content.clientHeight,
        content.scrollTop + bounds.top - viewport.top - (content.clientHeight - bounds.height) / 2));
      return Math.abs(content.scrollTop - destination) <= 1;
    });
    const position = await page.locator('#revision-disclosure-target').evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const content = document.querySelector('#content');
      const viewport = content.getBoundingClientRect();
      return {
        revealed: !element.closest('details:not([open]),.doc-section.collapsed'),
        centered: bounds.top + bounds.height / 2 >= viewport.top
          && bounds.top + bounds.height / 2 <= viewport.bottom,
        scrolled: content.scrollTop > 500,
      };
    });
    expect(position.revealed, 'Target navigation opens every nested native disclosure');
    expect(position.centered && position.scrolled, 'A deep anchor lands inside the scrolled document pane, not just the browser viewport');
  }
  await expectDisclosureTarget();
  async function measureTargetScroll() {
    await page.evaluate(() => {
      window.__slateScrollFrames = [];
      window.__slateOriginalAnimationFrame = window.requestAnimationFrame;
      window.requestAnimationFrame = callback => window.__slateOriginalAnimationFrame(timestamp => {
        callback(timestamp);
        if (callback.name === 'position') {
          window.__slateScrollFrames.push({
            timestamp, top: document.querySelector('#content').scrollTop,
            focused: document.activeElement?.id === 'revision-disclosure-target',
          });
        }
      });
    });
    try {
      await singleComment.getByRole('button', { name: /^View target 1:/ }).click();
      await page.waitForFunction(() => window.__slateScrollFrames.at(-1)?.focused);
      return await page.evaluate(() => window.__slateScrollFrames);
    } finally {
      await page.evaluate(() => { window.requestAnimationFrame = window.__slateOriginalAnimationFrame; });
    }
  }
  const reducedFrames = await measureTargetScroll();
  expect(reducedFrames.length === 1 && reducedFrames[0].top > 500, 'Reduced motion reaches the deep anchor in one frame without animation');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const smoothFrames = await measureTargetScroll();
  const elapsed = smoothFrames.at(-1).timestamp - smoothFrames[0].timestamp;
  const previousElapsed = smoothFrames.at(-2).timestamp - smoothFrames[0].timestamp;
  const largestFrame = Math.max(...smoothFrames.slice(1).map((frame, index) => frame.timestamp - smoothFrames[index].timestamp));
  expect(elapsed >= 200 && previousElapsed < 200 && elapsed <= 200 + largestFrame + 1,
    'Smooth scrolling completes at 200 ms, rounded to the next animation frame');
  expect(smoothFrames.some(frame => frame.top > 0 && frame.top < smoothFrames.at(-1).top),
    'The document moves through intermediate scroll positions rather than snapping');
  await expectDisclosureTarget();
  for (const interrupted of [false, true]) {
    let releaseImage;
    const imageReleased = new Promise(resolve => { releaseImage = resolve; });
    let imageRequested = false;
    const imagePattern = '**/demo/assets/disclosure-reference.svg';
    const delayImage = async route => {
      imageRequested = true;
      await imageReleased;
      await route.continue();
    };
    await page.route(imagePattern, delayImage);
    try {
      await page.evaluate(() => { location.hash = 'docs/reader-guide.md'; });
      await page.waitForFunction(() => document.querySelector('#document h1')?.textContent === 'Reader guide');
      await singleComment.getByRole('button', { name: /^View target 1:/ }).click();
      await expectDisclosureTarget();
      expect(imageRequested, 'The lazy image preceding the anchor is still loading during the initial jump');
      if (interrupted) {
        await page.keyboard.press('Home');
        await page.evaluate(() => document.querySelector('#content').scrollTo({ top: 0, behavior: 'instant' }));
      }
      releaseImage();
      await page.waitForFunction(() => {
        const image = document.querySelector('#disclosure-inner img');
        return image?.complete && image.naturalHeight > 1000;
      });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      if (interrupted) {
        expect(await page.locator('#content').evaluate(element => element.scrollTop === 0),
          'User interaction cancels layout-following so image loads do not pull the reader back');
      } else {
        await expectDisclosureTarget();
        expect(await page.locator('#disclosure-inner img').evaluate(image => image.getBoundingClientRect().bottom
          <= document.querySelector('#revision-disclosure-target').getBoundingClientRect().top),
        'The settled image layout precedes the correctly positioned target');
      }
    } finally {
      releaseImage();
      await page.unroute(imagePattern, delayImage);
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => { location.hash = 'docs/reader-guide.md'; });
  await page.waitForFunction(() => document.querySelector('#document h1')?.textContent === 'Reader guide');
  await singleComment.getByRole('button', { name: /^View target 1:/ }).click();
  await expectDisclosureTarget();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await menuAction('Remove comment', 'Comment 2 actions');
  await panel.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.revision-comments h3')?.textContent === 'Comments (1)');
  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
      window.__slateRevisionExport = blob;
      return original.call(this, blob);
    };
  });
  await menuAction('Export JSON');
  const exported = await page.evaluate(async () => JSON.parse(await window.__slateRevisionExport.text()));
  expect(exported.id === revision.id && exported.kind === 'slate-revision', 'Export produces portable revision JSON');
  const beforeImport = await panel.locator('#revision-picker option').count();
  async function importFile(name, content) {
    await page.evaluate(({ name, content }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([content], name, { type: 'application/json' }));
      const input = document.querySelector('#slate-revision-panel input[type=file]');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, { name, content });
  }
  await importFile('invalid.json', '{"invalid":true}');
  await page.waitForFunction(() => !document.querySelector('.revision-error').hidden);
  expect(await panel.locator('#revision-picker option').count() === beforeImport, 'Invalid import cannot create a revision');
  const copy = JSON.parse(JSON.stringify(revision));
  copy.id = await page.evaluate(() => `rev-${crypto.randomUUID()}`);
  copy.name = 'Imported acceptance fixture';
  await importFile(`${copy.id}.json`, JSON.stringify(copy));
  await page.waitForFunction(() => document.querySelector('#revision-picker option:checked')?.textContent === 'Imported acceptance fixture');
  expect(await panel.locator('#revision-picker option').count() === beforeImport + 1, 'Valid JSON imports without replacing another revision');
  await panel.locator('#revision-picker').selectOption(revision.id);
  expect(await selectedName() === name, 'The native revision picker switches independent revisions');
  await panel.locator('#revision-picker').selectOption(copy.id);
  await page.setViewportSize({ width: 375, height: 812 });
  if (await panel.locator('.revision-select-action').getAttribute('aria-pressed') !== 'true') {
    await panel.locator('.revision-select-action').click();
  }
  await page.locator('.revision-block-toggle:visible').first().focus();
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '375px layout has no horizontal overflow');
  const bounds = await page.locator('#content').boundingBox();
  const panelBounds = await panel.boundingBox();
  expect(bounds.height > 100 && bounds.height < 812, 'Narrow panel leaves the document usable');
  expect(panelBounds.y >= 48 && panelBounds.y + panelBounds.height <= 813, 'Panel remains inside the narrow viewport, not below the full article');
  await panel.getByRole('button', { name: 'Revision actions', exact: true }).click();
  const menuBounds = await panel.locator('.revision-menu-popover:visible').boundingBox();
  expect(menuBounds.x >= 0 && menuBounds.x + menuBounds.width <= 375 && menuBounds.y + menuBounds.height <= 813, 'Action popovers fit the narrow viewport');
  await page.keyboard.press('Escape');
  const lightBackground = await panel.evaluate(element => getComputedStyle(element).backgroundColor);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  expect(await panel.evaluate(element => getComputedStyle(element).backgroundColor) !== lightBackground, 'The pane uses real dark-theme surface colors');
  if (screenshots) await page.screenshot({ path: `${screenshots}-mobile-dark.png` });
  await page.keyboard.press('Escape');
  expect(await page.locator('.revision-block-toggle:visible').count() === 0, 'Escape exits selection first');
  await page.keyboard.press('Escape');
  expect(await panel.isVisible() === false, 'Second Escape closes the panel');
  expect(await page.getByRole('button', { name: 'Open revisions', exact: true }).evaluate(element => element === document.activeElement), 'Closing restores focus');
  await page.getByRole('button', { name: 'Open revisions', exact: true }).click();
  await panel.getByRole('button', { name: 'Revision actions', exact: true }).click();
  await page.emulateMedia({ media: 'print' });
  expect(await panel.isVisible() === false, 'Revision chrome is absent from print');
  expect(await panel.locator('.revision-menu-popover:visible').count() === 0, 'Top-layer menus are absent from print too');
  await page.emulateMedia({ media: 'screen', colorScheme: 'light' });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1000 });
  if (screenshots) await page.screenshot({ path: `${screenshots}-desktop-light.png` });
  expect(errors.length === 0, `No browser runtime errors: ${errors.join('; ')}`);
  return { mode, ids: [revision.id, copy.id], assertions, name };
}
