#!/usr/bin/env bash

# Keep moving major tags deliberate: the matrix verifies the latest maintenance
# release for each supported major, plus the current development build.

e2e_capture_overrides() {
    if [[ "${E2E_INPUTS_CAPTURED:-0}" == 1 ]]; then return; fi

    # Outputs keep their documented names for Compose and Playwright. Snapshot
    # caller inputs separately so resolving a second lane never reuses outputs.
    local name
    for name in DHIS2_HTTP_PORT E2E_APP_PORT E2E_PROXY_PORT E2E_COMPOSE_PROJECT \
        E2E_DHIS2_URL E2E_APP_URL E2E_PROXY_URL; do
        export "E2E_INPUT_${name}=${!name:-}"
    done
    export E2E_INPUTS_CAPTURED=1
}

e2e_validate_port() {
    local port="$1"
    if [[ ! "$port" =~ ^[0-9]{1,5}$ ]] || ((10#$port < 1024 || 10#$port > 65535)); then
        echo "Invalid E2E port: $port" >&2
        return 64
    fi
}

e2e_load_version() {
    local requested_version="${1:-}"
    local profile="${2:-${E2E_RESOLVED_PROFILE:-e2e}}"
    local http_port app_port proxy_port image dump_version version_key project app_url

    if [[ "${E2E_RESOLVED_VERSION:-}" == "$requested_version" &&
        "${E2E_RESOLVED_PROFILE:-}" == "$profile" && -n "$requested_version" ]]; then
        return
    fi

    case "$requested_version" in
        41|42|43)
            version_key="$requested_version"
            image="dhis2/core:2.${requested_version}"
            dump_version="2.${requested_version}"
            http_port="584${requested_version}"
            app_port="594${requested_version}"
            proxy_port="604${requested_version}"
            ;;
        dev)
            version_key=DEV
            image="dhis2/core-dev:latest"
            dump_version=dev
            http_port=58444
            app_port=59444
            proxy_port=60444
            ;;
        *)
            echo "Usage: $0 <41|42|43|dev>" >&2
            return 64
            ;;
    esac

    e2e_capture_overrides
    local http_override="DHIS2_E2E_PORT_${version_key}"
    local app_override="DHIS2_E2E_APP_PORT_${version_key}"
    local proxy_override="DHIS2_E2E_PROXY_PORT_${version_key}"
    http_port="${E2E_INPUT_DHIS2_HTTP_PORT:-${!http_override:-$http_port}}"
    app_port="${E2E_INPUT_E2E_APP_PORT:-${!app_override:-$app_port}}"
    proxy_port="${E2E_INPUT_E2E_PROXY_PORT:-${!proxy_override:-$proxy_port}}"

    case "$profile" in
        e2e)
            project="${E2E_INPUT_E2E_COMPOSE_PROJECT:-working-list-e2e-${requested_version}}"
            app_url="${E2E_INPUT_E2E_APP_URL:-http://localhost:${app_port}}"
            ;;
        docs)
            # Docs owns a persistent project and backend/site ports, independent
            # of web lane overrides. Its children inherit these resolved values.
            project="${DOCS_COMPOSE_PROJECT:-dhis2-blocks-docs}-${requested_version}"
            http_port="${DOCS_DHIS2_PORT:-58080}"
            app_port="${DOCS_PORT:-3002}"
            app_url="http://localhost:${app_port}"
            ;;
        *)
            echo "Invalid backend profile: $profile" >&2
            return 64
            ;;
    esac

    e2e_validate_port "$http_port" || return $?
    e2e_validate_port "$app_port" || return $?
    e2e_validate_port "$proxy_port" || return $?
    if ((10#$http_port == 10#$app_port ||
        10#$http_port == 10#$proxy_port ||
        10#$app_port == 10#$proxy_port)); then
        echo "Version $requested_version has colliding configured ports." >&2
        return 73
    fi

    E2E_VERSION_SLUG="$requested_version"
    E2E_EXPECTED_MAJOR="$requested_version"
    E2E_COMPOSE_PROJECT="$project"
    DHIS2_HTTP_PORT="$http_port"
    E2E_APP_PORT="$app_port"
    E2E_PROXY_PORT="$proxy_port"
    E2E_APP_URL="$app_url"
    DHIS2_IMAGE="$image"
    DHIS2_DB_DUMP_URL="https://databases.dhis2.org/sierra-leone/${dump_version}/dhis2-db-sierra-leone.sql.gz"
    E2E_DHIS2_URL="${E2E_INPUT_E2E_DHIS2_URL:-http://127.0.0.1:${DHIS2_HTTP_PORT}}"
    # The app-platform proxy emits CORS headers for localhost, while DHIS2's
    # container is host-only. Keep this canonical browser origin for the shell.
    E2E_PROXY_URL="${E2E_INPUT_E2E_PROXY_URL:-http://localhost:${E2E_PROXY_PORT}}"

    export E2E_VERSION_SLUG E2E_EXPECTED_MAJOR E2E_COMPOSE_PROJECT
    export DHIS2_IMAGE DHIS2_DB_DUMP_URL DHIS2_HTTP_PORT
    export E2E_APP_PORT E2E_PROXY_PORT E2E_DHIS2_URL E2E_APP_URL E2E_PROXY_URL
    export E2E_RESOLVED_VERSION="$requested_version" E2E_RESOLVED_PROFILE="$profile"
}
