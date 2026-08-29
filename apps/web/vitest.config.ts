import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const sharedProjectOptions = {
    globals: true,
    passWithNoTests: false,
} as const

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    ...sharedProjectOptions,
                    name: 'node',
                    environment: 'node',
                    include: ['src/**/*.test.ts'],
                },
            },
            {
                test: {
                    ...sharedProjectOptions,
                    name: 'jsdom',
                    environment: 'jsdom',
                    include: ['src/App.test.tsx'],
                },
            },
            {
                test: {
                    ...sharedProjectOptions,
                    name: 'browser',
                    include: ['src/app/**/*.test.tsx'],
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
