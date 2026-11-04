#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUILD="${RULE_ENGINE_BUILD_DIR:-$ROOT/.rule-engine-build}"
mkdir -p "$BUILD"
clone() {
    local name="$1" commit="$2"
    if [[ ! -d "$BUILD/$name" ]]; then
        git clone "https://github.com/dhis2/$name.git" "$BUILD/$name"
        git -C "$BUILD/$name" checkout "$commit"
        git -C "$BUILD/$name" apply "$ROOT/tools/rule-engine/$3.patch"
    fi
}
clone expression-parser 5c687dad92ce1464297e51488c33ab50f16ff4ae expression-parser
clone dhis2-rule-engine e10da5dfb8fadad7dcb8d8012b44e85be953b171 rule-engine
ARGS=(--max-workers=2 --console=plain)
if [[ -n "${GRADLE_MIRROR_INIT:-}" ]]; then ARGS+=(--init-script "$GRADLE_MIRROR_INIT"); fi
(cd "$BUILD/expression-parser" && ./gradlew jvmTest "${ARGS[@]}")
(cd "$BUILD/dhis2-rule-engine" && ./gradlew jvmTest jsProductionLibraryDistribution --include-build ../expression-parser "${ARGS[@]}")
node "$ROOT/tools/rule-engine/package.mjs" "$BUILD/dhis2-rule-engine" "$BUILD/expression-parser" "$BUILD/package"
