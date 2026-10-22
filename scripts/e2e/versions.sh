#!/usr/bin/env bash

# This file is sourced by the E2E lifecycle scripts. Keep the moving major tags
# deliberate: the matrix verifies the latest maintenance release for each
# supported major, plus the current development build.

e2e_load_version() {
    local requested_version="${1:-}"

    case "$requested_version" in
        41)
            E2E_VERSION_SLUG="41"
            E2E_EXPECTED_MAJOR="41"
            DHIS2_IMAGE="dhis2/core:2.41"
            DHIS2_DB_DUMP_URL="https://databases.dhis2.org/sierra-leone/2.41/dhis2-db-sierra-leone.sql.gz"
            DHIS2_HTTP_PORT="${DHIS2_HTTP_PORT:-${DHIS2_E2E_PORT_41:-58441}}"
            E2E_APP_PORT="${E2E_APP_PORT:-${DHIS2_E2E_APP_PORT_41:-59441}}"
            E2E_PROXY_PORT="${E2E_PROXY_PORT:-${DHIS2_E2E_PROXY_PORT_41:-60441}}"
            ;;
        42)
            E2E_VERSION_SLUG="42"
            E2E_EXPECTED_MAJOR="42"
            DHIS2_IMAGE="dhis2/core:2.42"
            DHIS2_DB_DUMP_URL="https://databases.dhis2.org/sierra-leone/2.42/dhis2-db-sierra-leone.sql.gz"
            DHIS2_HTTP_PORT="${DHIS2_HTTP_PORT:-${DHIS2_E2E_PORT_42:-58442}}"
            E2E_APP_PORT="${E2E_APP_PORT:-${DHIS2_E2E_APP_PORT_42:-59442}}"
            E2E_PROXY_PORT="${E2E_PROXY_PORT:-${DHIS2_E2E_PROXY_PORT_42:-60442}}"
            ;;
        43)
            E2E_VERSION_SLUG="43"
            E2E_EXPECTED_MAJOR="43"
            DHIS2_IMAGE="dhis2/core:2.43"
            DHIS2_DB_DUMP_URL="https://databases.dhis2.org/sierra-leone/2.43/dhis2-db-sierra-leone.sql.gz"
            DHIS2_HTTP_PORT="${DHIS2_HTTP_PORT:-${DHIS2_E2E_PORT_43:-58443}}"
            E2E_APP_PORT="${E2E_APP_PORT:-${DHIS2_E2E_APP_PORT_43:-59443}}"
            E2E_PROXY_PORT="${E2E_PROXY_PORT:-${DHIS2_E2E_PROXY_PORT_43:-60443}}"
            ;;
        dev)
            E2E_VERSION_SLUG="dev"
            E2E_EXPECTED_MAJOR="dev"
            DHIS2_IMAGE="dhis2/core-dev:latest"
            DHIS2_DB_DUMP_URL="https://databases.dhis2.org/sierra-leone/dev/dhis2-db-sierra-leone.sql.gz"
            DHIS2_HTTP_PORT="${DHIS2_HTTP_PORT:-${DHIS2_E2E_PORT_DEV:-58444}}"
            E2E_APP_PORT="${E2E_APP_PORT:-${DHIS2_E2E_APP_PORT_DEV:-59444}}"
            E2E_PROXY_PORT="${E2E_PROXY_PORT:-${DHIS2_E2E_PROXY_PORT_DEV:-60444}}"
            ;;
        *)
            echo "Usage: $0 <41|42|43|dev>" >&2
            return 64
            ;;
    esac

    E2E_COMPOSE_PROJECT="${E2E_COMPOSE_PROJECT:-working-list-e2e-${E2E_VERSION_SLUG}}"
    E2E_DHIS2_URL="${E2E_DHIS2_URL:-http://127.0.0.1:${DHIS2_HTTP_PORT}}"
    # The app-platform development proxy emits CORS headers for localhost.
    # Keep the DHIS2 container host-only, while using that canonical browser
    # origin for the shell and proxy.
    E2E_APP_URL="${E2E_APP_URL:-http://localhost:${E2E_APP_PORT}}"
    E2E_PROXY_URL="${E2E_PROXY_URL:-http://localhost:${E2E_PROXY_PORT}}"

    export E2E_VERSION_SLUG E2E_EXPECTED_MAJOR E2E_COMPOSE_PROJECT
    export DHIS2_IMAGE DHIS2_DB_DUMP_URL DHIS2_HTTP_PORT
    export E2E_APP_PORT E2E_PROXY_PORT
    export E2E_DHIS2_URL E2E_APP_URL E2E_PROXY_URL
}
