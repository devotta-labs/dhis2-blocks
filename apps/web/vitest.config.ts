import { registryAliases } from '../../tools/registry/layout'
import { playwright } from '@vitest/browser-playwright'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

const resolve = {
    alias: registryAliases(),
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
                optimizeDeps: {
                    // Compiler-injected imports must not reload an active test run.
                    include: ['react/jsx-dev-runtime'],
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
