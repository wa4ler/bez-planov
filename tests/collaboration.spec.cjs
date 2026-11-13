const { test, expect } = require('@playwright/test');

async function login(page, info) {
  const subject = 'race-' + info.project.name + '-' + info.title + '-' + Date.now();
  await page.route('**/api/auth/yandex', route => route.continue({ headers: { ...route.request().headers(), 'CF-Connecting-IP': 'local-' + Buffer.from(subject).toString('hex').slice(-80) } }));
  await page.goto('/__test/login?provider=yandex&subject=' + encodeURIComponent(subject) + '&email=shared%40yandex.ru');
  await expect(page.locator('#accountMember')).toBeVisible();
}

async function session(context) { return (await context.request.get('/api/session')).json(); }
async function putState(context, baseURL, state, revision) {
  const response = await context.request.put('/api/state', { data: { state, revision }, headers: { Origin: new URL(baseURL).origin, 'Sec-Fetch-Site': 'same-origin' } });
  expect(response.status()).toBe(200);
  return response.json();
}

test.beforeEach(async ({}, info) => {
  test.skip(!!process.env.BASE_URL, 'Delayed collaboration regressions require isolated local OAuth fixtures');
});

test('A delayed refresh cannot replace a draft typed while the request is in flight', async ({ page, context, baseURL }, info) => {
  await login(page, info);
  await page.locator('#editPreferences').click();
  await page.locator('#nameOne').fill('Исходное имя');
  await expect.poll(async () => (await session(context)).state.draft?.profiles?.[0]?.name).toBe('Исходное имя');
  await expect.poll(() => page.evaluate(() => !dirty && !saving)).toBe(true);
  const remote = await session(context);
  remote.state.draft.profiles[0].name = 'Изменение партнёра';
  await putState(context, baseURL, remote.state, remote.revision);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let held = false;
  await page.route('**/api/session', async route => {
    const response = await route.fetch(); held = true; await gate; await route.fulfill({ response });
  });
  await page.evaluate(() => { window.refreshUnderTest = refreshSession(); });
  await expect.poll(() => held).toBe(true);
  await page.locator('#nameOne').fill('Моя новая правка');
  release();
  await page.evaluate(() => window.refreshUnderTest);
  await expect(page.locator('#nameOne')).toHaveValue('Моя новая правка');
  expect(await page.evaluate(() => draft.profiles[0].name)).toBe('Моя новая правка');
  await page.unroute('**/api/session');
});

test('A delayed account response after logout cannot expose the former pair in the guest workspace', async ({ page, context, baseURL }, info) => {
  await login(page, info);
  const remote = await session(context);
  remote.state.draft = { profiles: [{ name: 'Private account name' }, { name: 'Private partner' }] };
  await putState(context, baseURL, remote.state, remote.revision);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let held = false;
  await page.route('**/api/session', async route => {
    const response = await route.fetch(); held = true; await gate; await route.fulfill({ response });
  });
  await page.evaluate(() => { window.refreshUnderTest = refreshSession(); });
  await expect.poll(() => held).toBe(true);
  await page.locator('#logout').click();
  await expect(page.locator('#accountGuest')).toBeVisible();
  release();
  await page.evaluate(() => window.refreshUnderTest);
  await expect(page.locator('#accountGuest')).toBeVisible();
  await expect(page.locator('#accountMember')).toBeHidden();
  expect(await page.evaluate(() => JSON.stringify(workspace))).not.toContain('Private account name');
  expect(await page.evaluate(() => user)).toBeNull();
  await page.unroute('**/api/session');
});

test('Refreshing a partner change preserves local route edits as a separate copy', async ({ page, context, baseURL }, info) => {
  await login(page, info);
  const seeded = await page.evaluate(() => {
    const cfg = buildDefault();
    const date = new Date(); date.setDate(date.getDate() + 15);
    cfg.from = cfg.to = localISO(date); cfg.goals = ['talk'];
    cfg.profiles[0].ratings = { food: 2, walk: 2 }; cfg.profiles[1].ratings = { food: 2, walk: 2 };
    const result = generateItinerary(cfg, {}); result.initialDays = structuredClone(result.days); result.versions = [];
    return { draft: cfg, plans: [result], favorites: [] };
  });
  const before = await session(context);
  await putState(context, baseURL, seeded, before.revision);
  await page.reload();
  await expect(page.locator('#accountMember')).toBeVisible();
  await page.locator('[data-act="open-plan"]').click();
  const originalID = await page.evaluate(() => plan.id);
  const place = page.locator('#timeline .stop.place').first();
  const lockedID = await place.getAttribute('data-stop-id');
  await place.locator('[data-act="lock"]').click();
  const remote = await session(context);
  remote.state.plans[0].config.profiles[0].name = 'Правка партнёра';
  remote.state.draft.profiles[0].name = 'Правка партнёра';
  await putState(context, baseURL, remote.state, remote.revision);
  await page.evaluate(() => refreshSession());
  const localID = await page.evaluate(() => plan.id);
  expect(localID).not.toBe(originalID);
  expect(await page.evaluate(lockedID => plan.days[0].stops.find(stop => stop.id === lockedID).locked, lockedID)).toBe(true);
  await page.locator('#savePlan').click();
  await expect.poll(async () => (await session(context)).state.plans.length).toBe(2);
  const state = (await session(context)).state;
  const partnerVersion = state.plans.find(plan => plan.id === originalID);
  expect(partnerVersion.config.profiles[0].name).toBe('Правка партнёра');
  expect(partnerVersion.days[0].stops.find(stop => stop.id === lockedID).locked).not.toBe(true);
  const localVersion = state.plans.find(plan => plan.id === localID);
  expect(localVersion.days[0].stops.find(stop => stop.id === lockedID).locked).toBe(true);
});
