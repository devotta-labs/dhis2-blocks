import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const resolve = {
    alias: {
        '@/registry/dhis2/ui': fileURLToPath(
            new URL('../ui/src', import.meta.url)
        ),
        '@/registry/dhis2/value-display': fileURLToPath(
            new URL('../value-display/src', import.meta.url)
        ),
    },
    dedupe: ['react', 'react-dom'],
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
                // Pre-bundle up front so a cold run doesn't discover these
                // mid-test and reload the page.
                optimizeDeps: {
                    include: [
                        '@dhis2-blocks/ui > @base-ui/react/button',
                        '@dhis2-blocks/ui > @dhis2/ui-icons',
                        '@dhis2-blocks/ui > class-variance-authority',
                        '@dhis2-blocks/ui > clsx',
                        '@dhis2-blocks/ui > tailwind-merge',
                        '@dhis2-blocks/value-display > @dhis2/multi-calendar-dates',
                        '@dhis2/d2-i18n',
                        'axe-core',
                        'better-result',
                        'react',
                        'react-dom',
                        'react-dom/client',
                        'vitest-browser-react',
                    ],
                },
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
