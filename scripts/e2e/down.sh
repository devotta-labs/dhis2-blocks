#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

e2e_load_version "${1:-}"

artifact_dir="$(e2e_artifact_dir)"
e2e_compose logs --no-color >"$artifact_dir/docker-compose.log" 2>&1 || true
e2e_compose down --volumes --remove-orphans --timeout 30
