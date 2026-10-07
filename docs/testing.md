# Testing

The root `pnpm test` command delegates to `turbo run test`. Turborepo discovers
every workspace that declares a `test` script, so a new package or application
joins the repository suite by owning its test script and configuration. The
root command does not assume that applications use Vite, React, or DHIS2.

## Workspace Vitest configurations

Each current workspace owns an explicit `vitest.config.ts`:

- `packages/blocks/working-list` runs pure TypeScript tests in a fast Node project and
  all React component tests in Chromium Browser Mode through the Playwright
  provider. Component tests use `vitest-browser-react`, semantic browser
  locators, and browser-backed user interactions where the behavior is
  user-facing. Filter-label and stage-change policies live in framework-free
  domain modules so their tests stay in Node without importing React or DHIS2
  UI components.
- `apps/web` runs URL privacy/state and other pure application logic in Node.
  The interactive `ContextSelectorBar` component test uses the Chromium
  renderer stack. Its DHIS2 Application Platform build remains configured
  independently through `d2.config.js` and `vite.config.mts`.

Component testing is browser-first because the browser owns meaningful
semantics such as accessible names, disabled controls, keyboard focus,
activation, portals, and modal behavior. Neither workspace has a jsdom Vitest
project or direct jsdom dependency. Pure policies are extracted and run in
Node; component behavior runs in Chromium. Browser Mode does not repeat the
real-DHIS2 workflows covered by the root Playwright E2E suite.

Framework assumptions stay local. For example, a future Next.js application
under `apps/` can add a Next-appropriate `vitest.config.ts` and `test` script,
then participate in `pnpm test` without inheriting DHIS2 or Vite configuration
from another workspace. Synchronous Server Components can be unit tested where
the Next.js toolchain supports them; async Server Components remain an E2E
concern.

## Commands

```sh
pnpm test
pnpm --filter @dhis2-blocks/working-list test:browser
pnpm e2e:validate
```

The first command runs all workspace Vitest projects, including Browser Mode
component tests. The second runs only the Working List browser project. The E2E
validation command checks the separate Playwright/DHIS2 configuration without
starting the versioned environments.
