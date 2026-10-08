/**
 * THE CLIENT ↔ SERVER CONTRACT for the clan API — SCRUM-46.
 *
 *   npx supabase start
 *   SUPABASE_URL="http://127.0.0.1:54321" \
 *   SUPABASE_ANON_KEY="$(npx supabase status -o env | sed -n 's/^ANON_KEY="\(.*\)"/\1/p')" \
 *     node supabase/checks/clan-api-contract.mjs
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * `src/lib/clan-api.ts` has NO generated DB types, so nothing statically checks
 * that the argument names it sends (`p_clan_id`, `p_user_id`, `p_role`, …) or
 * the response fields it reads (`clan_id`, `ancestor_count`, `was`, `entries` …)
 * match what the database actually defines. A typo there is invisible to `tsc`
 * and to `check:lib`; it fails only on a device, as an empty screen.
 *
 * So this drives the REAL RPCs over the REAL PostgREST with the REAL argument
 * names, and asserts the REAL response fields — the same ones `clan-api.ts`
 * parses. A wrong name makes PostgREST answer "Could not find the function …",
 * which is exactly the failure this catches.
 *
 * ⚠️ It needs a running local stack (free, no account). It is NOT part of
 * `npm run check` for that reason — it is the `check:db` family.
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY;

if (!ANON) {
  console.error('✗ SUPABASE_ANON_KEY is required (see the header for the command)');
  process.exit(2);
}

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/** A fresh anonymous device (ADR-004) — its own session, no shared storage. */
async function newDevice() {
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`anonymous sign-in failed: ${error?.message ?? 'no user'}`);
  return { client, userId: data.user.id };
}

/** The fields `summaryOf` in clan-api.ts reads, asserted in one place. */
function assertSummary(label, payload) {
  const r = payload ?? {};
  check(`${label}: clan_id is a uuid`, typeof r.clan_id === 'string' && r.clan_id.length === 36);
  check(`${label}: name comes back`, typeof r.name === 'string' && r.name.length > 0);
  check(`${label}: role comes back`, r.role === 'head' || r.role === 'member');
  check(`${label}: ancestor_count is a number`, typeof r.ancestor_count === 'number');
  check(`${label}: member_count is a number`, typeof r.member_count === 'number');
}

const A = await newDevice();
const B = await newDevice();
let clanId = null;
let code = null;

// ═══ 1 · create_clan — the args clan-api.ts sends ══════════════════════════
section('1 · create_clan · { p_name }');
{
  const { data, error } = await A.client.rpc('create_clan', { p_name: 'Tan Family' });
  check('create_clan accepts { p_name }', error === null, error?.message);
  assertSummary('create_clan', data);
  check('create_clan: the founder is head', data?.role === 'head');
  check('create_clan: ancestor_cap comes back', data?.ancestor_cap === 10);
  check('⚠️ create_clan returns `code` — the invite card needs it', typeof data?.code === 'string');
  clanId = data?.clan_id ?? null;
  code = data?.code ?? null;
}

// ═══ 2 · preview_clan — resolve for a NON-member ═══════════════════════════
section('2 · preview_clan · { p_code }');
{
  const { data, error } = await B.client.rpc('preview_clan', { p_code: code });
  check('preview_clan accepts { p_code }', error === null, error?.message);
  check('preview_clan: found', data?.found === true);
  check('preview_clan: clan_id comes back', typeof data?.clan_id === 'string');
  check('preview_clan: name comes back', typeof data?.name === 'string');
  check('preview_clan: ancestor_count is a number', typeof data?.ancestor_count === 'number');
  check('preview_clan: member_count is a number', typeof data?.member_count === 'number');
  check('preview_clan: is_member tells the truth', data?.is_member === false);
  check('⚠️ a preview never leaks an ancestor name (doc 13 §4)',
    !Object.keys(data ?? {}).some((k) => k.includes('ancestor_name') || k === 'ancestors'));

  const bad = await B.client.rpc('preview_clan', { p_code: 'ZZZZZZZZ' });
  check('a revoked/unknown code returns found:false, not an error',
    bad.error === null && bad.data?.found === false, bad.error?.message);
}

// ═══ 3 · join_clan — instant, no approval queue ════════════════════════════
section('3 · join_clan · { p_code }');
{
  const { data, error } = await B.client.rpc('join_clan', { p_code: code });
  check('join_clan accepts { p_code }', error === null, error?.message);
  assertSummary('join_clan', data);
  check('join_clan: a joiner is a member, never a head', data?.role === 'member');
  check('join_clan: member_count reflects the join', data?.member_count === 2);

  const again = await B.client.rpc('join_clan', { p_code: code });
  check('joining twice is refused', again.error !== null);
}

// ═══ 4 · set_member_role — the ladder, with the args the API sends ═════════
section('4 · set_member_role · { p_clan_id, p_user_id, p_role }');
{
  const { data, error } = await A.client.rpc('set_member_role', {
    p_clan_id: clanId,
    p_user_id: B.userId,
    p_role: 'elder',
  });
  check('set_member_role accepts { p_clan_id, p_user_id, p_role }', error === null, error?.message);
  check('set_member_role: `from` names the old role — clan-api reads it', data?.from === 'member');
  check('set_member_role: the new role comes back', data?.role === 'elder');

  // ⚠️ the enum argument is what makes a wrong name or value fail LOUDLY here
  const bad = await A.client.rpc('set_member_role', {
    p_clan_id: clanId, p_user_id: B.userId, p_role: 'head',
  });
  check('⚠️ head is refused by the server as well as the client', bad.error !== null);
}

