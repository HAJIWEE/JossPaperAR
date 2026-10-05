#!/usr/bin/env bash
# LIVE PR-3 EXERCISE — award-service against the hosted project.
# Keys come from `supabase projects api-keys`; nothing is echoed.
set -euo pipefail
cd "$(dirname "$0")"

REF=yercgevebxvtzkgctfai
URL="https://$REF.supabase.co"

node -e '
const a = require("/tmp/keys.json");
const anon = a.find(k => k.name === "anon").api_key;
const svc  = a.find(k => k.name === "service_role").api_key;
const secret = a.find(k => k.name === "default" && String(k.api_key).startsWith("sb_secret_")).api_key;
require("fs").writeFileSync("/tmp/keys.env", `ANON=${anon}\nSVC=${svc}\nSECRET=${secret}\n`);
'
# shellcheck disable=SC1091
source /tmp/keys.env

echo "── 1 · anonymous sign-in (ADR-004: a user burns before any signup wall)"
curl -s -X POST "$URL/auth/v1/signup" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"data":{"source":"pr3-exercise"}}' > /tmp/signup.json
node -e '
const r = require("/tmp/signup.json");
require("fs").writeFileSync("/tmp/user.env", `PUID=${r.user.id}\nTOKEN=${r.access_token}\n`);
console.log("   user id:", r.user.id, "| is_anonymous:", r.user.is_anonymous, "| role:", r.user.role);
'
# shellcheck disable=SC1091
source /tmp/user.env

echo "── 2 · the money path is CLOSED to a signed-in client (submit_burn is service_role only)"
curl -s -o /tmp/rpc-direct.json -w "   POST /rest/v1/rpc/submit_burn → HTTP %{http_code}\n" \
  -X POST "$URL/rest/v1/rpc/submit_burn" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"p_actor":"'"$PUID"'","p_payload":{},"p_idempotency_key":"pr3-direct-call"}'
head -c 200 /tmp/rpc-direct.json; echo

echo "── 3 · an authenticated client cannot write the ledger directly"
curl -s -o /tmp/led.json -w "   POST /rest/v1/ledger_events → HTTP %{http_code}\n" \
  -X POST "$URL/rest/v1/ledger_events" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"user_id":"'"$PUID"'","seq":1,"currency":"tribute","type":"award","amount":999,"actor":"client"}'
head -c 200 /tmp/led.json; echo

echo "── 4 · anon (no session) reads 0 rows"
curl -s -o /tmp/anon-read.json -w "   GET /rest/v1/profiles → HTTP %{http_code}\n" \
  "$URL/rest/v1/profiles?select=user_id" -H "apikey: $ANON"
head -c 120 /tmp/anon-read.json; echo
