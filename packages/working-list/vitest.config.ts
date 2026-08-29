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
                    exclude: ['src/ui/**/*.test.ts'],
                },
            },
            {
                test: {
                    ...sharedProjectOptions,
                    name: 'jsdom',
                    environment: 'jsdom',
                    include: ['src/ui/**/*.test.ts'],
                    setupFiles: ['./test/setup.ts'],
                },
            },
            {
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
