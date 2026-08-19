#!/usr/bin/env bash

set -euo pipefail

E2E_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly E2E_REPO_ROOT

# shellcheck source=./versions.sh
source "$E2E_REPO_ROOT/scripts/e2e/versions.sh"

e2e_require_command() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Required command is unavailable: $command_name" >&2
        return 69
    fi
}

e2e_validate_port() {
    local port="$1"
    if [[ ! "$port" =~ ^[0-9]+$ ]] || ((port < 1024 || port > 65535)); then
        echo "Invalid E2E port: $port" >&2
        return 64
    fi
}

e2e_assert_port_free() {
    local port="$1"
    e2e_validate_port "$port"

    if command -v lsof >/dev/null 2>&1; then
        if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
            echo "Port $port is already in use; refusing to select another port implicitly." >&2
            return 73
        fi
    elif command -v nc >/dev/null 2>&1; then
        if nc -z 127.0.0.1 "$port" >/dev/null 2>&1; then
            echo "Port $port is already in use; refusing to select another port implicitly." >&2
            return 73
        fi
    else
        echo "Neither lsof nor nc is available to verify port $port." >&2
        return 69
    fi
}

e2e_validate_database_url() {
    case "$DHIS2_DB_DUMP_URL" in
        https://databases.dhis2.org/sierra-leone/*/dhis2-db-sierra-leone.sql.gz) ;;
        *)
            echo "Refusing unexpected DHIS2 database URL: $DHIS2_DB_DUMP_URL" >&2
            return 64
            ;;
    esac

    curl --fail --silent --show-error --location --head \
        --retry 3 --connect-timeout 15 --max-time 60 \
        "$DHIS2_DB_DUMP_URL" >/dev/null
}

e2e_compose() {
    docker compose \
        --project-name "$E2E_COMPOSE_PROJECT" \
        --file "$E2E_REPO_ROOT/docker/e2e/compose.yml" \
        "$@"
}

e2e_artifact_dir() {
    local artifact_dir="$E2E_REPO_ROOT/e2e/artifacts/$E2E_VERSION_SLUG"
    mkdir -p "$artifact_dir"
    printf '%s\n' "$artifact_dir"
}
