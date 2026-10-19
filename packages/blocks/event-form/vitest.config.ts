import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const resolve = {
    alias: {
        '@/registry/dhis2/ui': fileURLToPath(
            new URL('../ui/src', import.meta.url)
        ),
        '@/registry/program-rules': fileURLToPath(
            new URL('../program-rules/src', import.meta.url)
        ),
    },
}

// One copy of React for @dhis2/ui's pre-bundled dependencies and the tests. Without it a cold Vite
// cache can re-optimise them mid-run, which leaves two Reacts ("Invalid hook call").
const browserResolve = {
    ...resolve,
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
                resolve: browserResolve,
                optimizeDeps: {
                    // Pre-bundled up front: one discovered mid-run reloads the page and breaks that test file.
                    include: [
                        '@dhis2/ui',
                        '@dhis2/app-runtime',
                        'zustand',
                        '@base-ui/react/alert-dialog',
                        '@dhis2-blocks/program-rules > @dhis2/rule-engine',
                    ],
                },
                test: {
                    ...sharedProjectOptions,
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
