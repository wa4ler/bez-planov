const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const { future, isolateLocalClient, expectNoOverflow, expectClickableCenter } = require('./browser-helpers.cjs');

const nav = (page, name) => page.locator(`[data-nav="${name}"]:visible`).first();

async function completePeople(page) {
  for (const [person, name] of ['Алекс', 'Саша'].entries()) {
    await page.locator(person ? '#nameTwo' : '#nameOne').fill(name);
    for (const pref of ['food', 'walk']) await page.locator(`[data-act="rating"][data-person="${person}"][data-pref="${pref}"][data-rating="2"]`).click();
    await page.locator('#nextStep').click();
  }
}

async function createRoute(page) {
  await page.goto('/'); await page.locator('#startPlan').click();
  await page.locator('#dateStart').fill(future(10)); await page.locator('#dateEnd').fill(future(11));
  await page.locator('#budgetAmount').fill('20000'); await page.locator('#nextStep').click();
  await completePeople(page); await page.locator('#generatePlan').click();
  await expect(page.locator('#route')).toBeVisible();
}

test.beforeEach(async ({ page, context, baseURL }) => {
  await isolateLocalClient(context, baseURL);
  page.clientErrors = []; page.on('pageerror', error => page.clientErrors.push(error.message));
});
test.afterEach(async ({ page }) => expect(page.clientErrors, 'No uncaught browser errors').toEqual([]));

test('Navigation, searchable moods and independent taste choices lead into a clear four-step questionnaire', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => sessionReady);
  await expect(page.locator('#homeIdeas .idea-card')).toHaveCount(4);
  await expectClickableCenter(nav(page, 'ideas')); await nav(page, 'ideas').click();
  await expect(page.locator('#ideas')).toBeVisible();
  await expect(page.locator('#ideasGrid .idea-card:visible')).toHaveCount(8);
  await page.locator('#ideaFilters [data-filter="culture"]').click();
  await expect(page.locator('#ideasGrid .idea-card:visible')).toHaveCount(3);
  await page.locator('#ideaSearch').fill('планетарий');
  await expect(page.locator('#ideasGrid .idea-card:visible')).toHaveCount(1);
  await page.locator('#ideaSearch').fill('такого настроения здесь нет');
  await expect(page.locator('#ideasEmpty')).toBeVisible();
  await page.locator('#ideaSearch').fill('');
  await page.locator('#ideasGrid [data-idea="stars"]').click();
  await expect(page.locator('.flow-step[data-step="1"]')).toBeVisible();
  await expect(page.locator('#themeBadge')).toContainText('Чуть ближе к звёздам');
  expect(await page.evaluate(() => draft.profiles.map(person => person.ratings))).toEqual([{}, {}]);
  await page.locator('#nextStep').click();
  const liked = page.locator('[data-act="rating"][data-person="0"][data-pref="food"][data-rating="2"]');
  const excluded = page.locator('[data-act="rating"][data-person="0"][data-pref="food"][data-rating="-3"]');
  await liked.click(); await expect(liked).toHaveAttribute('aria-pressed', 'true');
  await liked.click(); await expect(liked).toHaveAttribute('aria-pressed', 'false');
  await excluded.click(); await expect(excluded).toHaveAttribute('aria-pressed', 'true');
  await liked.click(); await expect(liked).toHaveAttribute('aria-pressed', 'true'); await expect(excluded).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => draft.profiles[1].ratings)).toEqual({});
  await page.locator('#nameOne').fill('Алекс'); await page.locator('#nextStep').click();
  await expect(page.locator('.flow-step[data-step="3"]')).toBeVisible();
  await expectNoOverflow(page);
  // The route tab starts the questionnaire before a route has been made.
  await page.locator('#accountOpen').click(); await nav(page, 'route').click();
  await expect(page.locator('.flow-step[data-step="1"]')).toBeVisible();
});

