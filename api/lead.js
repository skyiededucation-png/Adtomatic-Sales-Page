// Booking form submit (book.html):
//   1. saves the lead into our own CRM (crm.html)
//   2. sends a Meta Conversions API "Schedule" event (same event_id as the browser Pixel)
//   Storage: Vercel Blob private store connected to the project (see api/_store.js)
// Env vars: META_PIXEL_ID, META_CAPI_TOKEN, optional META_TEST_EVENT_CODE / META_API_VERSION
import crypto from 'node:crypto';
import { sha256, str, normPhone, sendCapi } from './_lib.js';
import { saveLead, storeReady } from './_store.js';

export function buildLead(body, now = Date.now()) {
  const id = new Date(now).toISOString().slice(2, 10).replace(/-/g, '') + '-' + crypto.randomBytes(3).toString('hex');
  return {
    id,
    created_at: new Date(now).toISOString(),
    name: str(body.name, 80),
    phone: str(body.phone, 30),
    industry: str(body.industry, 60),
    industry_other: str(body.industry_other, 80),
    challenge: str(body.challenge, 1000),
    date_label: str(body.date_label, 40),
    time: str(body.time, 20),
    custom_time: str(body.custom_time, 200),
    start: str(body.start, 40),
    utm: str(body.utm, 300),
    event_id: str(body.event_id, 64),
    status: 'new',
    notes: ''
  };
}

export function buildEvent(lead, body, headers, now = Date.now()) {
  const name = lead.name.toLowerCase();
  const [fn, ...rest] = name.split(/\s+/);
  const ln = rest.join(' ');
  const phone = normPhone(lead.phone);
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
    event_id: lead.event_id,
    action_source: 'website',
    event_source_url: str(body.source_url, 300) || undefined,
    user_data,
    custom_data: { content_name: 'Free Zoom', content_category: lead.industry_other || lead.industry || undefined }
  };
}

export async function POST(request) {
  let body;
  try { body = JSON.parse(await request.text()); } catch { return new Response('bad json', { status: 400 }); }
  if (str(body.website)) return Response.json({ ok: true });                    // honeypot: bots fill hidden field
  if (!/^bk_[a-z0-9]{6,30}$/i.test(str(body.event_id, 64))) return new Response('bad event', { status: 400 });
  if (!str(body.name) || normPhone(body.phone).length < 9) return new Response('missing fields', { status: 400 });

  const lead = buildLead(body);
  let saved = false;
  try { await saveLead(lead); saved = true; }
  catch (err) { console.error('CRM save failed', err, 'LEAD:', JSON.stringify(lead)); }   // lead still in Vercel logs

  try { await sendCapi(buildEvent(lead, body, request.headers)); } catch (err) { console.error('CAPI failed', err); }
  return Response.json({ ok: true, id: lead.id, saved });
}

export function GET() {
  return Response.json({ ok: true, service: 'booking → CRM + Meta CAPI', crm: storeReady() });
}
