import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    // A lab server test checks its answers against the block's own schemas.
    test: {
        projects: [
            {
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
                plugins: [tailwindcss()],
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
                    include: ['src/examples/**/*.test.tsx'],
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
