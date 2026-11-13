// Cloudflare Pages Functions. Provider tokens never leave this server module.
const EMPTY_STATE = () => ({ draft: null, plans: [], favorites: [] });
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const FLOW_SECONDS = 600;
const MAX_BYTES = 1024 * 1024;
const encoder = new TextEncoder();
const PROVIDERS = {
  yandex: { authorize: 'https://oauth.yandex.ru/authorize', token: 'https://oauth.yandex.ru/token', info: 'https://login.yandex.ru/info?format=json', prefix: 'YANDEX', scope: 'login:info login:email', pkce: true },
  mailru: { authorize: 'https://oauth.mail.ru/login', token: 'https://oauth.mail.ru/token', info: 'https://oauth.mail.ru/userinfo', prefix: 'MAILRU', scope: 'userinfo', pkce: false }
};

class APIError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra } });
}
function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers });
}
function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function randomToken(bytes = 32) { return base64url(crypto.getRandomValues(new Uint8Array(bytes))); }
async function hash(value) { return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0; for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function isLoopback(url) { return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname); }
function appOrigin(env, request) {
  let configured;
  try { configured = new URL(env.APP_ORIGIN); } catch { throw new APIError(503, 'account_not_configured'); }
  const current = new URL(request.url);
  if (configured.origin !== env.APP_ORIGIN || configured.username || configured.password || configured.search || configured.hash || configured.pathname !== '/') throw new APIError(503, 'account_not_configured');
  if (configured.protocol !== 'https:' && !(isLoopback(configured) && configured.protocol === 'http:')) throw new APIError(503, 'account_not_configured');
  if (current.origin !== configured.origin) throw new APIError(403, 'wrong_origin');
  return configured.origin;
}
function configuredProviders(env, request) {
  let baseReady = false;
  try { baseReady = !!env.DB && !!appOrigin(env, request); } catch { /* Render disabled login without exposing deployment details. */ }
  return Object.fromEntries(Object.entries(PROVIDERS).map(([name, p]) => [name, baseReady && !!env[p.prefix + '_CLIENT_ID'] && !!env[p.prefix + '_CLIENT_SECRET']]));
}
function cookiesFrom(request) {
  return Object.fromEntries((request.headers.get('Cookie') || '').split(';').map(s => { const i = s.indexOf('='); return i < 0 ? [] : [s.slice(0, i).trim(), s.slice(i + 1)]; }).filter(x => x.length === 2));
}
function sessionName(request) { return new URL(request.url).protocol === 'https:' ? '__Host-bp_session' : 'bp_session'; }
function flowName(request) { return new URL(request.url).protocol === 'https:' ? '__Host-bp_oauth' : 'bp_oauth'; }
function cookie(request, name, value, maxAge, path = '/') {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}
function csrf(request, origin) {
  if (request.headers.get('Origin') !== origin) throw new APIError(403, 'csrf');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) throw new APIError(403, 'csrf');
}
async function rateLimit(env, name, maximum, seconds) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare('INSERT INTO rate_limits(bucket,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN expires_at<=? THEN 1 ELSE hits+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING hits').bind(name, now + seconds, now, now).first();
  if (row.hits > maximum) throw new APIError(429, 'too_many_requests');
}
async function currentSession(request, env) {
  const token = cookiesFrom(request)[sessionName(request)];
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return env.DB.prepare('SELECT accounts.id,accounts.email,accounts.provider FROM sessions JOIN accounts ON accounts.id=sessions.account_id WHERE sessions.token_hash=? AND sessions.expires_at>?').bind(await hash(token), Math.floor(Date.now() / 1000)).first();
}
async function stateFor(env, accountID) {
  const row = await env.DB.prepare('SELECT data_json,revision FROM pair_state WHERE account_id=?').bind(accountID).first();
  return row ? { state: JSON.parse(row.data_json), revision: row.revision } : { state: EMPTY_STATE(), revision: 0 };
}
async function readJSON(request) {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) throw new APIError(415, 'json_required');
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BYTES) throw new APIError(413, 'state_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new APIError(400, 'invalid_json');
  let total = 0; const chunks = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > MAX_BYTES) { await reader.cancel(); throw new APIError(413, 'state_too_large'); } chunks.push(value); }
  const bytes = new Uint8Array(total); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new APIError(400, 'invalid_json'); }
}
function validState(state) {
  const record = x => x && typeof x === 'object' && !Array.isArray(x);
  if (!record(state) || Object.keys(state).some(k => !['draft', 'plans', 'favorites'].includes(k))) return false;
  if (state.draft !== null && !record(state.draft)) return false;
  if (!Array.isArray(state.plans) || state.plans.length > 40 || !Array.isArray(state.favorites) || state.favorites.length > 150) return false;
  if (state.favorites.some(x => typeof x !== 'string' || x.length > 150)) return false;
  const ids = new Set();
  for (const plan of state.plans) {
    if (!record(plan) || typeof plan.id !== 'string' || plan.id.length > 150 || ids.has(plan.id) || !record(plan.config) || !Array.isArray(plan.days) || plan.days.length > 31) return false;
    ids.add(plan.id);
    if (plan.days.some(d => !record(d) || typeof d.date !== 'string' || !Array.isArray(d.stops) || d.stops.length > 40)) return false;
  }
  // Avoid prototype-shaped input being passed into future migration/merge code.
  const stack = [{ value: state, depth: 0 }];
  while (stack.length) {
    const { value, depth } = stack.pop(); if (depth > 35) return false;
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) return false;
      if (child && typeof child === 'object') stack.push({ value: child, depth: depth + 1 });
    }
  }
  return true;
}
async function providerIdentity(providerName, code, verifier, redirectURI, env, fetcher) {
  const p = PROVIDERS[providerName];
  const form = new URLSearchParams({ grant_type: 'authorization_code', code, client_id: env[p.prefix + '_CLIENT_ID'], client_secret: env[p.prefix + '_CLIENT_SECRET'], redirect_uri: redirectURI });
  if (p.pkce) form.set('code_verifier', verifier);
  const response = await fetcher(p.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: form.toString(), signal: AbortSignal.timeout(12000), redirect: 'error' });
  if (!response.ok) throw new APIError(502, 'provider_unavailable');
  const result = await response.json();
  if (typeof result.access_token !== 'string' || !result.access_token || result.access_token.length > 8192) throw new APIError(502, 'provider_unavailable');
  // Mail documents the token as a userinfo request parameter; use POST body to keep it out of URLs/logs.
  const infoRequest = providerName === 'mailru'
    ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ access_token: result.access_token }).toString() }
    : { headers: { Authorization: 'OAuth ' + result.access_token, Accept: 'application/json' } };
  const userResponse = await fetcher(p.info, { ...infoRequest, signal: AbortSignal.timeout(12000), redirect: 'error' });
  if (!userResponse.ok) throw new APIError(502, 'provider_unavailable');
  const info = await userResponse.json();
  const email = String(providerName === 'yandex' ? info.default_email || '' : info.email || '').trim().toLowerCase();
  const suppliedSubject = providerName === 'yandex' ? info.id : info.sub ?? info.id;
  // Do not round long provider IDs through JavaScript numbers: that could join two people.
  const subject = typeof suppliedSubject === 'string' ? suppliedSubject
    : Number.isSafeInteger(suppliedSubject) && suppliedSubject >= 0 ? String(suppliedSubject)
    : suppliedSubject == null && providerName === 'mailru' ? email : '';
  if (!subject || subject.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || info.error) throw new APIError(502, 'provider_profile_unavailable');
  return { subject, email };
}
async function startOAuth(request, env, name, origin) {
  if (!configuredProviders(env, request)[name]) throw new APIError(503, 'provider_not_configured');
  const ipHash = await hash(request.headers.get('CF-Connecting-IP') || 'unknown');
  await rateLimit(env, 'oauth:' + ipHash, 30, 600);
  const state = randomToken(), verifier = randomToken(48), now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM oauth_flows WHERE expires_at<=?').bind(now),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now),
    env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<=?').bind(now),
    env.DB.prepare('INSERT INTO oauth_flows(state_hash,provider,verifier,expires_at) VALUES(?,?,?,?)').bind(await hash(state), name, verifier, now + FLOW_SECONDS)
  ]);
  const p = PROVIDERS[name], target = new URL(p.authorize);
  target.search = new URLSearchParams({ client_id: env[p.prefix + '_CLIENT_ID'], response_type: 'code', redirect_uri: origin + '/api/auth/callback/' + name, scope: p.scope, state }).toString();
  if (p.pkce) { target.searchParams.set('code_challenge', await hash(verifier)); target.searchParams.set('code_challenge_method', 'S256'); }
  return redirect(target.href, [cookie(request, flowName(request), state, FLOW_SECONDS)]);
}
async function callbackOAuth(request, env, name, origin, fetcher) {
  const clearFlow = cookie(request, flowName(request), '', 0);
  const failure = () => redirect(origin + '/?auth=error#account', [clearFlow]);
  try {
    if (!configuredProviders(env, request)[name]) return failure();
    const url = new URL(request.url), state = url.searchParams.get('state'), code = url.searchParams.get('code');
    if (!state || !safeEqual(state, cookiesFrom(request)[flowName(request)]) || !/^[A-Za-z0-9_-]{43}$/.test(state)) return failure();
    // DELETE RETURNING makes state one-use even if two callbacks race.
    const flow = await env.DB.prepare('DELETE FROM oauth_flows WHERE state_hash=? AND provider=? AND expires_at>? RETURNING verifier').bind(await hash(state), name, Math.floor(Date.now() / 1000)).first();
    if (!flow || url.searchParams.has('error') || !code || code.length > 4096) return failure();
    const identity = await providerIdentity(name, code, flow.verifier, origin + '/api/auth/callback/' + name, env, fetcher);
    const now = Math.floor(Date.now() / 1000), freshID = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO accounts(id,provider,subject,email,created_at) VALUES(?,?,?,?,?) ON CONFLICT(provider,subject) DO UPDATE SET email=excluded.email').bind(freshID, name, identity.subject, identity.email, now).run();
    const user = await env.DB.prepare('SELECT id FROM accounts WHERE provider=? AND subject=?').bind(name, identity.subject).first();
    const session = randomToken();
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO pair_state(account_id,data_json,revision,updated_at) VALUES(?,?,0,?)').bind(user.id, JSON.stringify(EMPTY_STATE()), now),
      env.DB.prepare('INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)').bind(await hash(session), user.id, now + SESSION_SECONDS)
    ]);
    // Token and refresh_token are intentionally discarded after profile verification.
    return redirect(origin + '/?auth=success#account', [clearFlow, cookie(request, sessionName(request), session, SESSION_SECONDS)]);
  } catch {
    // Do not log provider responses, authorization codes or token-bearing request objects.
    return failure();
  }
}

