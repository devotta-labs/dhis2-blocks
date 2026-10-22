import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import {
    createDhis2ViteProxy,
    dhis2CsrfGuard,
    resolveDocsBackend,
} from './server/dhis2-proxy.mjs'

export default defineConfig(({ mode }) => {
    // Vite exposes .env files on import.meta.env only; server-side config such
    // as the proxy needs them merged explicitly. Real environment variables
    // keep precedence over .env (same rule Vite documents for env files).
    const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
    const backend = resolveDocsBackend(env.DOCS_DHIS2_URL)
    const port = Number(env.DOCS_PORT ?? 3002)

    return {
        plugins: [
            {
                enforce: 'pre',
                ...mdx({
                    providerImportSource: '@mdx-js/react',
                    remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
                }),
            },
            react({ include: /\.(mdx|md|jsx|js|tsx|ts)$/ }),
            tailwindcss(),
            // Registered before Vite's own middlewares, so cross-site writes
            // are rejected before the /dhis2 proxy ever forwards them.
            {
                name: 'docs-dhis2-csrf-guard',
                configureServer: ({ middlewares }) => {
                    middlewares.use(dhis2CsrfGuard)
                },
                configurePreviewServer: ({ middlewares }) => {
                    middlewares.use(dhis2CsrfGuard)
                },
            },
        ],
        define: {
            // The app-adapter reads this build-time constant; pinning it keeps the
            // preview host on the same-origin proxy and hides the server field.
            'process.env.REACT_APP_DHIS2_BASE_URL': JSON.stringify('/dhis2'),
        },
        resolve: {
            // Examples import blocks the way an installed project does
            // (`@/components/<block>`); here that path is the workspace source.
            alias: [
                {
                    find: '@/registry/dhis2/ui',
                    replacement: fileURLToPath(
                        new URL('../../packages/blocks/ui/src', import.meta.url)
                    ),
                },
                {
                    find: /^@\/components\/(context-selector|working-list|sidebar)$/,
                    replacement: '@dhis2-blocks/$1',
                },
            ],
            // Workspace blocks resolve to their source entry points; dedupe keeps
            // a single React runtime inside the preview host. @tanstack/react-query
            // must NOT be deduped: the DHIS2 data engine needs v4 (its useQuery
            // onSuccess/onError callbacks were removed in v5) while the blocks use
            // v5 — the two providers coexist inside the adapter.
            dedupe: ['react', 'react-dom'],
        },
        optimizeDeps: {
            esbuildOptions: {
                define: {
                    'process.env.REACT_APP_DHIS2_BASE_URL':
                        JSON.stringify('/dhis2'),
                },
            },
        },
        server: {
            port,
            proxy: createDhis2ViteProxy(backend, env),
        },
        preview: {
            port,
            proxy: createDhis2ViteProxy(backend, env),
        },
    }
})
