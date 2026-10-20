import { playwright } from '@vitest/browser-playwright'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const resolve = {
    alias: {
        '@/registry/dhis2/ui': fileURLToPath(
            new URL('../../packages/blocks/ui/src', import.meta.url)
        ),
    },
    // One React for the app, the blocks and Recharts.
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
                // Pre-bundled up front: discovering Recharts mid-run on a cold
                // cache reloads the browser and fails the first test files.
                // The app reaches Recharts only through the block, hence the
                // nested form.
                optimizeDeps: {
                    include: ['@dhis2-blocks/observation-cards > recharts'],
                },
                test: {
                    ...sharedProjectOptions,
                    name: 'browser',
                    include: ['src/app/**/*.test.tsx'],
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
