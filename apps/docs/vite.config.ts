import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import rehypeHighlight from 'rehype-highlight'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { defineConfig } from 'vite'
import {
    createDhis2ViteProxy,
    resolveDocsBackend,
} from './server/dhis2-proxy.mjs'

const backend = resolveDocsBackend(process.env.DOCS_DHIS2_URL)

export default defineConfig({
    plugins: [
        {
            enforce: 'pre',
            ...mdx({
                providerImportSource: '@mdx-js/react',
                remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
                rehypePlugins: [rehypeHighlight],
            }),
        },
        react({ include: /\.(mdx|md|jsx|js|tsx|ts)$/ }),
        tailwindcss(),
    ],
    define: {
        // The app-adapter reads this build-time constant; pinning it keeps the
        // preview host on the same-origin proxy and hides the server field.
        'process.env.REACT_APP_DHIS2_BASE_URL': JSON.stringify('/dhis2'),
    },
    resolve: {
        // Workspace blocks resolve to their source entry points; dedupe keeps
        // a single React/Query runtime inside the preview host.
        dedupe: ['react', 'react-dom', '@tanstack/react-query'],
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
        port: 3002,
        proxy: createDhis2ViteProxy(backend),
    },
    preview: {
        port: 3002,
        proxy: createDhis2ViteProxy(backend),
    },
})
