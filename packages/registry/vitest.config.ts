import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig, type Plugin } from 'vitest/config'

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

// WARNING: A global NODE_ENV define would also select React's production build, which has no act.
const PRODUCTION_TESTS = '{components,blocks}/**/*.production.test.tsx'

const CONTRAST_TESTS = '{components,blocks}/**/*.contrast.test.tsx'
const FORCED_TESTS = '{components,blocks}/**/*.forced.test.tsx'
const MOTION_TESTS = '{components,blocks}/**/*.motion.test.tsx'
const THEME_TEST = 'components/theme.test.ts'

type BrowserContextOptions = NonNullable<
    NonNullable<Parameters<typeof playwright>[0]>['contextOptions']
>

const productionNodeEnv: () => Plugin = () => ({
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
            '@base-ui/react',
            '@base-ui/react/alert-dialog',
            '@base-ui/react/button',
            '@base-ui/react/checkbox',
            '@base-ui/react/collapsible',
            '@base-ui/react/dialog',
            '@base-ui/react/field',
            '@base-ui/react/fieldset',
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
            'recharts',
            'vitest-browser-react',
            'zod',
            'zustand/react/shallow',
        ],
    },
}

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
                    pool: 'forks',
                    execArgv: [
                        '--experimental-webstorage',
                        '--localstorage-file=:memory:',
                    ],
                    include: ['{components,blocks}/**/*.test.ts'],
                    exclude: [...configDefaults.exclude, THEME_TEST],
                },
            },
            {
                resolve,
                test: {
                    ...sharedProjectOptions,
                    name: 'node-dom',
                    environment: 'jsdom',
                    include: [THEME_TEST],
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
                        MOTION_TESTS,
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
                test: {
                    ...browserTestOptions({ reducedMotion: 'reduce' }),
                    name: 'browser-motion',
                    include: [MOTION_TESTS],
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
