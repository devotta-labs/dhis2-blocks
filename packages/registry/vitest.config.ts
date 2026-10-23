import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const resolve = {
    alias: {
        '@/components/dhis2/ui': fileURLToPath(
            new URL('./components', import.meta.url)
        ),
        // Blocks import one another as they do once installed.
        '@/components': fileURLToPath(new URL('./blocks', import.meta.url)),
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
                        '@base-ui/react/merge-props',
                        '@base-ui/react/use-render',
                        '@dhis2/app-runtime',
                        '@dhis2/d2-i18n',
                        '@dhis2/multi-calendar-dates',
                        '@dhis2/ui-icons',
                        '@tanstack/react-query',
                        'axe-core',
                        'better-result',
                        'class-variance-authority',
                        'vitest-browser-react',
                        'zod',
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
