# DHIS2 Blocks documentation

The documentation site is a Next.js 16 application. Interactive examples are
served by Next.js routes and embedded in the documentation with iframes for
style and layout isolation.

From the repository root, start the documentation application with:

```bash
pnpm dev:docs
```

The docs and preview routes are served from the same origin.

Create a production build, including registry JSON, with:

```bash
pnpm build:docs
```

## Configuration

Copy `.env.example` to `.env.local` when overrides are needed. The DHIS2 base
URL and credentials are server-only. `NEXT_PUBLIC_SITE_ORIGIN` controls the
origin shown in copyable shadcn installation commands.

The defaults target the public DHIS2 development server with its public demo
credentials. Preview-specific IDs and API versions live beside their preview
components in the docs application.

## Content and registry

Block documentation lives in `content/blocks`. Registry artifacts are generated
from the repository's existing `registry.json` manifests and served from `/r/`:

```bash
pnpm --filter @dhis2-blocks/docs registry:build
```
