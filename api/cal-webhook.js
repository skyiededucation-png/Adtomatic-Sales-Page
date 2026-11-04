// Cal.com webhook (BOOKING_CREATED) -> Meta Conversions API "Schedule" event.
// Env vars (Vercel → Project → Settings → Environment Variables):
//   META_PIXEL_ID          required
//   META_CAPI_TOKEN        required  (Events Manager → Settings → Conversions API → Generate access token)
//   CAL_WEBHOOK_SECRET     recommended (same secret you type in the Cal.com webhook)
//   META_TEST_EVENT_CODE   optional  (only while testing in Events Manager → Test events; remove after)
//   META_API_VERSION       optional  (default v23.0)
import crypto from 'node:crypto';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const val = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v);

function normPhone(raw) {
  if (!raw) return '';
  let d = String(raw).replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = '6' + d;           // Malaysia local 01x… -> 601x…
  return d;
}

function findPhone(payload) {
  const r = payload.responses || {};
  let p = val(r.attendeePhoneNumber);
  if (!p) {
    for (const k of Object.keys(r)) {
      if (/phone|whatsapp|wa|电话|手机/i.test(k) || /phone|whatsapp|电话|手机/i.test((r[k] && r[k].label) || '')) {
        const v = val(r[k]);
        if (v && /\d{6,}/.test(String(v).replace(/\D/g, ''))) { p = v; break; }
      }
    }
  }
  const a = (payload.attendees || [])[0] || {};
  return p || a.phoneNumber || '';
}

function verify(raw, header, secret) {
  if (!secret) return true;                     // not configured -> skip (set it in production)
  if (!header) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(header));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function buildEvent(payload, now = Date.now()) {
  const a = (payload.attendees || [])[0] || {};
  const r = payload.responses || {};
  const md = payload.metadata || {};
  const email = String(a.email || val(r.email) || '').trim().toLowerCase();
  const name = String(a.name || val(r.name) || '').trim().toLowerCase();
  const [fn, ...rest] = name.split(/\s+/);
  const ln = rest.join(' ');
  const phone = normPhone(findPhone(payload));

  const user_data = { country: [sha256('my')] };
  if (email) { user_data.em = [sha256(email)]; user_data.external_id = [sha256(email)]; }
  if (phone) user_data.ph = [sha256(phone)];
  if (fn) user_data.fn = [sha256(fn)];
  if (ln) user_data.ln = [sha256(ln)];
  if (md.fbp) user_data.fbp = String(md.fbp);
  if (md.fbc) user_data.fbc = String(md.fbc);
  if (md.ua) user_data.client_user_agent = String(md.ua);

  return {
    event_name: 'Schedule',
    event_time: Math.floor(now / 1000),
    event_id: 'cal_' + payload.uid,              // same id the browser pixel uses -> Meta de-duplicates
    // Meta requires a user agent for "website" events; without it, send as system_generated.
    action_source: user_data.client_user_agent ? 'website' : 'system_generated',
    event_source_url: md.source_url || undefined,
    user_data,
    custom_data: { content_name: 'Free Zoom', appointment_start: payload.startTime || undefined }
  };
}

export async function POST(request) {
  const raw = await request.text();
  if (!verify(raw, request.headers.get('x-cal-signature-256'), process.env.CAL_WEBHOOK_SECRET)) {
    return new Response('bad signature', { status: 401 });
  }
  let body;
  try { body = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }

  if (body.triggerEvent !== 'BOOKING_CREATED') {
    return Response.json({ ok: true, skipped: body.triggerEvent || 'unknown' });   // PING etc.
  }
  const payload = body.payload || {};
  if (!payload.uid) return Response.json({ ok: false, error: 'no uid' });

  const pixel = process.env.META_PIXEL_ID, token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token) {
    console.error('META_PIXEL_ID / META_CAPI_TOKEN not set');
    return Response.json({ ok: false, error: 'meta not configured' });
  }

  const ver = process.env.META_API_VERSION || 'v23.0';
  const data = { data: [buildEvent(payload)] };
  if (process.env.META_TEST_EVENT_CODE) data.test_event_code = process.env.META_TEST_EVENT_CODE;

  try {
    const res = await fetch(`https://graph.facebook.com/${ver}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data)
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) console.error('Meta CAPI error', res.status, JSON.stringify(out));
    // Always 200 so Cal.com doesn't retry forever; check Vercel logs if Meta rejected it.
    return Response.json({ ok: res.ok, meta: out });
  } catch (err) {
    console.error('Meta CAPI fetch failed', err);
    return Response.json({ ok: false, error: 'fetch failed' });
  }
}

export function GET() {
  return Response.json({ ok: true, service: 'cal-webhook → Meta CAPI' });
}
