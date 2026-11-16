const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { future, expectNoOverflow, expectClickableCenter } = require('./browser-helpers.cjs');

const VIEWPORTS = [
  { width: 320, height: 568, touch: true }, { width: 360, height: 800, touch: true },
  { width: 390, height: 844, touch: true }, { width: 430, height: 932, touch: true },
  { width: 667, height: 375, touch: true }, { width: 844, height: 390, touch: true },
  { width: 768, height: 1024, touch: true }, { width: 1024, height: 768, touch: true },
  { width: 1280, height: 720 }, { width: 1366, height: 768 },
  { width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }
];
const SHOT_SIZES = new Set(['320x568', '390x844', '667x375', '1024x768', '1366x768', '1920x1080', '2560x1440']);

async function capture(page, info, label) {
  if (!process.env.QA_SCREENSHOT_DIR) return;
  await fs.mkdir(process.env.QA_SCREENSHOT_DIR, { recursive: true });
  await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); });
  await page.screenshot({ path: path.join(process.env.QA_SCREENSHOT_DIR, info.project.name.replace(/\W/g, '-') + '-' + label + '.png'), fullPage: true, animations: 'disabled' });
}

async function inspect(page, name, records, touch) {
  await expectNoOverflow(page);
  const state = await page.evaluate(() => ({
    width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
    clippedActions: [...document.querySelectorAll('button,summary')].filter(element => {
      if (!element.getClientRects().length || !element.clientWidth) return false;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS' && !parent.open && !parent.querySelector(':scope > summary')?.contains(element)) return false;
      }
      return element.scrollWidth > element.clientWidth + 2;
    }).map(element => ({ name: element.id || element.textContent.trim().slice(0, 60), width: element.clientWidth, scrollWidth: element.scrollWidth }))
  }));
  records.push({ name, ...state });
  expect(state.clippedActions, 'Action labels must wrap instead of being clipped').toEqual([]);
  if (touch) {
    const small = await page.locator('main button:visible,main summary:visible,#accountOpen').evaluateAll(elements => elements.filter(element => !element.disabled && element.getAttribute('aria-disabled') !== 'true' && element.getBoundingClientRect().height < 43.5).map(element => ({ name: element.id || element.textContent.trim().slice(0, 50), height: element.getBoundingClientRect().height, minHeight: getComputedStyle(element).minHeight, coarse: matchMedia('(pointer:coarse)').matches })));
    expect(small, 'Touch actions need at least 44 CSS pixels of height').toEqual([]);
  }
}

async function fillProfile(page, person) {
  await page.locator(person ? '#nameTwo' : '#nameOne').fill(person ? 'Константин' : 'Александра');
  for (const pref of ['food', 'walk']) await page.locator(`[data-act="rating"][data-person="${person}"][data-pref="${pref}"][data-rating="2"]`).click();
}

async function exerciseScreens(page, info, viewport, records, screenshot = false, resizeText = false) {
  const size = viewport.width + 'x' + viewport.height;
  const check = async name => {
    if (resizeText) await doubleText(page);
    await inspect(page, size + ':' + name, records, viewport.touch);
    if (screenshot) await capture(page, info, (resizeText ? 'text200-' : '') + size + '-' + name);
  };
  await page.goto('/'); await page.waitForFunction(() => sessionReady);
  await check('home'); await expectClickableCenter(page.locator('#startPlan')); await expectClickableCenter(page.locator('#accountOpen'));
  await page.locator('[data-nav="ideas"]:visible').first().click();
  await expect(page.locator('#ideas')).toBeVisible(); await check('ideas');
  await page.locator('[data-nav="home"]:visible').first().click();
  await page.locator('#startPlan').click();
  await page.locator('#dateStart').fill(future(5)); await page.locator('#dateEnd').fill(future(6));
  await page.locator('#budgetAmount').fill('20000');
  await page.locator('#travelDetails > summary').click(); await page.locator('#budgetAll').check();
  await page.locator('#transportReserve').fill('500'); await page.locator('#overnightStay').check();
  await page.locator('#hotelAddress').fill('Гостиница в Москве, общий адрес пары'); await page.locator('#hotelReserve').fill('5000');
  await check('step1'); await expectClickableCenter(page.locator('#nextStep')); await page.locator('#nextStep').click();
  await fillProfile(page, 0); await check('step2'); await expectClickableCenter(page.locator('#nextStep')); await page.locator('#nextStep').click();
  await fillProfile(page, 1); await check('step3'); await expectClickableCenter(page.locator('#nextStep')); await page.locator('#nextStep').click();
  await page.locator('#dayStart').fill('10:00'); await page.locator('#dayEnd').fill('19:00');
  await check('step4'); await expectClickableCenter(page.locator('#generatePlan')); await page.locator('#generatePlan').click();
  await expect(page.locator('#route')).toBeVisible(); await check('route');
  if (viewport.width === 320) {
    await page.locator('.more-menu > summary').click();
    await expectNoOverflow(page); await expectClickableCenter(page.locator('#exportCalendar'));
    const downloaded = page.waitForEvent('download'); await page.locator('#exportCalendar').click();
    expect((await downloaded).suggestedFilename()).toMatch(/\.ics$/);
    if (screenshot) await capture(page, info, (resizeText ? 'text200-' : '') + size + '-more-menu');
    await page.locator('.more-menu > summary').click();
  }
  await expectClickableCenter(page.locator('#savePlan')); await page.locator('#savePlan').click();
  await page.locator('#accountOpen').click(); await expect(page.locator('#account')).toBeVisible(); await check('account');
  await expectClickableCenter(page.locator('#newPlan'));
}

