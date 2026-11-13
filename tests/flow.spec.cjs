const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const { future, expectNoOverflow, expectClickableCenter, isolateLocalClient } = require('./browser-helpers.cjs');

async function begin(page, { from = future(10), to = from, budget = '16000', scope = 'daily' } = {}) {
  await page.goto('/');
  await expect(page.locator('#home')).toBeVisible();
  await expectNoOverflow(page);
  await page.locator('#startPlan').click();
  await page.locator('#dateStart').fill(from);
  await page.locator('#dateEnd').fill(to);
  await page.locator('#budgetAmount').fill(budget);
  await page.locator('#budgetScope').selectOption(scope);
  await expectClickableCenter(page.locator('#nextStep'));
  await page.locator('#nextStep').click();
  await expect(page.locator('.flow-step[data-step="2"]')).toBeVisible();
}

async function people(page) {
  await page.locator('#nameOne').fill('Алекс');
  await page.locator('#nameTwo').fill('Саша');
  for (const id of ['tasteOne', 'tasteTwo']) {
    await page.locator('#' + id + ' button').nth(0).click();
    await page.locator('#' + id + ' button').nth(1).click();
  }
  await expectNoOverflow(page);
  await expectClickableCenter(page.locator('#nextStep'));
  await page.locator('#nextStep').click();
  await expect(page.locator('.flow-step[data-step="3"]')).toBeVisible();
}

async function event(page, { date = future(10), cost = '3000', paid = true } = {}) {
  await page.locator('#bookingsDetails > summary').click();
  await page.locator('#eventName').fill('Наш оплаченный театр');
  await page.locator('#eventDate').fill(date);
  await page.locator('#eventTime').fill('18:00');
  await page.locator('#eventDuration').selectOption('90');
  await page.locator('#eventCost').fill(cost);
  if (paid) await page.locator('#eventPaid').check();
  await page.locator('#addEvent').click();
  await expect(page.locator('#eventList')).toContainText('Наш оплаченный театр');
}

async function generate(page) {
  await expectNoOverflow(page);
  await expectClickableCenter(page.locator('#generatePlan'));
  await page.locator('#generatePlan').click();
  await expect(page.locator('#route')).toBeVisible();
  await expectNoOverflow(page);
}

