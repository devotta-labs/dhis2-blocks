import { playwright } from '@vitest/browser-playwright'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const resolve = {
    alias: {
        '@/registry/dhis2/ui': fileURLToPath(
            new URL('../../packages/blocks/ui/src', import.meta.url)
        ),
        '@/registry/program-rules': fileURLToPath(
            new URL('../../packages/blocks/program-rules/src', import.meta.url)
        ),
    },
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
                    // The Event Form and its rules, pre-bundled up front: a dependency discovered
                    // mid-run reloads the page and breaks that test file.
                    include: [
                        '@dhis2/app-runtime',
                        '@tanstack/react-query',
                        'zod',
                        '@dhis2-blocks/event-form > zustand',
                        '@dhis2-blocks/event-form > zustand/vanilla',
                        '@dhis2-blocks/event-form > better-result',
                        '@dhis2-blocks/event-form > @dhis2/multi-calendar-dates',
                        '@dhis2-blocks/event-form > @dhis2-blocks/program-rules > @dhis2/rule-engine',
                        '@dhis2-blocks/ui > @base-ui/react',
                        '@dhis2-blocks/ui > @base-ui/react/input',
                        '@dhis2-blocks/ui > @base-ui/react/select',
                        '@dhis2-blocks/ui > @base-ui/react/toggle',
                        '@dhis2-blocks/ui > @base-ui/react/toggle-group',
                        '@dhis2-blocks/ui > @base-ui/react/radio',
                        '@dhis2-blocks/ui > @base-ui/react/radio-group',
                        '@dhis2-blocks/ui > @base-ui/react/checkbox',
                        '@dhis2-blocks/ui > @base-ui/react/popover',
                    ],
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
