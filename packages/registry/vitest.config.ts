import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Ordered: the more specific `@/components/dhis2/ui` must win over `@/components`.
const resolve = {
    alias: [
        {
            find: '@/components/dhis2/ui',
            replacement: fileURLToPath(
                new URL('./components', import.meta.url)
            ),
        },
        {
            find: '@/components',
            replacement: fileURLToPath(new URL('./blocks', import.meta.url)),
        },
    ],
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
                    include: ['{components,blocks}/**/*.test.ts'],
                },
            },
            {
                plugins: [tailwindcss()],
                resolve,
                optimizeDeps: {
                    include: [
                        '@base-ui/react/button',
                        '@base-ui/react/checkbox',
                        '@base-ui/react/dialog',
                        '@base-ui/react/menu',
                        '@base-ui/react/radio',
                        '@base-ui/react/radio-group',
                        '@base-ui/react/switch',
                        '@base-ui/react/toggle',
                        '@dhis2/ui-icons',
                        'class-variance-authority',
                    ],
                },
                test: {
                    ...sharedProjectOptions,
                    name: 'browser',
                    include: ['{components,blocks}/**/*.test.tsx'],
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
