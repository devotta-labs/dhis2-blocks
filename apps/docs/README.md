# DHIS2 Blocks documentation

The documentation site is a Next.js 16 and React 19 application. Its embedded
Working List example is built separately by `apps/previews` with React 18.

From the repository root, start both applications with:

```bash
pnpm start:docs
```

The docs are served at `http://localhost:3002`; the preview development server
runs at `http://127.0.0.1:4173` and is exposed through the docs origin.

Create a production build, including registry JSON and the static preview, with:

```bash
pnpm build:docs
```

## Configuration

Copy `.env.example` to `.env.local` when overrides are needed. The DHIS2 base
URL and credentials are server-only. `NEXT_PUBLIC_SITE_ORIGIN` controls the
origin shown in copyable shadcn installation commands.

The defaults target the public DHIS2 development server with its public demo
credentials. The API version and fixed programme and organisation unit are kept
in `apps/previews/src/config.ts`.

## Content and registry

Block documentation lives in `content/blocks`. Registry artifacts are generated
from the repository's existing `registry.json` manifests and served from `/r/`:

```bash
pnpm --filter @dhis2-blocks/docs registry:build
```
