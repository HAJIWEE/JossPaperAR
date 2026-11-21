#!/usr/bin/env bash
# SCRUM-198 — the ONE documented command: empty DB → the demo family.
# ⚠️ The guard runs FIRST (SCRUM-199) and exits 2 unless the target is the local
# stack or is named in SEED_ALLOW_TARGETS.
set -euo pipefail
cd "$(dirname "$0")/../.."

TARGET="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

node supabase/checks/seed-guard.ts --target "$TARGET"

docker run --rm -i --network host \
  -v "$PWD/supabase:/w/supabase:ro" \
  postgres:17 psql "$TARGET" \
  -v ON_ERROR_STOP=1 -q -f /w/supabase/seed/demo_seed.sql
