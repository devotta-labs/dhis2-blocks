#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib-docs.sh
source "$SCRIPT_DIR/lib-docs.sh"

docs_load_version "${1:-}"
e2e_require_command docker
docker compose version >/dev/null

# Destroy the docs stack including volumes, then bring up a freshly seeded
# instance. This is the "reset" counterpart to `docs:down`, which preserves
# data.
e2e_compose down --volumes --remove-orphans

"$SCRIPT_DIR/up.sh" "${1:-42}"
