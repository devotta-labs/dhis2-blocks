#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

e2e_load_version "${1:-}"
e2e_require_command curl
e2e_require_command docker
e2e_require_command jq
e2e_require_command pnpm
e2e_require_command pgrep

app_pid=''
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

terminate_process_tree() {
    local pid="$1"
    local child_pid

    while IFS= read -r child_pid; do
        if [[ "$child_pid" =~ ^[0-9]+$ ]]; then
            terminate_process_tree "$child_pid"
        fi
    done < <(pgrep -P "$pid" 2>/dev/null || true)

    kill -TERM "$pid" >/dev/null 2>&1 || true
}

cleanup() {
    local exit_code=$?
    trap - EXIT INT TERM

    if [[ -n "$app_pid" ]] && kill -0 "$app_pid" >/dev/null 2>&1; then
        terminate_process_tree "$app_pid"
        wait "$app_pid" >/dev/null 2>&1 || true
    fi

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

artifact_dir="$(e2e_artifact_dir)"
app_log="$artifact_dir/app-server.log"

echo "Starting the app at $E2E_APP_URL with API proxy $E2E_PROXY_URL"
(
    cd "$E2E_REPO_ROOT"
    exec pnpm exec d2-app-scripts start \
        --port "$E2E_APP_PORT" \
        --proxy "$E2E_DHIS2_URL" \
        --proxyPort "$E2E_PROXY_PORT" \
        --host localhost
) >"$app_log" 2>&1 &
app_pid=$!

deadline=$((SECONDS + ${E2E_APP_STARTUP_TIMEOUT_SECONDS:-300}))
wait_for_app_resource() {
    local resource_name="$1"
    local resource_url="$2"

    echo "Waiting for app $resource_name at $resource_url ..."
    until curl --fail --silent --show-error --max-time 10 \
        "$resource_url" >/dev/null 2>&1; do
        if ! kill -0 "$app_pid" >/dev/null 2>&1; then
            echo "App server exited before $resource_name became ready. See $app_log" >&2
            exit 70
        fi
        if ((SECONDS >= deadline)); then
            echo "App $resource_name did not become ready at $resource_url. See $app_log" >&2
            exit 70
        fi
        sleep 2
    done
}

wait_for_app_resource "root" "$E2E_APP_URL"
# d2-app-scripts can serve the root before its generated D2App shell exists.
# Require both transformed entry modules so a first browser request cannot race
# shell generation and receive a transient Vite 500.
wait_for_app_resource \
    "generated shell module" \
    "$E2E_APP_URL/src/D2App/AppWrapper.tsx"
wait_for_app_resource "application module" "$E2E_APP_URL/src/App.jsx"

export E2E_VERSION_SLUG E2E_EXPECTED_MAJOR E2E_DHIS2_URL E2E_APP_URL E2E_PROXY_URL
export E2E_DHIS2_USERNAME="${E2E_DHIS2_USERNAME:-admin}"
export E2E_DHIS2_PASSWORD="${E2E_DHIS2_PASSWORD:-district}"

cd "$E2E_REPO_ROOT"
pnpm exec playwright test
