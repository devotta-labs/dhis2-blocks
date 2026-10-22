import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        projects: [
            {
                plugins: [tailwindcss()],
                resolve: {
                    alias: {
                        '@/registry/dhis2/ui': fileURLToPath(
                            new URL('../ui/src', import.meta.url)
                        ),
                    },
                },
                test: {
                    name: 'browser',
                    include: ['src/**/*.test.tsx'],
                    setupFiles: ['./test/setup.ts'],
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