// Compute every base size first, then double it once. Reapply after dynamic views
// render; this emulates text-only resizing rather than claiming OS/browser zoom.
async function doubleText(page) {
  await page.evaluate(() => {
    for (const [element, original] of window.__qaFonts || []) {
      if (original.value) element.style.setProperty('font-size', original.value, original.priority);
      else element.style.removeProperty('font-size');
    }
    const elements = [...document.querySelectorAll('body,body *')].filter(element => element instanceof HTMLElement && !['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName));
    window.__qaFonts = elements.map(element => [element, { value: element.style.getPropertyValue('font-size'), priority: element.style.getPropertyPriority('font-size') }]);
    const sizes = elements.map(element => parseFloat(getComputedStyle(element).fontSize));
    elements.forEach((element, index) => { if (Number.isFinite(sizes[index])) element.style.setProperty('font-size', sizes[index] * 2 + 'px', 'important'); });
  });
}

test('Responsive sweep covers phones, landscape, tablets, laptops and wide desktops', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'Desktop Chrome', 'Run the large matrix once in Chromium, not in every functional project');
  test.setTimeout(240000);
  const records = [];
  for (const viewport of VIEWPORTS) await test.step(viewport.width + 'x' + viewport.height, async () => {
    const context = await browser.newContext({ baseURL, viewport: { width: viewport.width, height: viewport.height }, isMobile: !!viewport.touch, hasTouch: !!viewport.touch, locale: 'ru-RU', timezoneId: 'Europe/Moscow', reducedMotion: 'reduce' });
    try { await exerciseScreens(await context.newPage(), info, viewport, records, SHOT_SIZES.has(viewport.width + 'x' + viewport.height)); }
    finally { await context.close(); }
  });
  await info.attach('viewport-matrix', { body: JSON.stringify(records, null, 2), contentType: 'application/json' });
});

test('WebKit reflows tablet and landscape phone layouts', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'iPhone WebKit', 'Run the supplemental WebKit matrix only once');
  test.setTimeout(120000);
  const records = [];
  for (const viewport of [{ width: 844, height: 390, touch: true }, { width: 768, height: 1024, touch: true }, { width: 1024, height: 768, touch: true }]) {
    const context = await browser.newContext({ baseURL, viewport: { width: viewport.width, height: viewport.height }, isMobile: true, hasTouch: true, locale: 'ru-RU', timezoneId: 'Europe/Moscow', reducedMotion: 'reduce' });
    try { await exerciseScreens(await context.newPage(), info, viewport, records, true); }
    finally { await context.close(); }
  }
  await info.attach('webkit-layouts', { body: JSON.stringify(records, null, 2), contentType: 'application/json' });
});

test('Two hundred percent text keeps all screens and essential actions usable', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'Desktop Chrome', 'Run text-resize matrix once');
  test.setTimeout(180000);
  const records = [];
  for (const viewport of [{ width: 320, height: 568, touch: true }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ baseURL, viewport: { width: viewport.width, height: viewport.height }, isMobile: !!viewport.touch, hasTouch: !!viewport.touch, reducedMotion: 'reduce', locale: 'ru-RU', timezoneId: 'Europe/Moscow' });
    try { await exerciseScreens(await context.newPage(), info, viewport, records, true, true); }
    finally { await context.close(); }
  }
  await info.attach('text-resize', { body: JSON.stringify(records, null, 2), contentType: 'application/json' });
});

test('Focused inputs and actions remain reachable in a reduced-height phone viewport', async ({ page }, info) => {
  test.skip(info.project.name !== 'Mobile Chrome 390' && info.project.name !== 'iPhone WebKit', 'Check one touch Chromium and one WebKit context');
  await page.goto('/'); await page.locator('#startPlan').click(); await page.locator('#nextStep').click();
  await fillProfile(page, 0); await page.locator('#nameOne').focus();
  await page.setViewportSize({ width: 390, height: 300 });
  await expect(page.locator('#nameOne')).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('keyboard-open'))).toBe(true);
  await expectNoOverflow(page); await expectClickableCenter(page.locator('#nextStep'));
  await page.locator('#nextStep').click(); await expect(page.locator('.flow-step[data-step="3"]')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('keyboard-open'))).toBe(false);
  await fillProfile(page, 1); await page.locator('#nextStep').click();
  await expectClickableCenter(page.locator('#generatePlan'));
});

test('Keyboard skip link keeps the current step, and reduced motion removes view animation', async ({ page }, info) => {
  test.skip(info.project.name !== 'Desktop Chrome' && info.project.name !== 'Desktop Firefox', 'Keyboard checks run in desktop Chromium and Gecko');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await page.waitForFunction(() => sessionReady);
  await page.keyboard.press('Tab'); await expect(page.locator('.skip')).toBeFocused();
  await page.locator('#startPlan').click(); await page.locator('#budgetAmount').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.flow-step[data-step="2"]')).toBeVisible();
  const previousHash = new URL(page.url()).hash;
  await page.locator('.skip').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#planner')).toBeVisible(); expect(new URL(page.url()).hash).toBe(previousHash);
  const insideMain = await page.evaluate(() => document.getElementById('main').contains(document.activeElement));
  expect(insideMain).toBe(true);
  const focused = [];
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => document.activeElement.id);
    focused.push(id); if (id === 'nameOne') break;
  }
  expect(focused).toContain('nameOne');
  await fillProfile(page, 0); await page.locator('#nameOne').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.flow-step[data-step="3"]')).toBeVisible();
  await fillProfile(page, 1); await page.locator('#nameTwo').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.flow-step[data-step="4"]')).toBeVisible(); await expect(page.locator('#route')).toBeHidden();
  const styles = await page.locator('#planner').evaluate(element => ({ duration: getComputedStyle(element).animationDuration, name: getComputedStyle(element).animationName }));
  expect(styles.name === 'none' || styles.duration === '0s').toBe(true);
});
