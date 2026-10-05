#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# RUN THE PR-3 SQL VERIFICATION AGAINST A REAL DATABASE
#
#   bash supabase/checks/run-sql-tests.sh                     # the linked project
#   bash supabase/checks/run-sql-tests.sh "postgresql://…"    # an explicit URL
#
# There is no local `psql` on the build machine and `supabase` CLI v2.119 has
# no `query` subcommand, so the client comes from a throwaway Postgres image.
# The connection string is read from `supabase/.temp/pooler-url` (written by
# `supabase link`, gitignored) — it is NEVER echoed.
#
# ON_ERROR_STOP makes the script exit non-zero the moment an assertion raises,
# which is what makes this usable as a gate.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
TESTS="$ROOT/supabase/tests"

DB_URL="${1:-}"
if [[ -z "$DB_URL" ]]; then
  if [[ -f "$ROOT/supabase/.temp/pooler-url" ]]; then
    DB_URL="$(cat "$ROOT/supabase/.temp/pooler-url")"
  else
    echo "✗ no connection string given and supabase/.temp/pooler-url is missing (run: supabase link --project-ref <ref>)" >&2
    exit 2
  fi
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "✗ docker is required (it supplies the psql client)" >&2
  exit 2
fi

shopt -s nullglob
FILES=("$TESTS"/*.sql)
if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "· no SQL tests found in $TESTS — skipped"
  exit 0
fi

status=0
for f in "${FILES[@]}"; do
  echo "── $(basename "$f")"
  # -i so the file can be piped; -q quiet; ON_ERROR_STOP=1 fails fast
  if docker run --rm -i -e PGPASSWORD_UNUSED=1 postgres:17 \
       psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f - < "$f"; then
    echo "   ✓ passed"
  else
    echo "   ✗ FAILED"
    status=1
  fi
done

if [[ $status -eq 0 ]]; then
  echo "✓ all SQL verification files passed"
else
  echo "✗ SQL verification FAILED"
fi
exit $status
