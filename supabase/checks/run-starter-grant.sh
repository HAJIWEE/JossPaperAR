#!/usr/bin/env bash
# SCRUM-157 — give ONE named account the starter inventory, so the acceptance gate can run on
# the phone the owner already has.
#
# ⚠️⚠️ **NO CREDENTIAL PASSES THROUGH ANYONE ELSE: the operator runs this, in their own shell.**
# The target is a Postgres URL (a DB password, NOT a service-role key — this script writes SQL
# rows directly, it never calls the Admin API).
#
# ⚠️ The SAME guard as the demo seed runs FIRST (SCRUM-199): it refuses the hosted project
# unless its ref is named in SEED_ALLOW_TARGETS, and it refuses an unrecognised target rather
# than assuming local. Fault-tested against the real ref → exit 2.
#
# USAGE
#   # local stack (default):
#   npm run seed:starter -- someone@example.com
#
#   # hosted, naming the project on purpose:
#   SEED_ALLOW_TARGETS=yercgevebxvtzkgctfai \
#   TARGET='postgresql://postgres:<db-password>@<host>:5432/postgres' \
#   npm run seed:starter -- your@account.email
#
# ⚠️ `--` is required: without it npm swallows the email as an npm flag.
# ⚠️ The password in TARGET is visible to `ps` on this machine while the command runs. If that
#    matters, put it in a `.pgpass`/`PGPASSFILE` or run the psql line yourself.
set -euo pipefail
cd "$(dirname "$0")/../.."

TARGET="${TARGET:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
EMAIL="${1:-}"

if [ -z "$EMAIL" ]; then
  cat >&2 <<'USAGE'
STARTER GRANT — usage error

  npm run seed:starter -- <account-email>

⚠️ The account must ALREADY EXIST: sign in once in the app, then run this.
⚠️ For hosted, set TARGET (a Postgres URL) and name the project in SEED_ALLOW_TARGETS,
   or the guard refuses.
USAGE
  exit 2
fi

node supabase/checks/seed-guard.ts --target "$TARGET"

docker run --rm -i --network host \
  -v "$PWD/supabase:/w/supabase:ro" \
  postgres:17 psql "$TARGET" \
  -v ON_ERROR_STOP=1 -q \
  -v email="$EMAIL" \
  -f /w/supabase/seed/starter_grant.sql
