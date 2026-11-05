#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

validate_version() {
    local version="$1"
    e2e_load_version "$version"

    e2e_validate_database_url
    echo "$version: $DHIS2_IMAGE, $DHIS2_DB_DUMP_URL, ports $DHIS2_HTTP_PORT/$E2E_APP_PORT/$E2E_PROXY_PORT"
}

e2e_require_command curl
e2e_require_command docker
docker compose version >/dev/null

if (($# > 0)); then
    validate_version "$1"
else
    for version in 41 42 43 dev; do
        validate_version "$version"
    done
fi