export async function handleAPI(request, env, options = {}) {
  const url = new URL(request.url), path = url.pathname.replace(/\/$/, '');
  const providers = configuredProviders(env, request), configured = Object.values(providers).some(Boolean);
  if (path === '/api/auth/config' && request.method === 'GET') return json({ configured, providers });
  if (path === '/api/session' && request.method === 'GET' && (!env.DB || !configured)) return json({ configured: false, user: null, state: EMPTY_STATE(), revision: 0 });
  try {
    if (!env.DB) throw new APIError(503, 'account_not_configured');
    const origin = appOrigin(env, request);
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) csrf(request, origin);
    const start = path.match(/^\/api\/auth\/(yandex|mailru)$/);
    if (start && request.method === 'GET') return await startOAuth(request, env, start[1], origin);
    const callback = path.match(/^\/api\/auth\/callback\/(yandex|mailru)$/);
    if (callback && request.method === 'GET') return await callbackOAuth(request, env, callback[1], origin, options.fetcher || fetch);
    const user = await currentSession(request, env);
    if (path === '/api/session' && request.method === 'GET') return json({ configured, user, ...(user ? await stateFor(env, user.id) : { state: EMPTY_STATE(), revision: 0 }) });
    if ((path === '/api/logout' || path === '/api/logout-all') && request.method === 'POST') {
      // Signing out must also work after a session expires or was revoked elsewhere.
      if (user && path === '/api/logout-all') await env.DB.prepare('DELETE FROM sessions WHERE account_id=?').bind(user.id).run();
      else if (user) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(cookiesFrom(request)[sessionName(request)])).run();
      const response = json({ ok: true }); response.headers.append('Set-Cookie', cookie(request, sessionName(request), '', 0)); return response;
    }
    if (!user) throw new APIError(401, 'sign_in_required');
    if (path === '/api/state' && request.method === 'PUT') {
      await rateLimit(env, 'write:' + user.id, 120, 60);
      const body = await readJSON(request);
      if (!body || !Number.isInteger(body.revision) || body.revision < 0 || !validState(body.state)) throw new APIError(400, 'invalid_state');
      const encoded = JSON.stringify(body.state);
      const row = await env.DB.prepare('UPDATE pair_state SET data_json=?,revision=revision+1,updated_at=? WHERE account_id=? AND revision=? RETURNING revision').bind(encoded, Math.floor(Date.now() / 1000), user.id, body.revision).first();
      if (!row) return json({ error: 'conflict', ...(await stateFor(env, user.id)) }, 409);
      return json({ state: body.state, revision: row.revision });
    }
    return json({ error: 'not_found' }, 404);
  } catch (error) {
    if (error instanceof APIError) return json({ error: error.code }, error.status, error.status === 429 ? { 'Retry-After': '60' } : {});
    return json({ error: 'account_unavailable' }, 503);
  }
}

export function onRequest(context) { return handleAPI(context.request, context.env); }
