# Native custom functions — experimental build

The POC uses the real Kotlin expression parser and rules engine. The tarball in
`vendor/rule-engine` is an ESM build, not a JavaScript replacement for either engine.
No API/Core or Capture deployment changes are included.

## Rebuild

Requires JDK 21, Node and npm. From the repository root:

```sh
bash tools/rule-engine/build.sh
```

The script clones pinned upstream commits, applies the checked-in patches, runs
JVM regression tests and compiles the Kotlin/JS distribution. Normal installation
uses the checked-in tarball and does not require Java or Gradle. If Maven Central
is rate-limited, `GRADLE_MIRROR_INIT` can point to a Gradle repository-mirror init
script. This does not change the source or the runtime package.

The parser adds `custom:number`, `custom:string` and `custom:boolean` with a
restricted object-literal second argument. Objects are represented by an internal
AST function, preserving traversal of property value expressions. Duplicate keys
(including quoted/escaped equivalents) and prototype-related keys are rejected.
Only scalar values and nullable scalar results cross the dispatch boundary.

The engine adds an optional callback on its execution context. Blocks binds the
tracked-entity snapshot per evaluation; there is no global registry or context.
The original API remains usable without the callback. Callback failures are
reported by Blocks instead of silently accepting a partially evaluated row.

This is a POC package, not an upstream release. Do not publish this registry as a
production replacement until the extension API and package distribution are agreed.
