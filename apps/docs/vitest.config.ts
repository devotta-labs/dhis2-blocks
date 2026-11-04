import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { canvasSourcePlugin } from './canvasSourcePlugin'

export default defineConfig({
    plugins: [canvasSourcePlugin()],
    // A lab server test checks its answers against the block's own schemas.
    test: {
        projects: [
            {
                extends: true,
                resolve: {
                    alias: {
                        '@/components': fileURLToPath(
                            new URL(
                                '../../packages/registry/blocks',
                                import.meta.url
                            )
                        ),
                    },
                },
                test: {
                    name: 'node',
                    include: [
                        'server/**/*.test.mjs',
                        'src/playground/**/*.test.ts',
                    ],
                    environment: 'node',
                },
            },
            {
                extends: true,
                plugins: [tailwindcss()],
                optimizeDeps: {
                    include: [
                        'lucide-react',
                        'shiki/core',
                        'shiki/engine/javascript',
                        'shiki/langs/shellscript.mjs',
                        'shiki/langs/css.mjs',
                        'shiki/langs/diff.mjs',
                        'shiki/langs/html.mjs',
                        'shiki/langs/javascript.mjs',
                        'shiki/langs/json.mjs',
                        'shiki/langs/jsx.mjs',
                        'shiki/langs/markdown.mjs',
                        'shiki/langs/python.mjs',
                        'shiki/langs/sql.mjs',
                        'shiki/langs/tsx.mjs',
                        'shiki/langs/typescript.mjs',
                        'shiki/langs/yaml.mjs',
                        'shiki/themes/github-light.mjs',
                        'shiki/themes/github-dark.mjs',
                    ],
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
                    dedupe: ['react', 'react-dom'],
                },
                test: {
                    name: 'browser',
                    include: [
                        'src/examples/**/*.test.tsx',
                        'src/components/**/*.test.tsx',
                    ],
                    setupFiles: [
                        fileURLToPath(
                            new URL(
                                '../../packages/registry/test/setup.ts',
                                import.meta.url
                            )
                        ),
                    ],
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright(),
                        instances: [{ browser: 'chromium' }],
                    },
                },
            },
        ],
    },
})