test('Numbered map, list, zoom and return buttons remain linked to the actual day cards', async ({ page }) => {
  await createRoute(page);
  const map = page.locator('#routeMap');
  await expect(map.locator('.bp-map-notice')).toContainText('приблизительным');
  const pin = map.locator('.bp-map-pin').first();
  await expect(pin).toBeVisible();
  const index = Number(await pin.getAttribute('data-bp-map-stop'));
  const card = page.locator('#timeline .stop').nth(index);
  await pin.click();
  await expect(card).toBeFocused(); await expect(card).toHaveClass(/bp-map-card-selected/);
  await card.locator('[data-bp-map-return]').click(); await expect(pin).toBeFocused();
  await expect.poll(() => pin.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
    const hit = document.elementFromPoint(x, y);
    return y > 0 && y < innerHeight && (element === hit || element.contains(hit));
  }), { message: 'Returning from a card must bring its selected map point into the visible viewport' }).toBe(true);
  await map.locator('[data-bp-map-zoom="in"]').click();
  await expect(map.locator('.route-map')).not.toHaveAttribute('viewBox', '0.0 0.0 800.0 430.0');
  await map.locator('[data-bp-map-zoom="reset"]').click();
  await expect(map.locator('.route-map')).toHaveAttribute('viewBox', '0.0 0.0 800.0 430.0');
  await map.locator('[data-bp-map-mode="list"]').click();
  await expect(map.locator('.bp-map-stop-list')).toBeVisible();
  await expect(map.locator('.bp-map-stop-list > li')).toHaveCount(await page.locator('#timeline .stop').count());
  await map.locator('.bp-map-stop-list button').last().click();
  await expect(page.locator('#timeline .stop').last()).toBeFocused();
  await page.locator('#routeDay').selectOption({ index: 1 });
  const currentNames = await page.locator('#timeline .stop .stop-card h3').allTextContents();
  const allMapText = await map.locator('.bp-map-stop-list').textContent();
  for (const name of currentNames) expect(allMapText).toContain(name);
  await nav(page, 'ideas').click(); await nav(page, 'route').click();
  await expect(page.locator('#route')).toBeVisible(); await expectNoOverflow(page);
});

test('Favorite places survive reload and can become a concrete wish in the next questionnaire', async ({ page }) => {
  await createRoute(page);
  const favorite = page.locator('#timeline [data-act="favorite"]').first();
  const id = await favorite.getAttribute('data-place');
  const placeName = await page.evaluate(id => PLACES[id].name, id);
  await favorite.click(); await page.locator('#accountOpen').click();
  await expect(page.locator('#favoritePlaces .favorite-place')).toHaveCount(1);
  await expect(page.locator('#favoritePlaces')).toContainText(placeName);
  await page.reload(); await expect(page.locator('#favoritePlaces')).toContainText(placeName);
  await page.locator('#favoritePlaces [data-act="wish-place"]').click();
  await expect(page.locator('.flow-step[data-step="1"]')).toBeVisible();
  expect(await page.evaluate(() => draft.dreamPlaces)).toContain(placeName);
  for (let i = 0; i < 3; i++) await page.locator('#nextStep').click();
  await expect(page.locator('#dreamPlaces')).toHaveValue(placeName);
  await page.locator('#accountOpen').click();
  await page.locator('#favoritePlaces [data-act="favorite"]').click();
  await expect(page.locator('#favoritePlaces .favorite-place')).toHaveCount(0);
  await page.reload(); await expect(page.locator('#favoritePlaces .favorite-place')).toHaveCount(0);
});

test('Unavailable browser storage does not claim that a new favorite was saved', async ({ page }) => {
  await createRoute(page);
  const favorite = page.locator('#timeline [data-act="favorite"]').first();
  const id = await favorite.getAttribute('data-place');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === 'bezPlanovWorkspaceV1') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await favorite.click();
  await expect(page.locator('#toast')).toContainText('Не удалось сохранить');
  await expect(page.locator(`#timeline [data-act="favorite"][data-place="${id}"]`)).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(id => workspace.favorites.includes(id), id)).toBe(false);
});

test('An event outside changed dates can be included or removed directly at the blocking first step', async ({ page }) => {
  await page.goto('/'); await page.locator('#startPlan').click();
  await page.locator('#dateStart').fill(future(10)); await page.locator('#dateEnd').fill(future(12));
  await page.locator('#nextStep').click(); await completePeople(page);
  await page.locator('#bookingsDetails > summary').click();
  await page.locator('#eventName').fill('Оплаченный концерт'); await page.locator('#eventDate').fill(future(10));
  await page.locator('#eventTime').fill('18:00'); await page.locator('#eventPaid').check(); await page.locator('#addEvent').click();
  for (let i = 0; i < 3; i++) await page.locator('#prevStep').click();
  await page.locator('#dateStart').fill(future(11));
  await expect(page.locator('#dateConflict')).toContainText('Оплаченный концерт');
  await page.locator('#dateConflict [data-act="include-events"]').click();
  await expect(page.locator('#dateStart')).toHaveValue(future(10)); await expect(page.locator('#dateConflict')).toBeHidden();
  await page.locator('#dateStart').fill(future(11));
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('Бронь и оплата'); await dialog.dismiss(); });
  await page.locator('#dateConflict [data-act="remove-event"]').click(); await expect(page.locator('#dateConflict')).toBeVisible();
  page.once('dialog', dialog => dialog.accept()); await page.locator('#dateConflict [data-act="remove-event"]').click();
  await expect(page.locator('#dateConflict')).toBeHidden();
  await page.locator('#nextStep').click(); await expect(page.locator('.flow-step[data-step="2"]')).toBeVisible();
  expect(await page.evaluate(() => draft.events)).toEqual([]);
});

