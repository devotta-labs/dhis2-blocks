import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import { canvasSourcePlugin } from './canvasSourcePlugin'
import {
    createDhis2ViteProxy,
    dhis2CsrfGuard,
    resolveDocsBackend,
} from './server/dhis2-proxy.mjs'

export default defineConfig(({ mode }) => {
    const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
    const backend = resolveDocsBackend(env.DOCS_DHIS2_URL)
    const port = Number(env.DOCS_PORT ?? 3002)

    return {
        plugins: [
            canvasSourcePlugin(),
            {
                enforce: 'pre',
                ...mdx({
                    providerImportSource: '@mdx-js/react',
                    remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
                }),
            },
            react({ include: /\.(mdx|md|jsx|js|tsx|ts)$/ }),
            tailwindcss(),
            {
                // SAFETY: Register the guard before the proxy so it can reject cross-site writes.
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
            'process.env.REACT_APP_DHIS2_BASE_URL': JSON.stringify('/dhis2'),
        },
        resolve: {
            alias: [
                {
                    find: '@/components/dhis2/ui',
                    replacement: fileURLToPath(
                        new URL(
                            '../../packages/registry/components',
                            import.meta.url
                        )
                    ),
                },
                {
                    find: '@/components',
                    replacement: fileURLToPath(
                        new URL(
                            '../../packages/registry/blocks',
                            import.meta.url
                        )
                    ),
                },
            ],
            // WARNING: Do not dedupe React Query: the app adapter needs v4 and the blocks use v5.
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
