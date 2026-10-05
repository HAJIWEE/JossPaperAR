#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# LIVE SCRUM-59 EXERCISE — the stop-rule, end to end, against the deployment.
#
#   bash supabase/checks/exercise-budget.sh
#   BUDGET_LIVE_STEP2=1 bash supabase/checks/exercise-budget.sh   # +US$0.09
#
# WHAT IT PROVES (cheaply — the default run spends NOTHING):
#   B1 the budget is a LIVE knob: writing app_config.daily_ai_budget_micros = 0
#      from the service side takes effect on the very next request
#   B2 an exhausted budget returns HTTP 200 `code: shrine_busy` — a QUEUE, not an
#      error (doc 10 §4: "Exhausted → jobs queue, never error")
#   B3 ⚠️ THE PROVIDER WAS NOT CALLED: the job row is still `queued`, cost_micros
#      is NULL, and the call returned far faster than a real Path C run
#      (PR-3 measured 14,988 ms and 90,000 micros for a successful job)
#   B4 the budget restores and reads back — enforced by an EXIT trap, so a run
#      that dies half-way still leaves the app working
#
# WHAT IT DELIBERATELY DOES NOT SPEND MONEY ON: the "…and the SAME capture then
# proceeds once the budget opens" half. That is S5 in supabase/tests/ai_budget.sql,
# asserted against the same RPC the orchestrator calls, and the orchestrator's
# proceed-path is already live-proven by exercise-cartoonize.sh (Path C, a real
# 14.9 s run). Set BUDGET_LIVE_STEP2=1 to buy that proof with fal credit anyway.
#
# The service key comes from /tmp/keys.env (never echoed); the test user is minted
# fresh here because an earlier session's JWT has expired by the time you read this.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

REF=yercgevebxvtzkgctfai
URL="https://$REF.supabase.co"
# shellcheck disable=SC1091
source /tmp/keys.env

# ── The service credential ────────────────────────────────────────────────
# /tmp/keys.env carries BOTH the legacy service_role JWT (`SVC`) and the newer
# `sb_secret_…` (`SECRET`). ⚠️ Measured 2026-10-04: the `SECRET` value had been
# rotated — it answers 401 "Invalid API key" — while `SVC` still works. Prefer
# SVC, fall back to SECRET, and FAIL FAST below: a rejected key here would
# otherwise look exactly like a stop-rule that "did not fire" (it happened, and
# it cost US$0.09 of fal credit to learn).
SVC_KEY="${SVC:-${SECRET:-}}"
if [[ -z "$SVC_KEY" ]]; then
  echo "✗ neither SVC nor SECRET is set in /tmp/keys.env" >&2
  exit 2
fi
if [[ "$(curl -s -o /dev/null -w '%{http_code}' "$URL/rest/v1/app_config?select=key&limit=1" \
          -H "apikey: $SVC_KEY" -H "Authorization: Bearer $SVC_KEY")" != "200" ]]; then
  echo "✗ the service key was rejected — refusing to run: the budget must be writable," >&2
  echo "  and a run that cannot restore it afterwards would lock the app out." >&2
  exit 2
fi

BUDGET_KEY='daily_ai_budget_micros'
SEEDED_BUDGET=5000000
IMAGE="${PR3_IMAGE:-spike/test-images/S08.jpg}"
SPEND_STEP2="${BUDGET_LIVE_STEP2:-0}"
FAILED=0

note() { printf '   %s\n' "$*"; }
check() { # check <label> <node-expression-that-must-be-true>
  if node -e "$2"; then note "✓ $1"; else note "✗ FAIL: $1"; FAILED=1; fi
}

# ── B4 (safety net): the budget is GLOBAL. Restore it however this script ends.
restore_budget() {
  curl -s -o /dev/null -X PATCH "$URL/rest/v1/app_config?key=eq.$BUDGET_KEY" \
    -H "apikey: $SVC_KEY" -H "Authorization: Bearer $SVC_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"value\":$SEEDED_BUDGET}" || true
}
trap restore_budget EXIT

echo "── 1 · anonymous sign-in (ADR-004: burn before any signup wall)"
curl -s -X POST "$URL/auth/v1/signup" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"data":{"source":"scrum59-exercise"}}' > /tmp/signup59.json
node -e '
const r = require("/tmp/signup59.json");
if (!r.access_token) { console.error("✗ sign-in failed:", JSON.stringify(r).slice(0,200)); process.exit(1); }
require("fs").writeFileSync("/tmp/user.env", `PUID=${r.user.id}\nTOKEN=${r.access_token}\n`);
console.log("   user:", r.user.id, "| is_anonymous:", r.user.is_anonymous);
'
# shellcheck disable=SC1091
source /tmp/user.env

echo "── 2 · B1 — spend the day's budget (service-side write, 0 micros = zero USD)"
curl -s -o /tmp/budget0.json -w "   PATCH app_config → HTTP %{http_code}\n" \
  -X PATCH "$URL/rest/v1/app_config?key=eq.$BUDGET_KEY" \
  -H "apikey: $SVC_KEY" -H "Authorization: Bearer $SVC_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"value":0}'
cat /tmp/budget0.json; echo

