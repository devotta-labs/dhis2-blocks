#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

e2e_load_version "${1:-}"
e2e_require_command curl
e2e_require_command docker
e2e_require_command jq
docker compose version >/dev/null

e2e_assert_port_free "$DHIS2_HTTP_PORT"
e2e_validate_database_url

echo "Starting isolated DHIS2 $E2E_VERSION_SLUG on $E2E_DHIS2_URL"
e2e_compose up --detach database-download database dhis2
"$SCRIPT_DIR/wait-for-dhis2.sh" "$E2E_VERSION_SLUG"
"$SCRIPT_DIR/seed-metadata.sh" "$E2E_VERSION_SLUG"

echo "DHIS2 $E2E_VERSION_SLUG is seeded and ready."
