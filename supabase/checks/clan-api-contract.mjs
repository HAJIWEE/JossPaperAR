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
// a third device, used for the Book's outsider projection AND the ramp's named path
const C = await newDevice();
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

// ═══ 3b · clan_invite_code — SCRUM-86 · the code is ELDER AND ABOVE ════════
// ⚠️ This section exists because the repo has NO generated DB types: nothing
// statically checks that `fetchClanCode`'s `p_clan_id` matches, nor that
// `clans.code` is genuinely unreadable over the wire. B is a plain MEMBER here
// (section 4 promotes them next), which is exactly the boundary to test.
section('3b · clan_invite_code · { p_clan_id } — the SCRUM-86 boundary');
{
  // the head may read it, and gets the clan's real code
  const asHead = await A.client.rpc('clan_invite_code', { p_clan_id: clanId });
  check('clan_invite_code accepts { p_clan_id }', asHead.error === null, asHead.error?.message);
  check('⚠️ the HEAD gets the invite code — SCRUM-86: elder and above',
    asHead.data?.code === code, `got ${asHead.data?.code}`);
  check('…and is told their own role, which clan-api parses', asHead.data?.role === 'head');

  // ⚠️ a plain MEMBER is refused — the decision, enforced by the DATABASE
  const asMember = await B.client.rpc('clan_invite_code', { p_clan_id: clanId });
  check('⚠️ a plain MEMBER is REFUSED the invite code', asMember.error !== null,
    'a member got the code — the column grant or the ladder has regressed');
  check('…with 42501 (insufficient_privilege), not a generic error',
    String(asMember.error?.code) === '42501' || /elder|permission/i.test(asMember.error?.message ?? ''),
    asMember.error?.message);

  // ⚠️ and the COLUMN is not a back door. The pair matters: on its own a failed
  // read could just be an RLS row the member cannot see at all.
  const rowRead = await B.client.from('clans').select('id, name').eq('id', clanId);
  check('(control) a member CAN still read the ROW — id and name stay granted',
    rowRead.error === null && (rowRead.data ?? []).length === 1, rowRead.error?.message);

  const colRead = await B.client.from('clans').select('code').eq('id', clanId);
  check('⚠️ …but selecting `code` over PostgREST is DENIED — no back door',
    colRead.error !== null,
    'a member read clans.code directly — the revoke in 0015 is not in force');
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

// ═══ 4b · SCRUM-86 — an ELDER gains the code, and still cannot RE-ROLL ═════
// B was promoted to `elder` immediately above, so this is the other half of the
// boundary: the ladder changed the answer without a client flag being involved.
section('4b · the elder side of the SCRUM-86 boundary');
{
  const asElder = await B.client.rpc('clan_invite_code', { p_clan_id: clanId });
  check('⚠️ an ELDER now GETS the invite code — the promotion is what changed it',
    asElder.error === null && asElder.data?.code === code, asElder.error?.message);
  check('…and is told their own role', asElder.data?.role === 'elder');

  const stillDenied = await B.client.from('clans').select('code').eq('id', clanId);
  check('⚠️ …but an elder STILL cannot read the column — the RPC is the only path',
    stillDenied.error !== null,
    'an elder read clans.code directly — 0015 did not revoke the table-wide grant');

  // ⚠️ sharing ≠ retiring: the elder gained the SHARE and must not gain the RE-ROLL
  const reroll = await B.client.rpc('reroll_clan_code', { p_clan_id: clanId });
  check('⚠️ an ELDER is still refused a RE-ROLL — retiring a link is head-only',
    reroll.error !== null, 'an elder re-rolled the code — the asymmetry is broken');
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
  // so use the third device to see the anonymised projection
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

// ═══ 9 · leave_clan · { p_clan_id } — the ONE case still refused ══════════
// SCRUM-84 (PM-answered 2026-10-08) replaced "the sole head is always refused"
// with a ramp. On THIS clan A is the only member at all — no co-head, no elder,
// nobody to inherit — which is the single case the ramp still refuses.
section('9 · leave_clan · { p_clan_id } — no candidate');
{
  const refused = await A.client.rpc('leave_clan', { p_clan_id: clanId });
  check('leave_clan accepts { p_clan_id }', refused.error !== null);
  check('⚠️ a sole head with NO candidate is refused', refused.error !== null);
  check('⚠️ …and the refusal names a way out ("promote a co-head")',
    (refused.error?.message ?? '').includes('promote a co-head'), refused.error?.message);
}

// ═══ 9b · the AUTO path — nobody named, an elder exists ════════════════════
section('9b · leave_clan — no successor named → the oldest elder');
let clanTwo = null;
{
  const created = await A.client.rpc('create_clan', { p_name: 'Ramp Two' });
  check('a second clan is created for the ramp', created.error === null, created.error?.message);
  clanTwo = created.data?.clan_id ?? null;

  const joined = await B.client.rpc('join_clan', { p_code: created.data?.code });
  check('B joins it', joined.error === null, joined.error?.message);
  const promoted = await A.client.rpc('set_member_role', {
    p_clan_id: clanTwo,
    p_user_id: B.userId,
    p_role: 'elder',
  });
  check('B is made an elder', promoted.error === null, promoted.error?.message);

  // ⚠️ `p_successor` is OMITTED ENTIRELY — the SQL default must let the call
  // through, and the ramp must then fall back to the oldest elder.
  const left = await A.client.rpc('leave_clan', { p_clan_id: clanTwo });
  check('⚠️ leave_clan works with `p_successor` OMITTED', left.error === null, left.error?.message);
  check('⚠️ …and it reports the SERVER chose (`auto_promoted`)', left.data?.auto_promoted === true);
  check('⚠️ …with the elder as the successor', left.data?.successor === B.userId);
  check('…and the head is gone', left.data?.left === true);

  // ⚠️ THE RANK THE SUCCESSOR ACTUALLY GOT — read back from the TABLE, not trusted
  // from the response. SCRUM-84, answered 2026-10-08: the successor INHERITS the
  // departing rank, so a departing HEAD hands over to a new `head` (migration 0014).
  // This is the strongest form of the assertion: it exercises the REAL function.
  const bRow = await B.client
    .from('clan_members')
    .select('role')
    .eq('clan_id', clanTwo)
    .eq('user_id', B.userId)
    .maybeSingle();
  check('⚠️ the AUTO-promoted elder really is the new HEAD', bRow.data?.role === 'head', bRow.error?.message);
  check('⚠️ …and NOT a `co_head` — the successor INHERITS the departing rank',
    bRow.data?.role !== 'co_head');
}

// ═══ 9c · the NAMED path — this section exists for the ARGUMENT NAME ═══════
section('9c · leave_clan — a NAMED successor');
let clanThree = null;
{
  const created = await A.client.rpc('create_clan', { p_name: 'Ramp Three' });
  check('a third clan is created', created.error === null, created.error?.message);
  clanThree = created.data?.clan_id ?? null;
  const joined = await C.client.rpc('join_clan', { p_code: created.data?.code });
  check('C joins the third clan', joined.error === null, joined.error?.message);

  const left = await A.client.rpc('leave_clan', {
    p_clan_id: clanThree,
    // ⚠️ THE ARGUMENT THIS SECTION EXISTS FOR. A typo here is invisible to `tsc`
    // and would fail only on a device — which is why the contract test is a gate.
    p_successor: C.userId,
  });
  check('⚠️ leave_clan accepts { p_clan_id, p_successor }', left.error === null, left.error?.message);
  check('…the NAMED member is the successor', left.data?.successor === C.userId);
  check('…and it is NOT reported as an auto choice', left.data?.auto_promoted === false);

  const cRow = await C.client
    .from('clan_members')
    .select('role')
    .eq('clan_id', clanThree)
    .eq('user_id', C.userId)
    .maybeSingle();
  check('⚠️ the NAMED successor is the new HEAD too', cRow.data?.role === 'head', cRow.error?.message);
  check('⚠️ …and NOT a `co_head`, even though they were named rather than auto-chosen',
    cRow.data?.role !== 'co_head');
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

// ═══ 9d · a CO-HEAD leaving while the head remains — SCRUM-84 clarified ════
// ⚠️ Uses B and C, NOT A. A is already at the 3-joins-per-hour cap from 9b/9c,
// so a fourth clan from A would be (correctly) refused by the anti-abuse trigger
// and this section would fail for entirely the wrong reason.
section('9d · leave_clan — a co-head leaves, the head remains');
let clanFour = null;
{
  const created = await B.client.rpc('create_clan', { p_name: 'Ramp Four' });
  check('B creates a fourth clan', created.error === null, created.error?.message);
  clanFour = created.data?.clan_id ?? null;

  const joined = await C.client.rpc('join_clan', { p_code: created.data?.code });
  check('C joins it', joined.error === null, joined.error?.message);
  const promoted = await B.client.rpc('set_member_role', {
    p_clan_id: clanFour,
    p_user_id: C.userId,
    p_role: 'co_head',
  });
  check('C is made a co-head', promoted.error === null, promoted.error?.message);

  // ⚠️ THE CLARIFICATION: no nomination, no promotion — the head remains.
  const left = await C.client.rpc('leave_clan', { p_clan_id: clanFour });
  check('⚠️ a CO-HEAD leaves without nominating', left.error === null, left.error?.message);
  check('⚠️ …and promotes NOBODY', left.data?.successor === null);
  check('⚠️ …and reports no auto choice', left.data?.auto_promoted === false);
  check('…and it says they left as a co_head', left.data?.was === 'co_head');
}

// ═══ CLEANUP — leave no residue, so a re-run starts from the same place ════
// The ramp sections create two extra clans. Their NEW co-heads delete them, which
// is also the last proof that a promoted successor really did inherit head power.
section('cleanup');
{
  const d2 = await B.client.rpc('delete_clan', { p_clan_id: clanTwo });
  check('⚠️ the promoted successor CAN delete the clan — head power was real',
    d2.error === null, d2.error?.message);
  const d3 = await C.client.rpc('delete_clan', { p_clan_id: clanThree });
  check('…and so can the NAMED successor', d3.error === null, d3.error?.message);
  const d4 = await B.client.rpc('delete_clan', { p_clan_id: clanFour });
  check('…and the 9d clan is cleaned up too', d4.error === null, d4.error?.message);
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


