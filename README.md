# DHIS2 blocks

This repository is a pnpm and Turborepo monorepo for reusable DHIS2 UI blocks
and the applications used to develop them.

## Workspace layout

```text
apps/
  web/                  DHIS2 wrapper and component demo application
packages/
  working-list/         Reusable Working List component and client library
e2e/                    Real-DHIS2 Playwright coverage
scripts/e2e/            Real-DHIS2 environment orchestration
```

The web application depends on `@dhis2-blocks/working-list` through pnpm's
`workspace:*` protocol. Turborepo uses that dependency to build the library
before building, testing, or typechecking the application.

## Setup

```sh
pnpm install
```

## Development application

```sh
pnpm start
```

This starts the DHIS2 custom wrapper from `apps/web`. In development, Vite and
TypeScript select the Working List package's scoped development export so
source changes receive hot updates without rebuilding `dist`. Production builds
continue to consume the compiled package export. By default the DHIS2
Application Platform opens the application at
[http://localhost:3000](http://localhost:3000).

The deployable application bundle is built with:

```sh
pnpm build
```

The DHIS2 application output is written below `apps/web/build`.

## Working List library

Build just the reusable package or inspect the publishable tarball contents:

```sh
pnpm build:library
pnpm package:check
```

Workspace and packed consumers import the supported component surface. Its CSS
Modules are included automatically by the package entry:

```ts
import { WorkingList } from '@dhis2-blocks/working-list'
```

The package remains private while its API is iterated, but its ESM, TypeScript
declaration, `exports`, and CSS contracts are ready for workspace or tarball
consumption.

## Quality checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Turborepo runs each task in the workspaces that provide it and caches declared
build outputs.

## Real-DHIS2 browser tests

The existing version-specific commands remain available from the repository
root:

```sh
pnpm e2e:41
pnpm e2e:42
pnpm e2e:43
pnpm e2e:dev
```

See the [DHIS2 Application Platform documentation](https://platform.dhis2.nu/)
for platform-specific development and deployment guidance.
