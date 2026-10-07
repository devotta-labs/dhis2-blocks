#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib-docs.sh
source "$SCRIPT_DIR/lib-docs.sh"

docs_load_version "${1:-}"
e2e_require_command curl
e2e_require_command pgrep
e2e_require_command pnpm

DOCS_APP_PORT="${DOCS_PORT:-3002}"
DOCS_APP_URL="${E2E_APP_URL:-http://localhost:${DOCS_APP_PORT}}"

docs_pid=''

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

    if [[ -n "$docs_pid" ]] && kill -0 "$docs_pid" >/dev/null 2>&1; then
        terminate_process_tree "$docs_pid"
        wait "$docs_pid" >/dev/null 2>&1 || true
    fi

    if [[ "${KEEP_DOCS_STACK:-0}" != "1" ]]; then
        "$SCRIPT_DIR/down.sh" "${1:-42}" >/dev/null 2>&1 || true
    else
        echo "KEEP_DOCS_STACK=1; leaving $E2E_COMPOSE_PROJECT running."
    fi

    exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

"$SCRIPT_DIR/up.sh" "${1:-42}"

artifact_dir="$(e2e_artifact_dir)"
docs_log="$artifact_dir/docs-server.log"

echo "Building and serving the documentation site at $DOCS_APP_URL"
(
    cd "$E2E_REPO_ROOT/apps/docs"
    pnpm build
    exec env "DOCS_DHIS2_URL=$E2E_DHIS2_URL" pnpm preview --port "$DOCS_APP_PORT" --host localhost
) >"$docs_log" 2>&1 &
docs_pid=$!

deadline=$((SECONDS + ${DOCS_APP_STARTUP_TIMEOUT_SECONDS:-300}))
until curl --fail --silent --show-error --max-time 10 "$DOCS_APP_URL" >/dev/null 2>&1; do
    if ! kill -0 "$docs_pid" >/dev/null 2>&1; then
        echo "Docs server exited before becoming ready. See $docs_log" >&2
        exit 70
    fi

    if ((SECONDS >= deadline)); then
        echo "Docs server did not become ready at $DOCS_APP_URL. See $docs_log" >&2
        exit 70
    fi

    sleep 2
done

export E2E_VERSION_SLUG E2E_EXPECTED_MAJOR
export E2E_DHIS2_URL E2E_APP_URL
export DOCS_APP_URL
export E2E_DHIS2_USERNAME="${E2E_DHIS2_USERNAME:-admin}"
export E2E_DHIS2_PASSWORD="${E2E_DHIS2_PASSWORD:-district}"

cd "$E2E_REPO_ROOT"
pnpm exec playwright test --config playwright.docs.config.ts
