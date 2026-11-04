#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUILD="${RULE_ENGINE_BUILD_DIR:-$ROOT/.rule-engine-build}"
mkdir -p "$BUILD"
clone() {
    local name="$1" commit="$2"
    if [[ -e "$BUILD/$name" ]]; then
        echo "Build directory already exists: $BUILD/$name. Use a fresh RULE_ENGINE_BUILD_DIR." >&2
        exit 1
    fi
    git clone "https://github.com/dhis2/$name.git" "$BUILD/$name"
    git -C "$BUILD/$name" checkout "$commit"
    git -C "$BUILD/$name" apply "$ROOT/tools/rule-engine/$3.patch"
}
clone expression-parser 7aea30064df9cae21811c04d4820c4086571be68 expression-parser
clone dhis2-rule-engine ec24182867989febf3a90546641444fed5543a68 rule-engine
ARGS=(--max-workers=2 --console=plain)
if [[ -n "${GRADLE_MIRROR_INIT:-}" ]]; then ARGS+=(--init-script "$GRADLE_MIRROR_INIT"); fi
(cd "$BUILD/expression-parser" && ./gradlew jvmTest "${ARGS[@]}")
(cd "$BUILD/dhis2-rule-engine" && ./gradlew jvmTest jsProductionLibraryDistribution --include-build ../expression-parser "${ARGS[@]}")
node "$ROOT/tools/rule-engine/package.mjs" "$BUILD/dhis2-rule-engine" "$BUILD/expression-parser" "$BUILD/package"
