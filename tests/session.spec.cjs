const { test, expect } = require('@playwright/test');

test('Separate devices share one pair account, detect conflicts, and keep other pairs isolated', async ({ browser, baseURL }, info) => {
  test.skip(!!process.env.BASE_URL, 'Local OAuth fixtures must never be used against a deployed website');
  const first = await browser.newContext({ baseURL });
  const second = await browser.newContext({ baseURL });
  const otherPair = await browser.newContext({ baseURL });
  const subject = 'pair-' + info.project.name.replace(/\W/g, '') + '-' + Date.now();
  const mutateHeaders = { Origin: new URL(baseURL).origin, 'Sec-Fetch-Site': 'same-origin' };
  try {
    for (const context of [first, second]) {
      const response = await context.request.get('/__test/login?provider=yandex&subject=' + encodeURIComponent(subject) + '&email=pair%40yandex.ru');
      expect(response.ok()).toBe(true);
    }
    await otherPair.request.get('/__test/login?provider=mailru&subject=' + encodeURIComponent(subject + '-other') + '&email=other%40mail.ru');
    const a = await (await first.request.get('/api/session')).json();
    const b = await (await second.request.get('/api/session')).json();
    const other = await (await otherPair.request.get('/api/session')).json();
    expect(a.user.email).toBe('pair@yandex.ru');
    expect(b.user.id).toBe(a.user.id);
    expect(other.user.id).not.toBe(a.user.id);
    expect(other.user.provider).toBe('mailru');
    const sessionCookie = (await first.cookies()).find(cookie => /bp_session$/.test(cookie.name));
    expect(sessionCookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
    expect(a).not.toHaveProperty('access_token');
    expect(a.user).not.toHaveProperty('token');

    const state = { draft: { profiles: [{ name: 'Алекс' }, { name: 'Саша' }] }, plans: [], favorites: [] };
    const write = await first.request.put('/api/state', { data: { state, revision: a.revision }, headers: mutateHeaders });
    expect(write.status()).toBe(200);
    const updated = await write.json();
    expect(updated.revision).toBe(a.revision + 1);
    const seenOnSecond = await (await second.request.get('/api/session')).json();
    expect(seenOnSecond.state.draft.profiles).toEqual(state.draft.profiles);
    const conflict = await second.request.put('/api/state', { data: { state: { ...state, draft: { name: 'stale overwrite' } }, revision: b.revision }, headers: mutateHeaders });
    expect(conflict.status()).toBe(409);
    const latest = await conflict.json();
    expect(latest.state).toEqual(state);
    expect(latest.revision).toBe(updated.revision);
    expect((await (await otherPair.request.get('/api/session')).json()).state.draft).toBeNull();
    const csrf = await first.request.put('/api/state', { data: { state, revision: updated.revision }, headers: { Origin: 'https://unrelated.example' } });
    expect(csrf.status()).toBe(403);

    expect((await first.request.post('/api/logout', { headers: mutateHeaders })).status()).toBe(200);
    expect((await (await first.request.get('/api/session')).json()).user).toBeNull();
    expect((await (await second.request.get('/api/session')).json()).user.id).toBe(a.user.id);
    expect((await second.request.post('/api/logout-all', { headers: mutateHeaders })).status()).toBe(200);
    expect((await (await second.request.get('/api/session')).json()).user).toBeNull();
    expect((await (await otherPair.request.get('/api/session')).json()).user.id).toBe(other.user.id);
  } finally {
    await Promise.all([first.close(), second.close(), otherPair.close()]);
  }
});
