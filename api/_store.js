// CRM storage layer. Everything that reads/writes leads goes through this file,
// so moving to our own CRM / database later means changing only this file.
//
// Current backend: Vercel Blob (private store) — Vercel's own storage, inside the same
// Vercel project. No outside account. Each lead is one private JSON file: crm/leads/<id>.json
// Setup: Vercel → Project → Storage → Create → Blob → Access: Private → Connect to project.
import { put, list, get } from '@vercel/blob';

const PREFIX = 'crm/leads/';
const pathOf = (id) => PREFIX + id + '.json';

export function storeReady() {
  // Connecting a store to the project adds BLOB_STORE_ID (OIDC auth) or BLOB_READ_WRITE_TOKEN.
  return !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

export async function saveLead(lead) {
  await put(pathOf(lead.id), JSON.stringify(lead), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json'
  });
  return lead;
}

export async function getLead(id) {
  const r = await get(pathOf(id), { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}

export async function listLeads(max = 1000) {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, limit: 1000, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && blobs.length < 5000);

  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const ids = blobs.slice(0, max).map((b) => b.pathname.slice(PREFIX.length).replace(/\.json$/, ''));

  const out = [];
  for (let i = 0; i < ids.length; i += 25) {                       // 25 reads at a time
    const chunk = await Promise.all(ids.slice(i, i + 25).map((id) => getLead(id).catch(() => null)));
    out.push(...chunk.filter(Boolean));
  }
  return out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function updateLead(id, patch) {
  const lead = await getLead(id);
  if (!lead) return null;
  Object.assign(lead, patch, { updated_at: new Date().toISOString() });
  await saveLead(lead);
  return lead;
}
