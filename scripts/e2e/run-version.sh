#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

e2e_load_version "${1:-}"
shift
e2e_require_command curl
e2e_require_command docker
e2e_require_command jq
e2e_require_command pnpm

app_shell_lock_acquired=0
app_shell_lock_dir="$E2E_REPO_ROOT/.d2/e2e-app-shell.lock"
stack_started=0

acquire_app_shell_lock() {
    mkdir -p "$E2E_REPO_ROOT/.d2"

    if ! mkdir "$app_shell_lock_dir" 2>/dev/null; then
        local owner='unknown owner'
        if [[ -r "$app_shell_lock_dir/owner" ]]; then
            owner="$(<"$app_shell_lock_dir/owner")"
        fi
        echo "Cannot start DHIS2 $E2E_VERSION_SLUG E2E: the shared d2 app shell is locked by $owner." >&2
        echo "Wait for the other local E2E lane to finish before retrying." >&2
        exit 73
    fi

    app_shell_lock_acquired=1
    printf 'PID %s (DHIS2 %s)\n' "$$" "$E2E_VERSION_SLUG" >"$app_shell_lock_dir/owner"
}

cleanup() {
    local exit_code=$?
    trap - EXIT INT TERM

    if [[ "$stack_started" == "1" ]]; then
        if [[ "${KEEP_E2E_STACK:-0}" == "1" ]]; then
            echo "KEEP_E2E_STACK=1; leaving $E2E_COMPOSE_PROJECT running."
        else
            "$SCRIPT_DIR/down.sh" "$E2E_VERSION_SLUG" || true
        fi
    fi

    if [[ "$app_shell_lock_acquired" == "1" ]]; then
        rm -f "$app_shell_lock_dir/owner"
        rmdir "$app_shell_lock_dir" 2>/dev/null || true
    fi

    exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

acquire_app_shell_lock
e2e_assert_port_free "$E2E_APP_PORT"
e2e_assert_port_free "$E2E_PROXY_PORT"
stack_started=1
"$SCRIPT_DIR/up.sh" "$E2E_VERSION_SLUG"

export E2E_VERSION_SLUG E2E_EXPECTED_MAJOR E2E_DHIS2_URL E2E_APP_URL E2E_PROXY_URL
export E2E_DHIS2_USERNAME="${E2E_DHIS2_USERNAME:-admin}"
export E2E_DHIS2_PASSWORD="${E2E_DHIS2_PASSWORD:-district}"

cd "$E2E_REPO_ROOT"
pnpm exec playwright test "$@"
