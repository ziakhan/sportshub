#!/usr/bin/env bash
# Reseed the NPH demo world on the box. Owner-approved runs ONLY (CLAUDE.md
# production deploy policy — a reseed is a production DB write).
#
#   sudo /opt/sportshub/scripts/deploy/oracle-box/reseed-demo.sh [flags]
#
# Flags pass through to scripts/seed-nph-demo.ts (e.g. --purge-manual-leagues,
# --wipe, --report). --yes-prod is supplied here; the seeder still prints the
# target database before writing.
set -euo pipefail
set -a
. /etc/sportshub/web.env
set +a
cd /opt/sportshub
exec npx tsx scripts/seed-nph-demo.ts --yes-prod "$@"
