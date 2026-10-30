import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const resolve = {
    alias: {
        '@/components/dhis2/ui': fileURLToPath(
            new URL('./components', import.meta.url)
        ),
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
                        '@dhis2/app-runtime',
                        '@dhis2/rule-engine',
                        '@dhis2/ui-icons',
                        '@tanstack/react-query',
                        'better-result',
                        'class-variance-authority',
                        'vitest-browser-react',
                        'zod',
                        'zustand/react/shallow',
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