echo "── 3 · an offering: upload the photo, THEN insert the row (client order, doc 07 §4.1)"
CAP_ID=$(node -e 'console.log(crypto.randomUUID())')
curl -s -o /dev/null -w "   POST storage captures → HTTP %{http_code}\n" \
  -X POST "$URL/storage/v1/object/captures/$PUID/$CAP_ID.jpg" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: image/jpeg" --data-binary "@$IMAGE"
curl -s -o /dev/null -w "   INSERT captures row  → HTTP %{http_code}\n" \
  -X POST "$URL/rest/v1/captures" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=minimal" \
  -d '{"id":"'"$CAP_ID"'","user_id":"'"$PUID"'","storage_path":"'"$PUID/$CAP_ID.jpg"'","status":"pending"}'

echo "── 4 · B2/B3 — the stop-rule fires: queue, never fail, and NO provider call"
TIME=$(curl -s -o /tmp/budgetcall.json -w '%{time_total}' \
  -X POST "$URL/functions/v1/cartoonize-orchestrator" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" --max-time 60 \
  -d '{"capture_id":"'"$CAP_ID"'"}')
cat /tmp/budgetcall.json; echo
note "returned in ${TIME}s"
check "B2 the call returned 200 + code shrine_busy + queued (not an error)" \
  'const r=require("/tmp/budgetcall.json"); process.exit(r.code==="shrine_busy" && r.queued===true && r.status==="queued" ? 0 : 1)'
check "B3 it did NOT pay for a provider call (returned in well under one Path C run)" \
  "process.exit($TIME < 5.0 ? 0 : 1)"

sleep 2   # let the job row settle, then read it back through the service key
curl -s -o /tmp/budgetjob.json \
  "$URL/rest/v1/cartoonize_jobs?capture_id=eq.$CAP_ID&select=status,cost_micros,latency_ms" \
  -H "apikey: $SVC_KEY" -H "Authorization: Bearer $SVC_KEY"
cat /tmp/budgetjob.json; echo
check "B3 the job is still queued with cost_micros NULL (nothing was called, nothing spent)" \
  'const j=(require("/tmp/budgetjob.json")||[])[0]||null; process.exit(j && j.status==="queued" && j.cost_micros===null ? 0 : 1)'

if [[ "$SPEND_STEP2" == "1" ]]; then
  echo "── 5 · OPTIONAL: open the budget and re-offer — the SAME capture proceeds (≈US$0.09)"
  restore_budget
  curl -s -o /tmp/budgetcall2.json -w "   POST orchestrator → HTTP %{http_code}\n" \
    -X POST "$URL/functions/v1/cartoonize-orchestrator" \
    -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" --max-time 180 \
    -d '{"capture_id":"'"$CAP_ID"'"}'
  head -c 400 /tmp/budgetcall2.json; echo
  check "B5 the parked offering was NOT lost — it completed on the next request" \
    'const r=require("/tmp/budgetcall2.json"); process.exit(r.status==="styled" ? 0 : 1)'
else
  echo "── 5 · skipped the metered half (set BUDGET_LIVE_STEP2=1 to buy it; S5 in"
  echo "       supabase/tests/ai_budget.sql asserts the same behaviour for free)"
fi

echo "── 6 · B4 — restore the budget and read it back"
restore_budget
curl -s -o /tmp/budgetback.json -w "   GET app_config → HTTP %{http_code}\n" \
  "$URL/rest/v1/app_config?key=eq.$BUDGET_KEY&select=value" \
  -H "apikey: $SVC_KEY" -H "Authorization: Bearer $SVC_KEY"
cat /tmp/budgetback.json; echo
check "B4 the global budget reads back at $SEEDED_BUDGET (the app is not locked out)" \
  "const c=(require('/tmp/budgetback.json')||[])[0]||null; process.exit(c && Number(c.value)===$SEEDED_BUDGET ? 0 : 1)"

echo "── 7 · clean up everything this exercise created (no residue — the same rule"
echo "       the SQL tests keep: the project is left exactly as it was found)"
curl -s -o /dev/null -w "   DELETE the capture (cascades the job) → HTTP %{http_code}\n" \
  -X DELETE "$URL/rest/v1/captures?id=eq.$CAP_ID" \
  -H "apikey: $SVC_KEY" -H "Authorization: Bearer $SVC_KEY"
# The Storage row and the auth user do NOT cascade — ⚠️ measured 2026-10-04: the
# Storage API's `{"prefixes":[…]}` bulk delete answered 200 and deleted NOTHING,
# so the object is removed BY PATH and the folder is left to vanish on its own.
curl -s -o /dev/null -w "   DELETE the uploaded photo        → HTTP %{http_code}\n" \
  -X DELETE "$URL/storage/v1/object/captures/$PUID/$CAP_ID.jpg" \
  -H "apikey: $SVC_KEY" -H "Authorization: Bearer $SVC_KEY"
curl -s -o /dev/null -w "   DELETE the anonymous user        → HTTP %{http_code}\n" \
  -X DELETE "$URL/auth/v1/admin/users/$PUID" \
  -H "apikey: $SVC_KEY" -H "Authorization: Bearer $SVC_KEY"

if [[ $FAILED -eq 0 ]]; then echo "✓ stop-rule: all live checks passed"; else echo "✗ stop-rule: FAILED"; fi
exit $FAILED
