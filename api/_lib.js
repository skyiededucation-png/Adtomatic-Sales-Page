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