test.beforeEach(async ({ page, context, baseURL }) => {
  await isolateLocalClient(context, baseURL);
  page.clientErrors = [];
  page.on('pageerror', error => page.clientErrors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(page.clientErrors, 'No browser JavaScript exceptions').toEqual([]);
});

test('Three clear steps create a multi-day plan, preserve a paid event and export a Moscow calendar', async ({ page }, info) => {
  const from = future(10), middle = future(11), to = future(12);
  await begin(page, { from, to, budget: '30000', scope: 'total' });
  await people(page);
  await event(page, { date: middle });
  await generate(page);
  await expect(page.locator('#routeDay option')).toHaveCount(3);
  await page.locator('#routeDay').selectOption({ index: 1 });
  await expect(page.locator('#timeline')).toContainText('Наш оплаченный театр');
  await expect(page.locator('#timeline')).toContainText('18:00');
  await page.locator('#rebuildDay').click();
  await expect(page.locator('#timeline')).toContainText('Наш оплаченный театр');
  await expect(page.locator('#timeline')).toContainText('18:00');
  await page.locator('.more-menu > summary').click();
  const downloaded = page.waitForEvent('download');
  await page.locator('#exportCalendar').click();
  const download = await downloaded;
  const calendar = await fs.readFile(await download.path(), 'utf8');
  expect(calendar).toContain('BEGIN:VCALENDAR');
  expect(calendar).toContain('Наш оплаченный театр');
  for (const day of [from, middle, to]) expect(calendar).toContain(day.replace(/-/g, ''));
  expect(calendar).toContain(middle.replace(/-/g, '') + 'T150000Z');
  expect(calendar.trim()).toMatch(/END:VCALENDAR$/);
  await page.locator('#savePlan').click();
  await page.locator('#accountOpen').click();
  await expect(page.locator('#account')).toBeVisible();
  await expect(page.locator('#savedPlans')).not.toContainText('Пока нет');
  await expectNoOverflow(page);
  await page.reload();
  await expect(page.locator('#account')).toBeVisible();
  await expect(page.locator('#savedPlans')).not.toContainText('Пока нет');
  await page.screenshot({ path: `test-results/account-${info.project.name.replace(/\W/g, '-')}.png`, fullPage: true, animations: 'disabled' });
});

test('Total budget can cover a larger fixed cost on one day without forcing equal day limits', async ({ page }) => {
  await begin(page, { from: future(10), to: future(11), budget: '5000', scope: 'total' });
  await people(page);
  await event(page, { paid: false });
  await generate(page);
  await expect(page.locator('#timeline')).toContainText('Наш оплаченный театр');
  await expect(page.locator('#routeSummary')).toContainText('5');
});

test('Changing dates retains paid events and explains the conflict instead of silently deleting them', async ({ page }) => {
  await begin(page, { from: future(10), to: future(12) });
  await people(page);
  await event(page);
  await page.locator('#prevStep').click();
  await page.locator('#prevStep').click();
  await page.locator('#dateStart').fill(future(11));
  await expect(page.locator('#dateConflict')).toBeVisible();
  await expect(page.locator('#dateConflict')).toContainText(/событ|закреп|билет/i);
  await page.locator('#nextStep').click();
  await expect(page.locator('.flow-step[data-step="1"]')).toBeVisible();
  await page.locator('#dateStart').fill(future(10));
  await page.locator('#nextStep').click();
  await page.locator('#nextStep').click();
  if (!(await page.locator('#bookingsDetails').evaluate(element => element.open))) await page.locator('#bookingsDetails > summary').click();
  await expect(page.locator('#eventList')).toContainText('Наш оплаченный театр');
});

test('The two partners answer independently and invalid dates cannot skip the first step', async ({ page }) => {
  await page.goto('/');
  await page.locator('#startPlan').click();
  await page.locator('#dateStart').fill(future(10));
  await page.locator('#dateEnd').fill(future(41));
  await page.locator('#nextStep').click();
  await expect(page.locator('.flow-step[data-step="1"]')).toBeVisible();
  await expect(page.locator('#wizardError')).not.toBeEmpty();
  await page.locator('#dateEnd').fill(future(10));
  await page.locator('#nextStep').click();
  await page.locator('#tasteOne button').nth(0).click();
  await page.locator('#tasteOne button').nth(1).click();
  await page.locator('#nextStep').click();
  await expect(page.locator('.flow-step[data-step="2"]')).toBeVisible();
  await expect(page.locator('#wizardError')).not.toBeEmpty();
  await page.locator('#tasteTwo button').nth(0).click();
  await page.locator('#tasteTwo button').nth(1).click();
  await page.locator('#nextStep').click();
  await expect(page.locator('.flow-step[data-step="3"]')).toBeVisible();
});

test('Unavailable OAuth is explained honestly and the guest route remains usable', async ({ page }) => {
  await page.route('**/api/auth/config', route => route.fulfill({ json: { configured: false, providers: { yandex: false, mailru: false } } }));
  await page.route('**/api/session', route => route.fulfill({ json: { configured: false, user: null, state: { draft: null, plans: [], favorites: [] }, revision: 0 } }));
  await page.goto('/');
  await page.locator('#accountOpen').click();
  await expect(page.locator('#accountGuest')).toBeVisible();
  await expect(page.locator('#accountMember')).toBeHidden();
  await expect(page.locator('#loginYandex')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#loginMailru')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#authStatus')).not.toContainText('Проверяем');
  await expectNoOverflow(page);
  await page.locator('#continueGuest').click();
  await expect(page.locator('#planner')).toBeVisible();
});

test('Stop locks, replacement, undo, the original version and a separate copy survive saving', async ({ page }) => {
  await begin(page);
  await people(page);
  await generate(page);
  const initial = await page.evaluate(() => structuredClone(plan.initialDays));
  const firstPlace = page.locator('#timeline .stop.place').first();
  const lockedID = await firstPlace.getAttribute('data-stop-id');
  const lockedTime = await firstPlace.locator('.stop-time').textContent();
  await firstPlace.locator('[data-act="lock"]').click();
  await expect(page.locator('#timeline .stop[data-stop-id="' + lockedID + '"] [data-act="swap-menu"]')).toBeDisabled();
  await page.locator('#rebuildDay').click();
  const preserved = page.locator('#timeline .stop[data-stop-id="' + lockedID + '"]');
  await expect(preserved).toBeVisible();
  await expect(preserved.locator('.stop-time')).toHaveText(lockedTime);
  await preserved.locator('[data-act="lock"]').click();

  let replaced = false;
  const indexes = await page.locator('[data-act="swap-menu"]').evaluateAll(elements => elements.map(element => element.dataset.index));
  for (const index of indexes) {
    await page.locator('[data-act="swap-menu"][data-index="' + index + '"]').click();
    if (await page.locator('[data-act="swap"]').count()) {
      await page.locator('[data-act="swap"]').first().click();
      replaced = true;
      break;
    }
  }
  expect(replaced, 'The seeded broad preferences should provide at least one valid alternative').toBe(true);
  const changed = await page.evaluate(() => structuredClone(plan.days));
  expect(changed).not.toEqual(initial);
  await page.locator('#savePlan').click();
  await page.reload();
  await expect(page.locator('#route')).toBeVisible();
  await page.locator('.more-menu > summary').click();
  await expect(page.locator('#restoreOriginal')).toBeEnabled();
  await page.locator('#restoreOriginal').click();
  expect(await page.evaluate(() => plan.days)).toEqual(initial);
  await page.locator('#undoPlan').click();
  expect(await page.evaluate(() => plan.days)).toEqual(changed);
  const id = await page.evaluate(() => plan.id);
  await page.locator('#saveCopy').click();
  expect(await page.evaluate(() => plan.id)).not.toBe(id);
  await page.locator('#accountOpen').click();
  await expect(page.locator('#savedPlans .saved-plan')).toHaveCount(2);
  await page.locator('[data-act="open-plan"]').first().click();
  await expect(page.locator('#route')).toBeVisible();
  await expectNoOverflow(page);
});

test('Legacy browser routes migrate without erasing their source and the account can delete a saved copy', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const cfg = buildDefault();
    const date = new Date(); date.setDate(date.getDate() + 20);
    cfg.from = cfg.to = localISO(date); cfg.goals = ['talk'];
    cfg.profiles[0].ratings = { food: 2, walk: 2 }; cfg.profiles[1].ratings = { food: 2, walk: 2 };
    const old = generateItinerary(cfg, {}); old.id = 'legacy-route-fixture';
    localStorage.removeItem('bezPlanovWorkspaceV1');
    localStorage.setItem('bezPlanovPlansV4', JSON.stringify([old]));
    localStorage.setItem('bezPlanovDraftV4', JSON.stringify(cfg));
  });
  await page.reload();
  await page.locator('#accountOpen').click();
  await expect(page.locator('#savedPlans .saved-plan')).toHaveCount(1);
  await page.locator('[data-act="open-plan"]').click();
  await expect(page.locator('#route')).toBeVisible();
  await page.locator('#accountOpen').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-act="delete-plan"]').click();
  await expect(page.locator('#savedPlans .saved-plan')).toHaveCount(0);
  const oldRemains = await page.evaluate(() => JSON.parse(localStorage.getItem('bezPlanovPlansV4')).some(item => item.id === 'legacy-route-fixture'));
  expect(oldRemains).toBe(true);
});

