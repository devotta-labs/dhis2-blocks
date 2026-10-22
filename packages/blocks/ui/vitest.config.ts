import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    globals: true,
                    name: 'node',
                    environment: 'node',
                    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
                },
            },
            {
                plugins: [tailwindcss()],
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
                    globals: true,
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
