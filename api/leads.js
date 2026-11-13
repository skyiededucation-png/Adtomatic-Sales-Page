// CRM API (password protected with env CRM_PASSWORD, sent as header x-crm-key)
//   GET   /api/leads                      -> leads, newest first
//   PATCH /api/leads  {id, status?, notes?} -> update one lead
import { authed, str } from './_lib.js';
import { listLeads, updateLead, storeReady } from './_store.js';

export const STATUSES = ['new', 'contacted', 'confirmed', 'showed', 'no_show', 'won', 'lost'];
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' } });

export async function GET(request) {
  if (!authed(request)) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!storeReady()) return json({ ok: false, error: 'CRM 储存还没开（Vercel → Storage → Blob → Private）' }, 500);
  try { return json({ ok: true, leads: await listLeads() }); }
  catch (err) { console.error(err); return json({ ok: false, error: 'read failed' }, 500); }
}

export async function PATCH(request) {
  if (!authed(request)) return json({ ok: false, error: 'unauthorized' }, 401);
  let body;
  try { body = JSON.parse(await request.text()); } catch { return json({ ok: false, error: 'bad json' }, 400); }
  const id = str(body.id, 40);
  if (!/^[0-9]{6}-[a-f0-9]{6}$/.test(id)) return json({ ok: false, error: 'bad id' }, 400);
  const patch = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return json({ ok: false, error: 'bad status' }, 400);
    patch.status = body.status;
  }
  if (body.notes !== undefined) patch.notes = str(body.notes, 2000);
  const lead = await updateLead(id, patch);
  return lead ? json({ ok: true, lead }) : json({ ok: false, error: 'not found' }, 404);
}
