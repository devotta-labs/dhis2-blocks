import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig, type Plugin } from 'vitest/config'

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

/**
 * `*.production.test.tsx` files run in their own browser project, where the
 * literal `process.env.NODE_ENV` in registry source reads "production", as an
 * app's production build replaces it. Only registry source: a `define` would
 * also switch React to its production build, which has no `act`.
 */
const PRODUCTION_TESTS = '{components,blocks}/**/*.production.test.tsx'

/**
 * `*.contrast.test.tsx` files run with the OS asking for more contrast, and
 * `*.forced.test.tsx` files with forced colours (Windows contrast themes).
 */
const CONTRAST_TESTS = '{components,blocks}/**/*.contrast.test.tsx'
const FORCED_TESTS = '{components,blocks}/**/*.forced.test.tsx'

type BrowserContextOptions = NonNullable<
    NonNullable<Parameters<typeof playwright>[0]>['contextOptions']
>

const productionNodeEnv = (): Plugin => ({
    name: 'registry-production-node-env',
    transform(code, id) {
        if (
            id.includes('/node_modules/') ||
            !code.includes('process.env.NODE_ENV')
        ) {
            return undefined
        }
        return {
            code: code.replaceAll('process.env.NODE_ENV', '"production"'),
            map: null,
        }
    },
})

const browserProject = {
    plugins: [tailwindcss()],
    resolve,
    optimizeDeps: {
        include: [
            '@base-ui/react/alert-dialog',
            '@base-ui/react/button',
            '@base-ui/react/checkbox',
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
            '@dhis2/rule-engine',
            '@dhis2/ui-icons',
            '@tanstack/react-virtual',
            '@tanstack/react-query',
            'better-result',
            'class-variance-authority',
            'vitest-browser-react',
            'zod',
            'zustand/react/shallow',
        ],
    },
}

// A function, so each browser project gets its own provider.
const browserTestOptions = (contextOptions: BrowserContextOptions = {}) => ({
    ...sharedProjectOptions,
    setupFiles: ['./test/setup.ts'],
    browser: {
        enabled: true,
        headless: true,
        provider: playwright({ contextOptions }),
        instances: [{ browser: 'chromium' as const }],
    },
})

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
                    setupFiles: ['./test/node.ts'],
                },
            },
            {
                ...browserProject,
                test: {
                    ...browserTestOptions(),
                    name: 'browser',
                    include: ['{components,blocks}/**/*.test.tsx'],
                    exclude: [
                        ...configDefaults.exclude,
                        PRODUCTION_TESTS,
                        CONTRAST_TESTS,
                        FORCED_TESTS,
                    ],
                },
            },
            {
                ...browserProject,
                test: {
                    ...browserTestOptions({ contrast: 'more' }),
                    name: 'browser-contrast',
                    include: [CONTRAST_TESTS],
                },
            },
            {
                ...browserProject,
                test: {
                    ...browserTestOptions({ forcedColors: 'active' }),
                    name: 'browser-forced',
                    include: [FORCED_TESTS],
                },
            },
            {
                ...browserProject,
                plugins: [...browserProject.plugins, productionNodeEnv()],
                test: {
                    ...browserTestOptions(),
                    name: 'browser-production',
                    include: [PRODUCTION_TESTS],
                },
            },
        ],
    },
})
