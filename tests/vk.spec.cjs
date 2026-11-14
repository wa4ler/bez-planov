const { test, expect } = require('@playwright/test');
const { isolateLocalClient, expectNoOverflow, expectClickableCenter } = require('./browser-helpers.cjs');

test('VK login is honestly disabled until configured and the guest planner remains available', async ({ page }) => {
  await page.route('**/api/auth/config', route => route.fulfill({ json: { configured: false, providers: { yandex: false, mailru: false, vk: false } } }));
  await page.route('**/api/session', route => route.fulfill({ json: { configured: false, user: null, state: { draft: null, plans: [], favorites: [] }, revision: 0 } }));
  await page.goto('/'); await page.locator('#accountOpen').click();
  await expect(page.locator('#loginVk')).toHaveAttribute('href', '/api/auth/vk');
  await expect(page.locator('#loginVk')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#accountGuest')).toBeVisible(); await expect(page.locator('#accountMember')).toBeHidden();
  await expectNoOverflow(page); await page.locator('#continueGuest').click();
  await expect(page.locator('#planner')).toBeVisible();
});

test('VK ID without email opens one shared pair account, synchronizes preferences and logs out safely', async ({ page, context, browser, baseURL }, info) => {
  test.skip(!!process.env.BASE_URL, 'VK fixture login must never run against a deployed provider');
  await isolateLocalClient(context, baseURL);
  const subject = 'vk-ui-' + info.project.name + '-' + Date.now();
  const name = 'Александра Константин';
  const identity = Buffer.from(JSON.stringify({ subject, email: '', name })).toString('base64url');
  await context.addCookies([{ name: 'bp_test_identity', value: identity, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
  await page.goto('/'); await page.locator('#accountOpen').click();
  await expect(page.locator('#loginVk')).toHaveAttribute('aria-disabled', 'false');
  await expectClickableCenter(page.locator('#loginVk')); await page.locator('#loginVk').click();
  await expect(page.locator('#accountMember')).toBeVisible();
  await expect(page.locator('#accountEmail')).toHaveText(name);
  await expectNoOverflow(page);
  const first = await (await context.request.get('/api/session')).json();
  expect(first.user).toMatchObject({ provider: 'vk', email: '', name });
  expect(first.user).not.toHaveProperty('access_token');
  expect(first).not.toHaveProperty('access_token');
  const sessionCookie = (await context.cookies()).find(cookie => /bp_session$/.test(cookie.name));
  expect(sessionCookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });

  const otherDevice = await browser.newContext({ baseURL });
  try {
    await isolateLocalClient(otherDevice, baseURL);
    const response = await otherDevice.request.get('/__test/login?' + new URLSearchParams({ provider: 'vk', subject, email: '', name }));
    expect(response.status()).toBe(200);
    const second = await (await otherDevice.request.get('/api/session')).json();
    expect(second.user.id).toBe(first.user.id);
    await page.locator('#editPreferences').click();
    await page.locator('#nameOne').fill('Первый в паре'); await page.locator('#nameTwo').fill('Второй в паре');
    await expect.poll(async () => (await (await otherDevice.request.get('/api/session')).json()).state.draft?.profiles?.map(person => person.name)).toEqual(['Первый в паре', 'Второй в паре']);
    await page.locator('#accountOpen').click(); await page.locator('#logout').click();
    await expect(page.locator('#accountGuest')).toBeVisible();
    expect((await (await context.request.get('/api/session')).json()).user).toBeNull();
    expect((await (await otherDevice.request.get('/api/session')).json()).user.id).toBe(first.user.id);
  } finally { await otherDevice.close(); }
});