test('Provider buttons complete a local OAuth fixture, and guest plans move only with explicit import', async ({ page, context, baseURL }, info) => {
  test.skip(!!process.env.BASE_URL, 'Local simulated OAuth must never run against production');
  await begin(page);
  await people(page);
  await generate(page);
  await page.locator('#savePlan').click();
  const identity = Buffer.from(JSON.stringify({ subject: 'ui-' + info.project.name + '-' + Date.now(), email: 'shared-pair@mail.ru' })).toString('base64url');
  await context.addCookies([{ name: 'bp_test_identity', value: identity, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
  await page.locator('#accountOpen').click();
  await expect(page.locator('#loginMailru')).toHaveAttribute('aria-disabled', 'false');
  await page.locator('#loginMailru').click();
  await expect(page.locator('#accountMember')).toBeVisible();
  await expect(page.locator('#accountEmail')).toHaveText('shared-pair@mail.ru');
  await expect(page.locator('#savedPlans .saved-plan')).toHaveCount(0);
  await expect(page.locator('#guestImport')).toBeVisible();
  await page.locator('#importGuest').click();
  await expect(page.locator('#savedPlans .saved-plan')).toHaveCount(1);
  await expect.poll(async () => (await (await context.request.get('/api/session')).json()).state.plans.length).toBe(1);
  await page.locator('#editPreferences').click();
  await expect(page.locator('.flow-step[data-step="2"]')).toBeVisible();
  await page.locator('#nameOne').fill('Имя первого');
  await page.locator('#nameTwo').fill('Имя второго');
  await expect.poll(async () => (await (await context.request.get('/api/session')).json()).state.draft?.profiles?.map(person => person.name)).toEqual(['Имя первого', 'Имя второго']);
  await page.locator('#accountOpen').click();
  await page.locator('#logout').click();
  await expect(page.locator('#accountGuest')).toBeVisible();
  await expect(page.locator('#accountMember')).toBeHidden();
  expect((await (await context.request.get('/api/session')).json()).user).toBeNull();
  await expect(page.locator('#savedPlans .saved-plan')).toHaveCount(1);
});
