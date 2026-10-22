#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib-docs.sh
source "$SCRIPT_DIR/lib-docs.sh"

docs_load_version "${1:-}"
e2e_require_command curl
e2e_require_command docker
e2e_require_command jq
docker compose version >/dev/null

# Only `dhis2` counts as "running": the database service can stay up from a
# previous run while the app is stopped, and it still needs starting.
if e2e_compose ps --status running --quiet dhis2 2>/dev/null | grep -q .; then
    echo "Docs DHIS2 stack is already running at $E2E_DHIS2_URL"
    exit 0
fi

e2e_assert_port_free "$DHIS2_HTTP_PORT"
e2e_validate_database_url

echo "Starting docs DHIS2 $E2E_VERSION_SLUG on $E2E_DHIS2_URL"
e2e_compose up --detach database-download database dhis2
"$E2E_REPO_ROOT/scripts/e2e/wait-for-dhis2.sh" "$E2E_VERSION_SLUG"
"$E2E_REPO_ROOT/scripts/e2e/seed-metadata.sh" "$E2E_VERSION_SLUG"

echo "Docs DHIS2 $E2E_VERSION_SLUG is seeded and ready."
echo "Start the documentation site with: pnpm dev:docs"
