#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# RUN THE CLAN-API CONTRACT TEST AGAINST THE LOCAL STACK
#
#   npx supabase start          # free, no account, applies the migrations
#   npm run check:clanapi
#
# Extracts the local API URL and anon key from `supabase status` (the keys are
# the stack's documented development defaults — never a real project secret) and
# hands them to the Node test. It then CLEANS UP the rows it created, because a
# contract test that leaves clans behind makes the next run's counts wrong.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

ENVOUT="$(cd "$ROOT" && npx supabase status -o env 2>/dev/null || true)"
SUPABASE_URL="$(printf '%s' "$ENVOUT" | sed -n 's/^API_URL="\(.*\)"$/\1/p')"
SUPABASE_ANON_KEY="$(printf '%s' "$ENVOUT" | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')"

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_ANON_KEY" ]]; then
  echo "✗ the local stack is not running — start it with: npx supabase start" >&2
  exit 2
fi

cd "$ROOT"
SUPABASE_URL="$SUPABASE_URL" SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  node supabase/checks/clan-api-contract.mjs
