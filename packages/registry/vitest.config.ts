import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const resolve = {
    alias: {
        '@/components/dhis2/ui': fileURLToPath(
            new URL('./components', import.meta.url)
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
                    include: ['{components,blocks}/**/*.test.ts'],
                },
            },
            {
                plugins: [tailwindcss()],
                resolve,
                optimizeDeps: {
                    // Every React-dependent entry the tests import. Vite
                    // re-optimizes any it discovers mid-run, which loads a
                    // second React copy on a cold cache.
                    include: [
                        '@base-ui/react',
                        '@base-ui/react/alert-dialog',
                        '@base-ui/react/button',
                        '@base-ui/react/checkbox',
                        '@base-ui/react/collapsible',
                        '@base-ui/react/dialog',
                        '@base-ui/react/input',
                        '@base-ui/react/menu',
                        '@base-ui/react/merge-props',
                        '@base-ui/react/popover',
                        '@base-ui/react/radio',
                        '@base-ui/react/radio-group',
                        '@base-ui/react/select',
                        '@base-ui/react/separator',
                        '@base-ui/react/switch',
                        '@base-ui/react/toggle',
                        '@base-ui/react/toggle-group',
                        '@base-ui/react/tooltip',
                        '@base-ui/react/use-render',
                        '@dhis2/app-runtime',
                        '@dhis2/ui-icons',
                        '@tanstack/react-query',
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
