// Booking form submit (book.html) -> Meta Conversions API "Schedule" event.
// The browser Pixel sends the same event with the same event_id, so Meta counts it once.
// Env vars (Vercel → Project → Settings → Environment Variables):
//   META_PIXEL_ID          required
//   META_CAPI_TOKEN        required  (Events Manager → Settings → Conversions API → Generate access token)
//   META_TEST_EVENT_CODE   optional  (only while testing in Events Manager → Test events; remove after)
//   META_API_VERSION       optional  (default v23.0)
import crypto from 'node:crypto';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const str = (v, max = 300) => (typeof v === 'string' ? v.slice(0, max).trim() : '');

export function normPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = '6' + d;           // Malaysia local 01x… -> 601x…
  return d;
}

export function buildEvent(body, headers, now = Date.now()) {
  const name = str(body.name).toLowerCase();
  const [fn, ...rest] = name.split(/\s+/);
  const ln = rest.join(' ');
  const phone = normPhone(str(body.phone, 40));
  const ip = String(headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const ua = str(headers.get('user-agent') || '', 400);

  const user_data = { country: [sha256('my')] };
  if (phone) { user_data.ph = [sha256(phone)]; user_data.external_id = [sha256(phone)]; }
  if (fn) user_data.fn = [sha256(fn)];
  if (ln) user_data.ln = [sha256(ln)];
  if (str(body.fbp)) user_data.fbp = str(body.fbp);
  if (str(body.fbc)) user_data.fbc = str(body.fbc);
  if (ip) user_data.client_ip_address = ip;
  if (ua) user_data.client_user_agent = ua;

  return {
    event_name: 'Schedule',
    event_time: Math.floor(now / 1000),
    event_id: str(body.event_id, 64),
    action_source: 'website',
    event_source_url: str(body.source_url, 300) || undefined,
    user_data,
    custom_data: {
      content_name: 'Free Zoom',
      content_category: str(body.industry, 60) || undefined,
      appointment_start: str(body.start, 40) || undefined
    }
  };
}

export async function POST(request) {
  let body;
  try { body = JSON.parse(await request.text()); } catch { return new Response('bad json', { status: 400 }); }
  if (!/^bk_[a-z0-9]{6,30}$/i.test(str(body.event_id, 64))) return new Response('bad event', { status: 400 });

  const pixel = process.env.META_PIXEL_ID, token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token) {
    console.error('META_PIXEL_ID / META_CAPI_TOKEN not set');
    return Response.json({ ok: false, error: 'meta not configured' });
  }

  const ver = process.env.META_API_VERSION || 'v23.0';
  const data = { data: [buildEvent(body, request.headers)] };
  if (process.env.META_TEST_EVENT_CODE) data.test_event_code = process.env.META_TEST_EVENT_CODE;

  try {
    const res = await fetch(`https://graph.facebook.com/${ver}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data)
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) console.error('Meta CAPI error', res.status, JSON.stringify(out));
    return Response.json({ ok: res.ok });
  } catch (err) {
    console.error('Meta CAPI fetch failed', err);
    return Response.json({ ok: false });
  }
}

export function GET() {
  return Response.json({ ok: true, service: 'booking → Meta CAPI' });
}
