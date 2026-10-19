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
                    name: 'browser',
                    include: ['src/**/*.test.tsx'],
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright(),
                        // Hook tests render nothing, so failure screenshots are blank noise.
                        screenshotFailures: false,
                        instances: [{ browser: 'chromium' }],
                    },
                },
            },
        ],
    },
})
