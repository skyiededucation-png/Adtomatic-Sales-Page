// CRM API (password protected with env CRM_PASSWORD, sent as header x-crm-key)
//   GET   /api/leads          -> latest 1000 leads, newest first
//   PATCH /api/leads  {id, status?, notes?}  -> update one lead
import { authed, redis, hasRedis, str } from './_lib.js';

export const STATUSES = ['new', 'contacted', 'confirmed', 'showed', 'no_show', 'won', 'lost'];

function deny() { return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } }); }

export async function GET(request) {
  if (!authed(request)) return deny();
  if (!hasRedis()) return Response.json({ ok: false, error: 'CRM database not connected' }, { status: 500 });
  const ids = await redis([['ZREVRANGE', 'leads', '0', '999']]).then((r) => r[0] || []);
  if (!ids.length) return Response.json({ ok: true, leads: [] });
  const rows = await redis([['MGET', ...ids.map((id) => 'lead:' + id)]]).then((r) => r[0] || []);
  const leads = rows.filter(Boolean).map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
  return Response.json({ ok: true, leads }, { headers: { 'cache-control': 'no-store' } });
}

export async function PATCH(request) {
  if (!authed(request)) return deny();
  if (!hasRedis()) return Response.json({ ok: false, error: 'CRM database not connected' }, { status: 500 });
  let body;
  try { body = JSON.parse(await request.text()); } catch { return new Response('bad json', { status: 400 }); }
  const id = str(body.id, 40);
  if (!/^[0-9]{6}-[a-f0-9]{6}$/.test(id)) return new Response('bad id', { status: 400 });
  const cur = await redis([['GET', 'lead:' + id]]).then((r) => r[0]);
  if (!cur) return new Response('not found', { status: 404 });
  const lead = JSON.parse(cur);
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return new Response('bad status', { status: 400 });
    lead.status = body.status;
  }
  if (body.notes !== undefined) lead.notes = str(body.notes, 2000);
  lead.updated_at = new Date().toISOString();
  await redis([['SET', 'lead:' + id, JSON.stringify(lead)]]);
  return Response.json({ ok: true, lead });
}
