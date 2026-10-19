# Shared UI Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Working List's DHIS2-styled shadcn primitives into a shared `@dhis2-blocks/ui` workspace package and per-primitive registry items, with a namespaced theme that no longer restyles the host app, so the coming `event-form` block can share them.

**Architecture:** Primitives move (with `git mv`) to `packages/blocks/ui/src/`. Each file becomes one `registry:ui` item installing into `@components/dhis2/ui/`. Blocks import them as `@/registry/dhis2/ui/<file>`. That specifier is the one the shadcn installer rewrites to the installed location (verified on shadcn 4.22.1), and in this repo it resolves through TS `paths` and a Vite alias. All DHIS2 design tokens get a `dhis2` namespace, so installing a block never overrides the host's Tailwind palette, radii or semantic colors. An install check builds the registry, installs the blocks into a throwaway consumer app and asserts all of this end to end.

**Tech Stack:** pnpm workspaces, Turborepo, TypeScript, Tailwind v4, shadcn CLI 4.22.x registry, Base UI, Vitest (node + browser), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-10-19-event-form-design.md` (§6, §6.1)

## Global Constraints

- Branch: `jc/feat/event-form` (based on `jc/feat/working-list-shadcn-primitives`).
- **Never commit without the user's explicit OK.** Each "Commit" step means: stage, show the message, and ask.
- Primitives keep standard shadcn file and export names; they install to `@components/dhis2/ui/<file>`, never `components/ui/`.
- Cross-item `registryDependencies` use GitHub addresses: `devotta-labs/dhis2-blocks/<item>`.
- Every design token is namespaced: `--color-dhis2-*`, `--radius-dhis2-*`, `--shadow-dhis2-*`, `--font-dhis2`, `--dhis2-field-height-dense`. No `--color-*: initial` reset anywhere.
- `white` and `black` stay stock Tailwind colors (identical values).
- Existing quality gates stay green: `pnpm typecheck`, `pnpm lint`, `pnpm dead-code:audit`, `pnpm test`, `pnpm build`, `pnpm e2e:43`.
- Node 22 in CI: run TypeScript tools with `node --experimental-strip-types`.
- No visual change in `apps/web` or Working List.

## Review Focus

1. **Portalled popups lose styling**: Select, Combobox, Popover, Dropdown, Dialog, Tooltip render outside the block root. With namespaced utilities they must look the same; covered by Task 3's before/after screenshots of an open select and dialog.
2. **The host's own Tailwind colors change after install**: a host `bg-blue-500` must still compile to Tailwind's default blue. Pinned in Task 1's install check.
3. **A primitive installed alone is missing a sibling** (e.g. `combobox` needs `checkbox`, `input-group`, `select`). Pinned by Task 4's manifest test, which derives `registryDependencies` from imports.
4. **A token utility missed by the rename** silently renders unstyled, because Tailwind just drops unknown classes. Pinned by Task 3's source scan test.
5. **`theme.css` and the registry `cssVars` drift apart**: the repo looks right but installs look wrong. Pinned by Task 4's generator equality test.

---

### Task 1: Install check harness (fails until Task 5)

**Files:**
- Create: `tools/registry/installCheck.ts`
- Create: `tools/registry/consumer/` (template: `package.json`, `tsconfig.json`, `components.json`, `index.html`, `vite.config.ts`, `src/index.css`, `src/main.tsx`, `src/host.tsx`)
- Modify: `package.json` (root script `"registry:check": "node --experimental-strip-types tools/registry/installCheck.ts"`)
- Modify: `.github/workflows/verify.yml` (new job `registry` running `pnpm install --frozen-lockfile` then `pnpm registry:check`)
- Modify: `knip.json` (root workspace `project` already covers `tools/**/*.ts`; add `tools/registry/consumer/**` to `ignore`)

**Interfaces:**
- Produces: `pnpm registry:check`, which exits 0 only if every assertion below holds. Later tasks use it as their end-to-end gate.

- [ ] **Step 1: Write the consumer template**

`components.json` aliases: `components: "@/components"`, `ui: "@/components/ui"`, `lib: "@/lib"`, `hooks: "@/hooks"`, `utils: "@/lib/utils"`; `tailwind.css: "src/index.css"`; no `registries` entry. `src/index.css` is `@import "tailwindcss";` plus `@source "./";`. `src/host.tsx` renders `<div className="bg-blue-500 rounded-sm" data-testid="host" />`. `src/main.tsx` imports `WorkingList` from `@/components/working-list` and `ContextSelector` from `@/components/context-selector` and renders both (type-level use is enough; it is never run).

- [ ] **Step 2: Write `installCheck.ts`**

In order, failing fast with a clear message per assertion:
1. `shadcn@4.22.1 build registry.json --output <tmp>/r`.
2. Rewrite every `devotta-labs/dhis2-blocks/<name>` string in `<tmp>/r/*.json` to `http://127.0.0.1:<port>/<name>.json`, then serve `<tmp>/r` with `node:http` on a free port.
3. Copy the consumer template to `<tmp>/app`, `pnpm install`, then `shadcn@4.22.1 add http://127.0.0.1:<port>/working-list.json http://127.0.0.1:<port>/context-selector.json -y`.
4. Assert `src/components/ui/` does not exist.
5. Assert every file under `src/components/dhis2/ui/` is listed by the built ui items (no strays).
6. Assert `src/index.css` contains no `--color-*: initial` and no un-namespaced `--color-(grey|blue|teal|red|yellow|green)-\d{3}`, `--color-primary`, `--radius-(sm|md|lg)` or `--shadow-(popover|card)` declarations.
7. Assert no installed file imports `@/registry/`.
8. `pnpm exec tsc --noEmit` passes.
9. `pnpm exec vite build` passes, and the emitted CSS contains `.bg-blue-500` with Tailwind's default value (`oklch(62.3% .214 259.815)`, or whatever the installed Tailwind's default is: read it from `node_modules/tailwindcss/theme.css` rather than hard-coding it) and a `.bg-dhis2-primary` rule with `#1565c0`.

- [ ] **Step 3: Run it on the current tree**

Run: `pnpm registry:check`
Expected: FAIL at assertion 6 (the current Working List item installs `--color-*: initial` and un-namespaced palette tokens). Assertions 1–3 must pass; if they don't, fix the harness, not the blocks.

- [ ] **Step 4: Commit** (ask first)

```bash
git add tools/registry package.json .github/workflows/verify.yml knip.json
git commit -m "test: add a registry install check against a throwaway consumer app"
```

### Task 2: `@dhis2-blocks/ui` workspace package

**Files:**
- Move: `packages/blocks/working-list/src/ui/primitives/*` → `packages/blocks/ui/src/` (`git mv`; delete `index.ts`)
- Create: `packages/blocks/ui/package.json`, `tsconfig.json`, `tsconfig.test.json`, `vitest.config.ts` (copy Working List's, browser project only), `test/setup.ts`, `test/styles.css`
- Modify: every Working List file importing `../primitives/...` or `../../../primitives/...` (22 specifiers across ~25 files) to `@/registry/dhis2/ui/<file>`
- Modify: `packages/blocks/working-list/tsconfig.json` (`baseUrl: "."`, `paths: { "@/registry/dhis2/ui/*": ["../ui/src/*"] }`), `tsconfig.test.json` likewise, `vitest.config.ts` (`resolve.alias` for the same prefix), `test/styles.css` (import `../../ui/src/theme.css`; add `@source '../../ui/src';`)
- Modify: `packages/blocks/working-list/package.json` (remove `./primitives` and `./theme.css` exports; add `"@dhis2-blocks/ui": "workspace:*"` to devDependencies)
- Modify: `packages/blocks/working-list/registry.json`: remove the 24 `src/ui/primitives/*` file entries now, so `shadcn build` keeps working. Task 5 adds the replacement `registryDependencies`. Until then the install check fails, as expected.
- Modify: `apps/web/vitest.config.ts`: the same `resolve.alias`, since app tests compile Working List source.
- Modify: `apps/web` imports of `@dhis2-blocks/working-list/primitives` (7 files) to per-file `@dhis2-blocks/ui/<file>`; `apps/web/src/index.css` to `@import '@dhis2-blocks/ui/theme.css';` and add `@source` for `../../packages/blocks/ui/src`; `apps/web/vite.config.mts` (`resolve.alias` `@/registry/dhis2/ui` → `packages/blocks/ui/src`); `apps/web/tsconfig.json` paths; `apps/web/package.json` dependency `"@dhis2-blocks/ui": "workspace:*"`
- Modify: `knip.json` (`packages/blocks/ui` workspace: entry `src/*.{ts,tsx}`, `includeEntryExports: false`, same test/type-test ignores as the other blocks; drop `src/ui/primitives/**` ignore from the blocks glob)

**Interfaces:**
- Produces: package `@dhis2-blocks/ui` with explicit exports `"./<file>": "./src/<file>.tsx"` (or `.ts` for `cn`, `portal-root`) for each of the 23 primitive files, plus `"./theme.css": "./src/theme.css"`. Dependencies: `@base-ui/react ^1.9.0`, `@dhis2/ui-icons ^10.17.0`, `class-variance-authority ^0.7.1`, `clsx ^2.1.1`, `tailwind-merge ^3.7.0`; peers `react`/`react-dom ^18.3.1`.
- Produces: in-repo specifier `@/registry/dhis2/ui/<file>` resolving to `packages/blocks/ui/src/<file>` in Working List (tsc, vitest) and `apps/web` (tsc, Vite/d2 build).

- [ ] **Step 1: Move files and wire the package** as listed.

- [ ] **Step 2: Rewrite imports**

Run: `grep -rn "primitives" packages/blocks/working-list/src apps/web/src`
Expected: no matches.

- [ ] **Step 3: Verify the tree**

Run: `pnpm install && pnpm typecheck && pnpm lint && pnpm dead-code:audit && pnpm test && pnpm build && pnpm dlx shadcn@4.22.1 build registry.json --output /tmp/r-check`
Expected: all pass. If the d2 app build ignores `vite.config.mts` aliases, put the alias where the platform reads it and note that in the commit message.

- [ ] **Step 4: Commit** (ask first)

```bash
git commit -m "refactor: move working list primitives into a shared ui package"
```

### Task 3: Namespace the theme

**Files:**
- Modify: `packages/blocks/ui/src/theme.css`
- Modify: class names in `packages/blocks/ui/src/*.tsx`, `packages/blocks/working-list/src/**/*.tsx`, `apps/web/src/**/*.tsx` (~245 token utilities in ~24 files)
- Create: `packages/blocks/ui/src/theme.test.ts`

**Interfaces:**
- Produces: utilities `bg-dhis2-primary`, `text-dhis2-grey-700`, `border-dhis2-input`, `ring-dhis2-ring`, `rounded-dhis2-sm`, `shadow-dhis2-popover`, `font-dhis2`, `min-h-(--dhis2-field-height-dense)` and so on. Later blocks use these names.

- [ ] **Step 1: Write the failing tests** in `theme.test.ts` (node project):

```ts
test('every theme token is namespaced', () => {
    const tokens = readThemeTokens()            // names declared inside @theme in theme.css
    expect(tokens.length).toBeGreaterThan(80)
    for (const name of tokens) expect(name).toMatch(/^--(color|radius|shadow|font)-dhis2(-|$)|^--dhis2-/)
})
test('theme does not reset the host palette', () => {
    expect(readThemeCss()).not.toMatch(/--color-\*\s*:\s*initial/)
})
test('no block or app source uses an un-namespaced DHIS2 token utility', () => {
    const hits = scanSources(['packages/blocks/*/src', 'apps/web/src'], LEGACY_TOKEN_UTILITY)
    expect(hits).toEqual([])
})
```

`LEGACY_TOKEN_UTILITY` matches a utility prefix (`bg|text|border|ring|outline|fill|stroke|divide|placeholder|decoration|caret|accent|from|via|to|ring-offset|shadow|rounded|font`), optionally preceded by variants (`hover:`, `data-[…]:`, etc.), followed by a legacy token: palette `(grey|blue|teal|red|yellow|green)-\d{3}`, semantic `(background|foreground|card|card-foreground|popover|popover-foreground|primary|primary-foreground|secondary|secondary-foreground|muted|muted-foreground|accent|accent-foreground|destructive|border|input|ring|overlay)`, `rounded-(sm|md|lg)`, `shadow-(popover|card)`, `font-sans`, with optional `/opacity`. It also matches `var(--color-<legacy>)` and `--field-height-dense` not preceded by `dhis2-`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @dhis2-blocks/ui exec vitest run --project node`
Expected: FAIL on all three.

