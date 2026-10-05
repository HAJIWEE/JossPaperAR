#!/usr/bin/env bash
# LIVE PR-3 EXERCISE — part 3: a REAL Path C run through the deployed orchestrator.
# Costs ≈US$0.09 of fal.ai credit (ADR-002) — the only metered spend in the MVP.
set -euo pipefail
REF=yercgevebxvtzkgctfai
URL="https://$REF.supabase.co"
# shellcheck disable=SC1091
source /tmp/keys.env
# shellcheck disable=SC1091
source /tmp/user.env

IMAGE="${PR3_IMAGE:-spike/test-images/S08.jpg}"

# ⚠️ INTEGRATION DETAIL (recorded for PR-4): the client cannot UPDATE
# `captures.storage_path` — 0001 deliberately gives captures no UPDATE policy
# ("status/moderation are the orchestrator's to set"). So the app must choose
# the capture id BEFORE it uploads, exactly as doc 07 §4.1 describes.
CAP_ID=$(node -e 'console.log(crypto.randomUUID())')
echo "── 11 · client-generated capture id: $CAP_ID"

echo "── 12 · upload the photo, THEN insert the row (the real client order)"
curl -s -o /tmp/up.json -w "   POST storage captures → HTTP %{http_code}\n" \
  -X POST "$URL/storage/v1/object/captures/$PUID/$CAP_ID.jpg" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: image/jpeg" --data-binary "@$IMAGE"
cat /tmp/up.json; echo

curl -s -X POST "$URL/rest/v1/captures?select=id,status,storage_path" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"id":"'"$CAP_ID"'","user_id":"'"$PUID"'","storage_path":"'"$PUID/$CAP_ID.jpg"'","status":"pending"}' \
  | tee /tmp/cap.json
echo

echo "── 13 · THE LOCKED PATH C PIPELINE (identify → zod → generate). Real spend."
time curl -s -o /tmp/cart.json -w "   POST /functions/v1/cartoonize-orchestrator → HTTP %{http_code}\n" \
  -X POST "$URL/functions/v1/cartoonize-orchestrator" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --max-time 180 \
  -d '{"capture_id":"'"$CAP_ID"'"}'
head -c 600 /tmp/cart.json; echo

echo "── 14 · the job recorded its own cost and latency (doc 07 §5.3)"
CAP_ID="$CAP_ID" node -e '
const r = require("/tmp/cart.json");
console.log("   returned:", JSON.stringify(r).slice(0, 300));
' 2>/dev/null || true
echo "CAP_ID=$CAP_ID" > /tmp/pr3-cap.env