test('A failed provider availability request can recover without pretending the providers are unconfigured', async ({ page }) => {
  let failed = true;
  await page.route('**/api/auth/config', route => failed ? route.abort('failed') : route.fulfill({ json: { providers: { yandex: true, mailru: true, vk: true } } }));
  await page.goto('/'); await page.locator('#accountOpen').click();
  await expect(page.locator('#authStatus')).toContainText('Не удалось проверить');
  await expect(page.locator('#retryAuth')).toBeVisible();
  await expect(page.locator('#loginVk')).toHaveAttribute('aria-disabled', 'true');
  failed = false; await page.locator('#retryAuth').click();
  await expect(page.locator('#retryAuth')).toBeHidden();
  for (const id of ['loginVk', 'loginYandex', 'loginMailru']) await expect(page.locator('#' + id)).toHaveAttribute('aria-disabled', 'false');
});

test('Expired login retains private edits for the same account without leaking them to a guest or another account', async ({ page, context }, info) => {
  test.skip(!!process.env.BASE_URL, 'Private recovery uses local OAuth fixtures only');
  const subject = 'expired-v2-' + info.project.name + '-' + Date.now();
  const loginURL = '/__test/login?' + new URLSearchParams({ provider: 'yandex', subject, email: 'pair@yandex.ru' });
  await page.goto(loginURL); await expect(page.locator('#accountMember')).toBeVisible();
  const accountID = await page.evaluate(() => user.id);
  await page.route('**/api/state', route => route.fulfill({ status: 401, json: { message: 'Session expired' } }));
  await page.locator('#editPreferences').click(); await page.locator('#nameOne').fill('Личные несохранённые правки');
  await expect(page.locator('#syncNotice [data-act="relogin"]')).toBeVisible();
  await page.locator('#syncNotice [data-act="relogin"]').click();
  await expect(page.locator('#accountGuest')).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(workspace))).not.toContain('Личные несохранённые правки');
  expect(await page.evaluate(id => sessionStorage.getItem('bezPlanovPendingV1:' + id), accountID)).toContain('Личные несохранённые правки');
  await page.unroute('**/api/state');
  await page.goto('/__test/login?' + new URLSearchParams({ provider: 'yandex', subject: subject + '-other', email: 'other@yandex.ru' }));
  await expect(page.locator('#accountMember')).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(workspace))).not.toContain('Личные несохранённые правки');
  await expect(page.locator('#syncNotice')).toBeHidden(); await page.locator('#logout').click();
  await page.goto(loginURL); await expect(page.locator('#accountMember')).toBeVisible();
  await expect(page.locator('#syncNotice')).toContainText('несинхронизированные правки');
  expect(await page.evaluate(() => draft.profiles[0].name)).toBe('Личные несохранённые правки');
  const downloadPromise = page.waitForEvent('download'); await page.locator('#syncNotice [data-act="load-conflict"]').click();
  const downloaded = await downloadPromise;
  const backup = JSON.parse(await fs.readFile(await downloaded.path(), 'utf8'));
  expect(backup.workspace.draft.profiles[0].name).toBe('Личные несохранённые правки');
  await expect(page.locator('#syncNotice')).toBeHidden();
  expect(await page.evaluate(id => sessionStorage.getItem('bezPlanovPendingV1:' + id), accountID)).toBeNull();
  expect((await (await context.request.get('/api/session')).json()).user.id).toBe(accountID);
});

test('Expired login downloads an unsaved locked route when its active-route recovery storage is full', async ({ page }, info) => {
  test.skip(!!process.env.BASE_URL, 'Expiry and storage faults use local fixtures only');
  await page.goto('/__test/login?' + new URLSearchParams({ provider: 'yandex', subject: 'active-quota-' + info.project.name + '-' + Date.now(), email: 'quota@yandex.ru' }));
  await expect(page.locator('#accountMember')).toBeVisible();
  await createRoute(page);
  await expect.poll(() => page.evaluate(() => !dirty && !saving)).toBe(true);
  const stop = page.locator('#timeline .stop.place').first();
  const stopID = await stop.getAttribute('data-stop-id');
  await stop.locator('[data-act="lock"]').click();
  const planID = await page.evaluate(() => plan.id);
  expect(await page.evaluate(() => workspace.plans.some(saved => saved.id === plan.id))).toBe(false);
  await page.route('**/api/session', route => route.fulfill({ json: { user: null } }));
  await page.evaluate(() => refreshSession());
  await expect(page.locator('#syncNotice [data-act="relogin"]')).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === sessionStorage && key.startsWith('bezPlanovActiveV1:')) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#syncNotice [data-act="relogin"]').click();
  const download = await downloadPromise;
  const backup = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  expect(backup.activePlan.id).toBe(planID);
  expect(backup.activePlan.days[0].stops.find(item => item.id === stopID).locked).toBe(true);
  await expect(page.locator('#accountGuest')).toBeVisible();
  await expect(page.locator('#toast')).toContainText('скачана');
  expect(await page.evaluate(() => plan)).toBeNull();
});
