import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LocalD1, createDevServer } from '../scripts/dev-server.mjs';
import { handleAPI } from '../functions/api/[[path]].js';

const origin = 'https://bez-planov.pages.dev';
async function fixture() {
  const DB = new LocalD1();
  await DB.exec(await readFile(new URL('../migrations/0001_accounts.sql', import.meta.url), 'utf8'));
  const env = { DB, APP_ORIGIN: origin, YANDEX_CLIENT_ID: 'test-client', YANDEX_CLIENT_SECRET: 'test-secret', MAILRU_CLIENT_ID: 'test-mail-client', MAILRU_CLIENT_SECRET: 'test-mail-secret' };
  const req = (route, { method = 'GET', cookie = '', body, headers = {} } = {}) => new Request(origin + route, { method, headers: { ...(method !== 'GET' ? { Origin: origin } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const call = (route, opts) => handleAPI(req(route, opts), env);
  async function login({ provider = 'yandex', subject = 'person-a', email = 'pair@yandex.ru', exchangeFailure = false, profile } = {}) {
    const start = await call('/api/auth/' + provider);
    assert.equal(start.status, 303);
    const location = new URL(start.headers.get('Location')), state = location.searchParams.get('state');
    const flowCookie = start.headers.getSetCookie()[0].split(';')[0];
    const callback = req(`/api/auth/callback/${provider}?code=valid-code&state=${state}`, { cookie: flowCookie });
    let calls = 0;
    const response = await handleAPI(callback, env, { fetcher: async (url, init) => {
      calls++;
      if (url.endsWith('/token')) {
        const form = new URLSearchParams(init.body);
        assert.equal(form.get('grant_type'), 'authorization_code');
        assert.equal(form.get('redirect_uri'), origin + '/api/auth/callback/' + provider);
        if (provider === 'yandex') { assert.ok(form.get('code_verifier')); assert.equal(location.searchParams.get('code_challenge_method'), 'S256'); }
        return exchangeFailure ? Response.json({ error: 'private-provider-details' }, { status: 500 }) : Response.json({ access_token: 'private-test-token', refresh_token: 'private-refresh-token' });
      }
      if (provider === 'yandex') assert.equal(init.headers.Authorization, 'OAuth private-test-token');
      else { assert.equal(init.method, 'POST'); assert.equal(new URLSearchParams(init.body).get('access_token'), 'private-test-token'); assert.ok(!url.includes('private-test-token')); }
      return Response.json(profile ?? { id: subject, sub: subject, default_email: email, email });
    } });
    const sessionCookie = response.headers.getSetCookie().find(x => x.startsWith('__Host-bp_session='))?.split(';')[0];
    return { response, cookie: sessionCookie, callback, calls, start, state, flowCookie };
  }
  return { DB, env, req, call, login };
}
const validState = (title = 'pair') => ({ draft: { profiles: [{ name: title }, { name: 'Partner' }] }, plans: [{ id: 'p1', config: {}, days: [{ date: '2026-12-01', stops: [] }] }], favorites: ['red-square'] });

test('unconfigured deployment renders honest disabled providers and cannot start login', async () => {
  const request = new Request(origin + '/api/auth/config');
  const config = await (await handleAPI(request, {})).json();
  assert.deepEqual(config, { configured: false, providers: { yandex: false, mailru: false } });
  const session = await (await handleAPI(new Request(origin + '/api/session'), {})).json();
  assert.equal(session.configured, false); assert.equal(session.user, null);
  assert.equal((await handleAPI(new Request(origin + '/api/auth/yandex'), {})).status, 503);
});

test('Yandex code flow uses PKCE, HttpOnly secure session and stores only hashed token', async t => {
  const f = await fixture(); t.after(() => f.DB.close());
  const login = await f.login();
  assert.equal(login.calls, 2); assert.equal(login.response.status, 303);
  assert.equal(login.response.headers.get('Location'), origin + '/?auth=success#account');
  assert.ok(login.response.headers.getSetCookie().some(c => c.includes('HttpOnly') && c.includes('Secure') && c.includes('SameSite=Lax') && c.startsWith('__Host-bp_session=')));
  const session = await (await f.call('/api/session', { cookie: login.cookie })).json();
  assert.equal(session.user.email, 'pair@yandex.ru'); assert.equal(session.user.provider, 'yandex'); assert.equal(session.revision, 0);
  const stored = await f.DB.prepare('SELECT token_hash FROM sessions').first();
  assert.notEqual(stored.token_hash, login.cookie.split('=')[1]);
  assert.ok(!JSON.stringify(session).includes('private-test-token'));
});

test('OAuth state is browser-bound, consumed once and cannot be replayed', async t => {
  const f = await fixture(); t.after(() => f.DB.close());
  const login = await f.login();
  const replay = await handleAPI(login.callback, f.env, { fetcher: () => { throw new Error('must not exchange replay'); } });
  assert.equal(replay.headers.get('Location'), origin + '/?auth=error#account');
  const forged = await f.call('/api/auth/callback/yandex?code=anything&state=' + login.state);
  assert.equal(forged.headers.get('Location'), origin + '/?auth=error#account');
  assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM sessions').first()).n, 1);
});

test('OAuth start allows thirty attempts per IP, then throttles without blocking another IP', async t => {
  const f = await fixture(); t.after(() => f.DB.close());
  const states = new Set();
  for (let i = 0; i < 30; i++) {
    const response = await f.call('/api/auth/yandex', { headers: { 'CF-Connecting-IP': '192.0.2.10' } });
    assert.equal(response.status, 303);
    states.add(new URL(response.headers.get('Location')).searchParams.get('state'));
  }
  assert.equal(states.size, 30);
  const blocked = await f.call('/api/auth/yandex', { headers: { 'CF-Connecting-IP': '192.0.2.10' } });
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), { error: 'too_many_requests' });
  assert.ok(Number(blocked.headers.get('Retry-After')) > 0);
  const separateIP = await f.call('/api/auth/yandex', { headers: { 'CF-Connecting-IP': '192.0.2.11' } });
  assert.equal(separateIP.status, 303);
});

test('provider failure returns generic redirect without leaking secrets', async t => {
  const f = await fixture(); t.after(() => f.DB.close());
  const result = await f.login({ exchangeFailure: true });
  assert.equal(result.cookie, undefined);
  assert.equal(result.response.headers.get('Location'), origin + '/?auth=error#account');
  assert.ok(!(await result.response.text()).includes('private-provider-details'));
});

test('same provider identity opens the same pair on two devices', async t => {
  const f = await fixture(); t.after(() => f.DB.close());
  const first = await f.login(), second = await f.login();
  const saved = await f.call('/api/state', { method: 'PUT', cookie: first.cookie, body: { state: validState(), revision: 0 } });
  assert.equal(saved.status, 200);
  const deviceTwo = await (await f.call('/api/session', { cookie: second.cookie })).json();
  assert.deepEqual(deviceTwo.state, validState()); assert.equal(deviceTwo.revision, 1);
  assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM accounts').first()).n, 1);
});

test('CAS conflict preserves the partner change instead of overwriting it', async t => {
  const f = await fixture(); t.after(() => f.DB.close()); const login = await f.login();
  await f.call('/api/state', { method: 'PUT', cookie: login.cookie, body: { state: validState('first'), revision: 0 } });
  const stale = await f.call('/api/state', { method: 'PUT', cookie: login.cookie, body: { state: validState('stale'), revision: 0 } });
  assert.equal(stale.status, 409); const payload = await stale.json();
  assert.equal(payload.error, 'conflict'); assert.equal(payload.revision, 1); assert.equal(payload.state.draft.profiles[0].name, 'first');
});

test('different identities and providers remain isolated even with matching emails', async t => {
  const f = await fixture(); t.after(() => f.DB.close());
  const owner = await f.login(), other = await f.login({ subject: 'person-b' }), mail = await f.login({ provider: 'mailru' });
  await f.call('/api/state', { method: 'PUT', cookie: owner.cookie, body: { state: validState(), revision: 0 } });
  for (const login of [other, mail]) {
    const data = await (await f.call('/api/session', { cookie: login.cookie })).json();
    assert.deepEqual(data.state, { draft: null, plans: [], favorites: [] });
  }
  assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM accounts').first()).n, 3);
});

test('provider IDs cannot be rounded into a shared identity; email-only Mail stays provider-qualified', async t => {
  const f = await fixture(); t.after(() => f.DB.close());
  const unsafe = await f.login({ provider: 'mailru', profile: { id: Number.MAX_SAFE_INTEGER + 1, email: 'pair@mail.ru' } });
  assert.equal(unsafe.cookie, undefined);
  assert.equal(unsafe.response.headers.get('Location'), origin + '/?auth=error#account');
  const mail = await f.login({ provider: 'mailru', profile: { email: 'pair@mail.ru' } });
  assert.ok(mail.cookie);
  const account = await f.DB.prepare('SELECT provider,subject FROM accounts').first();
  assert.deepEqual(account, { provider: 'mailru', subject: 'pair@mail.ru' });
});

test('write requests require same origin, proper content type and valid bounded state', async t => {
  const f = await fixture(); t.after(() => f.DB.close()); const login = await f.login();
  const body = { state: validState(), revision: 0 };
  assert.equal((await f.call('/api/state', { method: 'PUT', cookie: login.cookie, body, headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await f.call('/api/state', { method: 'PUT', cookie: login.cookie, body, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await f.call('/api/state', { method: 'PUT', cookie: login.cookie, body: { state: {}, revision: 0 } })).status, 400);
  assert.equal((await f.call('/api/state', { method: 'PUT', cookie: login.cookie, body: { state: validState(), revision: -1 } })).status, 400);
  const dangerous = JSON.parse('{"draft":{"__proto__":{"polluted":true}},"plans":[],"favorites":[]}');
  assert.equal((await f.call('/api/state', { method: 'PUT', cookie: login.cookie, body: { state: dangerous, revision: 0 } })).status, 400);
  const tooBig = { ...validState(), draft: { text: 'x'.repeat(1024 * 1024) } };
  assert.equal((await f.call('/api/state', { method: 'PUT', cookie: login.cookie, body: { state: tooBig, revision: 0 } })).status, 413);
});

test('expired session and logout revoke authenticated reads; logout-all revokes second device', async t => {
  const f = await fixture(); t.after(() => f.DB.close());
  const one = await f.login(), two = await f.login();
  const logout = await f.call('/api/logout', { method: 'POST', cookie: one.cookie }); assert.equal(logout.status, 200);
  assert.equal((await (await f.call('/api/session', { cookie: one.cookie })).json()).user, null);
  assert.ok((await (await f.call('/api/session', { cookie: two.cookie })).json()).user);
  const three = await f.login();
  await f.call('/api/logout-all', { method: 'POST', cookie: two.cookie });
  assert.equal((await (await f.call('/api/session', { cookie: three.cookie })).json()).user, null);
  const expired = await f.login(); await f.DB.prepare('UPDATE sessions SET expires_at=0').run();
  assert.equal((await (await f.call('/api/session', { cookie: expired.cookie })).json()).user, null);
  assert.equal((await f.call('/api/state', { method: 'PUT', cookie: expired.cookie, body: { state: validState(), revision: 0 } })).status, 401);
  const logoutExpired = await f.call('/api/logout', { method: 'POST', cookie: expired.cookie });
  assert.equal(logoutExpired.status, 200);
  assert.ok(logoutExpired.headers.getSetCookie().some(c => c.includes('Max-Age=0')));
  assert.equal((await f.call('/api/logout', { method: 'POST' })).status, 200);
});

test('production handlers have no fixture endpoint and reject unexpected callback host', async t => {
  const f = await fixture(); t.after(() => f.DB.close());
  const fake = await f.call('/api/__test/login'); assert.equal(fake.status, 401);
  const malicious = await handleAPI(new Request('https://evil.example/api/auth/yandex'), f.env); assert.equal(malicious.status, 403);
});

test('local HTTP test server executes real state/session flow and disables fixtures by default', async t => {
  const app = await createDevServer({ port: 0, testMode: true }); t.after(() => app.close());
  const jar = new Map(); let next = app.url + '/__test/login?subject=browser-pair&email=pair@mail.ru&provider=mailru';
  for (let i = 0; i < 5; i++) {
    const response = await fetch(next, { redirect: 'manual', headers: { Cookie: [...jar].map(([k, v]) => k + '=' + v).join('; ') } });
    for (const header of response.headers.getSetCookie()) { const [name, value] = header.split(';')[0].split('='); jar.set(name, value); }
    if (response.status !== 303) break;
    next = new URL(response.headers.get('Location'), app.url).href;
  }
  const session = await (await fetch(app.url + '/api/session', { headers: { Cookie: [...jar].map(([k, v]) => k + '=' + v).join('; ') } })).json();
  assert.equal(session.user.email, 'pair@mail.ru'); assert.equal(session.user.provider, 'mailru');
  const normal = await createDevServer({ port: 0 }); t.after(() => normal.close());
  assert.equal((await fetch(normal.url + '/__test/login')).status, 404);
});
