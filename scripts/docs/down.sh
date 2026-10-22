#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib-docs.sh
source "$SCRIPT_DIR/lib-docs.sh"

e2e_require_command docker
docker compose version >/dev/null

# Stop and remove the docs containers but keep the named volumes: the Sierra
# Leone dump and the database survive, so the next `docs:up` restarts quickly
# with its data (and any saved-list mutations) intact. Use `docs:reset` to
# destroy the volumes and re-seed. Without an argument every docs lane is
# torn down — each lane has its own Compose project, so a versioned
# `docs:up:<v>` is not stopped by the default lane's project.
docs_down() {
    docs_load_version "$1"
    e2e_compose down
    echo "Docs DHIS2 $E2E_VERSION_SLUG stopped. Database volume kept."
}

if (($# > 0)); then
    docs_down "$1"
else
    for version in 41 42 43 dev; do
        # Subshell per lane: the loader only fills unset variables.
        ( docs_down "$version" )
    done
fi
