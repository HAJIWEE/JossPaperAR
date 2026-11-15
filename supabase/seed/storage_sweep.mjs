/**
 * Deletes the DEMO identities' storage objects BY PATH (SCRUM-197).
 *
 * ⚠️ The bulk call `{ "prefixes": [...] }` answers **200 and deletes nothing** —
 * the trap named on the ticket. So this lists each demo prefix and deletes each
 * object by its full path.
 *
 * ⚠️ If the credentials are absent it says so and exits 0: the demo seed creates
 * NO captures today, so there is nothing to sweep — but the code must exist for
 * the day it does, and a silent skip would read as "clean".
 */
const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKETS = ['captures', 'styled'];
const DEMO_USERS = [
  'de000000-0000-4000-8000-000000000001',
  'de000000-0000-4000-8000-000000000002',
  'de000000-0000-4000-8000-000000000003',
  'de000000-0000-4000-8000-000000000004',
  'de000000-0000-4000-8000-000000000005',
];

if (!url || !key) {
  console.log('storage sweep: SKIPPED — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to sweep objects');
  process.exit(0);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
let removed = 0;
let failed = 0;

for (const bucket of BUCKETS) {
  for (const uid of DEMO_USERS) {
    const listed = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prefix: uid, limit: 1000 }),
    });
    if (!listed.ok) {
      console.error(`storage sweep: list ${bucket}/${uid} → ${listed.status}`);
      failed += 1;
      continue;
    }
    for (const obj of (await listed.json()) ?? []) {
      const path = `${uid}/${obj.name}`;
      const del = await fetch(`${url}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
        method: 'DELETE',
        headers,
      });
      if (del.ok) removed += 1;
      else { console.error(`storage sweep: delete ${bucket}/${path} → ${del.status}`); failed += 1; }
    }
  }
}

console.log(`storage sweep: ${removed} object(s) deleted by path${failed ? `, ${failed} FAILED` : ''}`);
if (failed) process.exit(1);