- [ ] **Step 3: Take "before" screenshots**

Start `pnpm start`, log in, and screenshot: the working list with a filter select open, the column settings dialog, a dropdown menu, and the row details modal. Save them to the scratchpad (not the repo).

- [ ] **Step 4: Rename tokens in `theme.css` and all usages** with a one-off script kept out of the repo, applying the mapping in Interfaces. `rounded-sm|md|lg` → `rounded-dhis2-sm|md|lg` (Working List's radii were 3/4/4 px, not Tailwind's). Remove the `--color-*: initial` line. Keep `white` and `black`.

- [ ] **Step 5: Run the tests and the full gate**

Run: `pnpm --filter @dhis2-blocks/ui exec vitest run --project node && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 6: Take "after" screenshots and compare** the same four views. Expected: no visible difference. Any difference is a missed token: add it to `LEGACY_TOKEN_UTILITY` so the test catches it, then fix it.

- [ ] **Step 7: Run e2e**

Run: `pnpm e2e:43`
Expected: PASS.

- [ ] **Step 8: Commit** (ask first)

```bash
git commit -m "refactor: namespace DHIS2 design tokens so blocks don't restyle the host"
```

### Task 4: Registry items for the primitives

**Files:**
- Create: `packages/blocks/ui/scripts/buildUiRegistry.ts` (pure function plus a CLI entry that writes `registry.json`)
- Create: `packages/blocks/ui/registry.json` (generated, committed)
- Create: `packages/blocks/ui/scripts/buildUiRegistry.test.ts`
- Modify: `packages/blocks/ui/package.json` (script `"registry:write": "node --experimental-strip-types scripts/buildUiRegistry.ts"`; vitest node project includes `scripts/**/*.test.ts`)
- Modify: root `registry.json` (`include` gains `packages/blocks/ui/registry.json`)

**Interfaces:**
- Consumes: `packages/blocks/ui/src/*`, `packages/blocks/ui/package.json` dependency versions.
- Produces: `buildUiRegistry(packageDir: string): RegistryManifest` returning `{ $schema, items }` with:
  - item `dhis2-theme`: `type: "registry:theme"`, `cssVars.theme` = every token declared in `theme.css` (name without leading `--`, value verbatim), no files;
  - one item per source file (`button`, `cn`, `portal-root`, …): `type: "registry:ui"`, file `{ path: "src/<file>", type: "registry:ui", target: "@components/dhis2/ui/<file>" }`, `dependencies` = external packages it imports (bare `react`/`react-dom` excluded) at the versions in `package.json`, `registryDependencies` = `devotta-labs/dhis2-blocks/<sibling>` for each `./sibling` import, plus `devotta-labs/dhis2-blocks/dhis2-theme`, sorted.

- [ ] **Step 1: Write the failing tests**

```ts
test('committed registry.json equals the generated manifest', () => {
    expect(readJson('packages/blocks/ui/registry.json')).toEqual(buildUiRegistry(UI_DIR))
})
test('combobox depends on its siblings and the theme', () => {
    const combobox = item('combobox')
    expect(combobox.registryDependencies).toEqual([
        'devotta-labs/dhis2-blocks/checkbox',
        'devotta-labs/dhis2-blocks/cn',
        'devotta-labs/dhis2-blocks/dhis2-theme',
        'devotta-labs/dhis2-blocks/input-group',
        'devotta-labs/dhis2-blocks/select',
    ])
    expect(combobox.dependencies).toEqual(['@base-ui/react@^1.9.0', '@dhis2/ui-icons@^10.17.0'])
})
test('theme item carries every theme.css token', () => {
    expect(item('dhis2-theme').cssVars.theme['color-dhis2-primary']).toBe('#1565c0')
    expect(Object.keys(item('dhis2-theme').cssVars.theme)).toHaveLength(readThemeTokens().length)
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @dhis2-blocks/ui exec vitest run --project node`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `buildUiRegistry`**, then run `pnpm --filter @dhis2-blocks/ui registry:write`.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @dhis2-blocks/ui exec vitest run --project node && pnpm dlx shadcn@4.22.1 build registry.json --output /tmp/r-check`
Expected: PASS; the build lists the ui items.

- [ ] **Step 5: Commit** (ask first)

```bash
git commit -m "feat: publish the DHIS2 ui primitives as registry items"
```

### Task 5: Working List consumes the shared items

**Files:**
- Modify: `packages/blocks/working-list/registry.json` (remove the `cssVars` block; add `registryDependencies`; drop `dependencies` no longer imported by Working List's own files)
- Create: `packages/blocks/working-list/src/registry.manifest.test.ts`
- Modify: `README.md` (Working List and Context Selector install sections: the primitives install to `components/dhis2/ui/`, the theme is namespaced; add a short "UI primitives" section listing `devotta-labs/dhis2-blocks/<primitive>` installs)

**Interfaces:**
- Consumes: item names from Task 4.

- [ ] **Step 1: Write the failing test**

```ts
test('every shared primitive Working List imports is a registry dependency', () => {
    const imported = importedSpecifiers('packages/blocks/working-list/src')
        .filter(s => s.startsWith('@/registry/dhis2/ui/'))
        .map(s => `devotta-labs/dhis2-blocks/${s.split('/').pop()}`)
    expect(workingListItem().registryDependencies).toEqual([...new Set(imported)].sort())
})
test('every non-test source file is shipped', () => {
    expect(workingListItem().files.map(f => f.path).sort()).toEqual(nonTestSourceFiles().sort())
})
test('Working List ships no theme of its own', () => {
    expect(workingListItem().cssVars).toBeUndefined()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @dhis2-blocks/working-list exec vitest run --project node src/registry.manifest.test.ts`
Expected: FAIL.

- [ ] **Step 3: Edit `registry.json`** until the test passes.

- [ ] **Step 4: Run the install check and the full gate**

Run: `pnpm registry:check && pnpm typecheck && pnpm lint && pnpm dead-code:audit && pnpm test && pnpm build`
Expected: all PASS, including all nine install-check assertions from Task 1.

- [ ] **Step 5: Commit** (ask first)

```bash
git commit -m "refactor: install working list primitives from the shared ui items"
```
