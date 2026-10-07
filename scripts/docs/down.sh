#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib-docs.sh
source "$SCRIPT_DIR/lib-docs.sh"

docs_load_version "${1:-}"
e2e_require_command docker
docker compose version >/dev/null

# Stop and remove the docs containers but keep the named volumes: the Sierra
# Leone dump and the database survive, so the next `docs:up` restarts quickly
# with its data (and any saved-list mutations) intact. Use `docs:reset` to
# destroy the volumes and re-seed.
e2e_compose down

echo "Docs DHIS2 $E2E_VERSION_SLUG stopped. Database volume kept."
