#!/usr/bin/env bash

# Shared setup for the docs DHIS2 stack.
#
# The docs instance deliberately uses its own Compose project and ports so the
# E2E lanes (scripts/e2e/*) can never stop, remove, or reseed it. It reuses the
# same compose file, version table, readiness check, and seed definitions.

DOCS_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly DOCS_REPO_ROOT

# shellcheck source=../e2e/lib.sh
source "$DOCS_REPO_ROOT/scripts/e2e/lib.sh"

docs_load_version() {
    local requested_version="${1:-42}"

    # Distinct lifecycle: a separate Compose project per version, and ports that
    # cannot collide with any e2e lane. Export before loading so versions.sh
    # keeps them (it only fills unset values).
    export E2E_COMPOSE_PROJECT="${DOCS_COMPOSE_PROJECT:-dhis2-blocks-docs}-${requested_version}"
    export DHIS2_HTTP_PORT="${DOCS_DHIS2_PORT:-58080}"
    export E2E_APP_URL="http://localhost:${DOCS_PORT:-3002}"

    e2e_load_version "$requested_version"
}
