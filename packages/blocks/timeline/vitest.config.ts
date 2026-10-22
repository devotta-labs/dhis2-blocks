import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const resolve = {
    alias: {
        '@/registry/dhis2/ui': fileURLToPath(
            new URL('../ui/src', import.meta.url)
        ),
        '@/registry/dhis2/value-display': fileURLToPath(
            new URL('../value-display/src', import.meta.url)
        ),
    },
    dedupe: ['react', 'react-dom'],
}

const sharedProjectOptions = {
    globals: true,
    passWithNoTests: false,
} as const

export default defineConfig({
    test: {
        projects: [
            {
                resolve,
                test: {
                    ...sharedProjectOptions,
                    name: 'node',
                    environment: 'node',
                    include: ['src/**/*.test.ts'],
                },
            },
            {
                plugins: [tailwindcss()],
                resolve,
                // Pre-bundle up front so a cold run doesn't discover these
                // mid-test and reload the page.
                optimizeDeps: {
                    include: [
                        '@dhis2-blocks/value-display > @dhis2/multi-calendar-dates',
                        'better-result',
                        'react',
                        'react-dom',
                        'react-dom/client',
                        'vitest-browser-react',
                    ],
                },
                test: {
                    ...sharedProjectOptions,
                    // Browser tests arrive in later tasks; until then this
                    // project must not fail the run.
                    passWithNoTests: true,
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
