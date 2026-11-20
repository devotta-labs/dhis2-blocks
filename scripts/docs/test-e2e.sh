#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib-docs.sh
source "$SCRIPT_DIR/lib-docs.sh"

docs_load_version "${1:-}"
if (($# > 0)); then shift; fi
e2e_require_command curl
e2e_require_command pnpm

DOCS_APP_PORT="${DOCS_PORT:-3002}"
export E2E_DHIS2_USERNAME="${E2E_DHIS2_USERNAME:-admin}"
export E2E_DHIS2_PASSWORD="${E2E_DHIS2_PASSWORD:-district}"
DOCS_APP_URL="${E2E_APP_URL:-http://localhost:${DOCS_APP_PORT}}"

cleanup() {
    local exit_code=$?
    trap - EXIT INT TERM

    if [[ "${KEEP_DOCS_STACK:-0}" != "1" ]]; then
        "$SCRIPT_DIR/down.sh" "$E2E_VERSION_SLUG" >/dev/null 2>&1 || true
    else
        echo "KEEP_DOCS_STACK=1; leaving $E2E_COMPOSE_PROJECT running."
    fi

    exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

"$SCRIPT_DIR/up.sh" "$E2E_VERSION_SLUG"

# The tests hit $DOCS_APP_URL exactly: without a free port the preview would
# silently move to the next one while a stale server keeps answering 3002.
e2e_assert_port_free "$DOCS_APP_PORT"

export E2E_VERSION_SLUG E2E_EXPECTED_MAJOR
export E2E_DHIS2_URL E2E_APP_URL
export DOCS_APP_URL
export DOCS_DHIS2_URL="$E2E_DHIS2_URL"
export DOCS_DHIS2_USERNAME="$E2E_DHIS2_USERNAME"
export DOCS_DHIS2_PASSWORD="$E2E_DHIS2_PASSWORD"

cd "$E2E_REPO_ROOT"
pnpm build:docs
pnpm exec playwright test --config playwright.docs.config.ts "$@"
