// Shared helpers for the API routes (files starting with "_" are not routes on Vercel).
import crypto from 'node:crypto';

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const str = (v, max = 300) => (typeof v === 'string' ? v.slice(0, max).trim() : '');

export function normPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = '6' + d;           // Malaysia local 01x… -> 601x…
  return d;
}

// ---- Redis (Upstash via Vercel Marketplace). Works with either env var pair. ----
function redisConf() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}
export const hasRedis = () => !!redisConf();

export async function redis(commands) {
  const c = redisConf();
  if (!c) throw new Error('Redis not configured');
  const res = await fetch(c.url + '/pipeline', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + c.token, 'content-type': 'application/json' },
    body: JSON.stringify(commands)
  });
  if (!res.ok) throw new Error('Redis HTTP ' + res.status);
  const out = await res.json();
  return out.map((r) => { if (r.error) throw new Error(r.error); return r.result; });
}

// ---- CRM password check (env CRM_PASSWORD) ----
export function authed(request) {
  const pw = process.env.CRM_PASSWORD;
  if (!pw) return false;
  const got = Buffer.from(String(request.headers.get('x-crm-key') || ''));
  const want = Buffer.from(pw);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// ---- Meta Conversions API ----
export async function sendCapi(event) {
  const pixel = process.env.META_PIXEL_ID, token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token) return { skipped: 'meta not configured' };
  const ver = process.env.META_API_VERSION || 'v23.0';
  const body = { data: [event] };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;
  const res = await fetch(`https://graph.facebook.com/${ver}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) console.error('Meta CAPI error', res.status, JSON.stringify(out));
  return { ok: res.ok };
}
