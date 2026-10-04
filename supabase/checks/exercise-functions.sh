#!/usr/bin/env bash
# LIVE PR-3 EXERCISE — part 2: the deployed Edge Functions, for real.
set -euo pipefail
REF=yercgevebxvtzkgctfai
URL="https://$REF.supabase.co"
# shellcheck disable=SC1091
source /tmp/keys.env
# shellcheck disable=SC1091
source /tmp/user.env

CLAN="${PR3_CLAN_ID:-3dc5f3ce-aa28-4d17-aee0-f7cebb64186d}"
CAPTURE="${PR3_CAPTURE_ID:-811387a7-512f-4f36-b80b-9fe5ba92149e}"

echo "── 5 · weekly-roll GATES ITSELF: a user JWT is refused"
curl -s -o /tmp/wr-user.json -w "   user JWT → HTTP %{http_code}\n" \
  -X POST "$URL/functions/v1/weekly-roll" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN"
head -c 160 /tmp/wr-user.json; echo

echo "── 6 · weekly-roll accepts the SECRET key (the cron path) and reports honestly"
curl -s -o /tmp/wr-secret.json -w "   secret key → HTTP %{http_code}\n" \
  -X POST "$URL/functions/v1/weekly-roll" \
  -H "apikey: $SECRET" -H "Authorization: Bearer $SECRET"
cat /tmp/wr-secret.json; echo

echo "── 7 · award-service: THE BURN (server-derived band, real award)"
KEY="pr3-live-burn-0001"
curl -s -o /tmp/burn1.json -w "   POST /functions/v1/award-service → HTTP %{http_code}\n" \
  -X POST "$URL/functions/v1/award-service" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Idempotency-Key: $KEY" \
  -d '{"capture_id":"'"$CAPTURE"'","clan_id":"'"$CLAN"'","accuracy":0,"cell_hash":"pr3liveA"}'
cat /tmp/burn1.json; echo

echo "── 8 · the SAME key again: an offline replay must award ONCE"
curl -s -o /tmp/burn2.json -w "   replay → HTTP %{http_code}\n" \
  -X POST "$URL/functions/v1/award-service" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Idempotency-Key: $KEY" \
  -d '{"capture_id":"'"$CAPTURE"'","clan_id":"'"$CLAN"'","accuracy":0,"cell_hash":"pr3liveA"}'
cat /tmp/burn2.json; echo

echo "── 9 · a client-sent band is IGNORED (accuracy 200 must grade a miss)"
curl -s -o /tmp/burn3.json -w "   forged band → HTTP %{http_code}\n" \
  -X POST "$URL/functions/v1/award-service" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Idempotency-Key: pr3-live-burn-0002" \
  -d '{"capture_id":"'"$CAPTURE"'","clan_id":"'"$CLAN"'","accuracy":200,"band":"bullseye"}'
cat /tmp/burn3.json; echo

echo "── 10 · image size: the 300 KB bucket rule is enforced by the bucket itself"
ls -l /tmp/pr3-live.jpg 2>/dev/null | awk '{print "   test image bytes:", $5}'
