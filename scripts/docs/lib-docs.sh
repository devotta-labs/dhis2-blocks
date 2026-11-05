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
    e2e_load_version "${1:-42}" docs
}
