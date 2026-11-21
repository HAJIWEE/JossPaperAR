#!/usr/bin/env bash
# SCRUM-197 — remove everything the demo seed created, or say there is nothing.
# ⚠️ SAME guard as the seed, so the target check cannot drift between the two.
set -euo pipefail
cd "$(dirname "$0")/../.."

TARGET="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

node supabase/checks/seed-guard.ts --target "$TARGET"

# storage first: an object is not a row, and the users are needed to find its path
node supabase/seed/storage_sweep.mjs

docker run --rm -i --network host \
  -v "$PWD/supabase:/w/supabase:ro" \
  postgres:17 psql "$TARGET" \
  -v ON_ERROR_STOP=1 -q -f /w/supabase/seed/demo_teardown.sql