// ═══ 5 · rename_clan · { p_clan_id, p_name } ═══════════════════════════════
section('5 · rename_clan · { p_clan_id, p_name }');
{
  const { data, error } = await A.client.rpc('rename_clan', { p_clan_id: clanId, p_name: 'Lim Family' });
  check('rename_clan accepts { p_clan_id, p_name }', error === null, error?.message);
  check('rename_clan: the new name comes back — clan-api reads it', data?.name === 'Lim Family');

  const bad = await A.client.rpc('rename_clan', { p_clan_id: clanId, p_name: 'X' });
  check('a 1-character name is refused by the server', bad.error !== null);
}

// ═══ 6 · reroll_clan_code · { p_clan_id } ══════════════════════════════════
section('6 · reroll_clan_code · { p_clan_id }');
{
  const { data, error } = await A.client.rpc('reroll_clan_code', { p_clan_id: clanId });
  check('reroll_clan_code accepts { p_clan_id }', error === null, error?.message);
  check('reroll_clan_code: a fresh 8-char code comes back', typeof data?.code === 'string' && data.code.length === 8);
  check('⚠️ the old code no longer resolves', data?.code !== code);
  code = data?.code ?? code;
}

// ═══ 7 · clan_book · { p_clan_id, p_limit } — both projections ═════════════
section('7 · clan_book · { p_clan_id, p_limit }');
{
  const asMember = await A.client.rpc('clan_book', { p_clan_id: clanId, p_limit: 50 });
  check('clan_book accepts { p_clan_id, p_limit }', asMember.error === null, asMember.error?.message);
  check('clan_book: found', asMember.data?.found === true);
  check('clan_book: `member` reports the caller — clan-api reads it', asMember.data?.member === true);
  check('clan_book: window_days comes back', typeof asMember.data?.window_days === 'number');
  check('clan_book: entries is an array', Array.isArray(asMember.data?.entries));

  // a stale book (before the join) read by a NON-member — B was promoted to elder,
  // so use a third device to see the anonymised projection
  const C = await newDevice();
  const asOutsider = await C.client.rpc('clan_book', { p_clan_id: clanId, p_limit: 50 });
  check('clan_book resolves for a non-member too', asOutsider.error === null, asOutsider.error?.message);
  check('⚠️ clan_book: a non-member is reported as NOT a member', asOutsider.data?.member === false);
}

// ═══ 8 · remove_member · { p_clan_id, p_user_id } ══════════════════════════
section('8 · remove_member · { p_clan_id, p_user_id }');
{
  const { data, error } = await A.client.rpc('remove_member', { p_clan_id: clanId, p_user_id: B.userId });
  check('remove_member accepts { p_clan_id, p_user_id }', error === null, error?.message);
  check('remove_member: `removed` comes back', data?.removed === true);

  const self = await A.client.rpc('remove_member', { p_clan_id: clanId, p_user_id: A.userId });
  check('⚠️ a head cannot remove themselves — leave_clan is the way', self.error !== null);
}

// ═══ 9 · leave_clan · { p_clan_id } — and the promote-first refusal ════════
section('9 · leave_clan · { p_clan_id }');
{
  // ⚠️ A is the ONLY head: the server must refuse, and the message must name the
  // way out — that string is shown verbatim to the user (doc 15 §10.4).
  const refused = await A.client.rpc('leave_clan', { p_clan_id: clanId });
  check('leave_clan accepts { p_clan_id }', refused.error !== null);
  check('⚠️ the SOLE head is refused', refused.error !== null);
  check('⚠️ …and the refusal names the way out — "promote a co-head"',
    (refused.error?.message ?? '').includes('promote a co-head'), refused.error?.message);
}

// ═══ 10 · delete_clan · { p_clan_id } ══════════════════════════════════════
section('10 · delete_clan · { p_clan_id }');
{
  const { data, error } = await A.client.rpc('delete_clan', { p_clan_id: clanId });
  check('delete_clan accepts { p_clan_id }', error === null, error?.message);
  check('delete_clan: `deleted` comes back', data?.deleted === true);
  check('delete_clan: `member_count` comes back — clan-api reads it', typeof data?.member_count === 'number');
  check('delete_clan: `ancestor_count` comes back', typeof data?.ancestor_count === 'number');

  const after = await A.client.rpc('clan_book', { p_clan_id: clanId, p_limit: 10 });
  check('the clan really is gone — the Book reports found:false', after.data?.found === false);
}

// ═══ RESULT ════════════════════════════════════════════════════════════════
console.log(`\n${'─'.repeat(64)}`);
if (failures.length === 0) {
  console.log(`✓ all ${passed} clan-API contract checks passed`);
  process.exit(0);
}
console.log(`✗ ${failures.length} of ${passed + failures.length} clan-API contract checks FAILED:`);
for (const f of failures) console.log(`    · ${f}`);
process.exit(1);


