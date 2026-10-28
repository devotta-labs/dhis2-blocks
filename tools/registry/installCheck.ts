import { execFileSync } from 'node:child_process'
import {
    cpSync,
    existsSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { prepareLocalRegistry } from './localRegistry.ts'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CONSUMER_TEMPLATE = join(import.meta.dirname, 'consumer')
const UI_TARGET_PREFIX = '@components/dhis2/ui/'
const UI_INSTALL_DIR = join('src', 'components', 'dhis2', 'ui')

class AssertionError extends Error {}

const formatError = (error: Error): string => {
    if (error instanceof AssertionError) return error.message
    return error.stack ?? error.message
}

const fail = (assertion: number, message: string): never => {
    throw new AssertionError(`Assertion ${assertion} failed: ${message}`)
}

const step = (message: string): void => {
    console.log(`\n==> ${message}`)
}

const run = (command: string, args: string[], cwd: string): void => {
    console.log(`$ ${command} ${args.join(' ')}  (cwd: ${cwd})`)
    execFileSync(command, args, {
        cwd,
        stdio: 'inherit',
        env: { ...process.env, CI: 'true' },
    })
}

const listFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
            ? listFiles(join(directory, entry.name))
            : [join(directory, entry.name)]
    )

const declarationValues = (css: string, token: string): string[] =>
    [...css.matchAll(new RegExp(`${token}:([^;}]+)`, 'g'))].map((match) =>
        match[1].trim()
    )

const normalizeCssValue = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/(^|[^\d])0\./g, '$1.')

const themeDefault = (appDirectory: string, token: string): string => {
    const theme = readFileSync(
        join(appDirectory, 'node_modules', 'tailwindcss', 'theme.css'),
        'utf8'
    )
    const match = theme.match(new RegExp(`${token}:\\s*([^;]+);`))
    if (match === null) {
        throw new Error(`tailwindcss/theme.css does not declare ${token}`)
    }
    return normalizeCssValue(match[1])
}

// A utility passes when its emitted rule carries the value directly, or when
// it references the token and every declaration of that token has the value.
const assertUtilityValue = (
    css: string,
    utility: string,
    token: string,
    expected: string
): void => {
    const rule = css.match(new RegExp(`\\.${utility}\\{([^}]*)\\}`))
    if (rule === null) {
        fail(9, `emitted CSS has no .${utility} rule`)
        return
    }
    const wanted = normalizeCssValue(expected)
    if (normalizeCssValue(rule[1]).includes(wanted)) {
        return
    }
    if (!rule[1].includes(`var(${token}`)) {
        fail(9, `.${utility} is ${rule[1]}, expected ${expected}`)
    }
    const values = declarationValues(css, token).map(normalizeCssValue)
    if (values.length === 0) {
        fail(9, `${token} is referenced by .${utility} but never declared`)
    }
    const wrong = values.filter((value) => value !== wanted)
    if (wrong.length > 0) {
        fail(
            9,
            `${token} resolves to ${wrong.join(', ')} in the emitted CSS, expected ${expected} (.${utility})`
        )
    }
}

const FORBIDDEN_CSS: [string, RegExp][] = [
    ['--color-*: initial', /--color-\*\s*:\s*initial/g],
    [
        'un-namespaced palette token',
        /--color-(?:grey|blue|teal|red|yellow|green)-\d{3}\s*:/g,
    ],
    ['un-namespaced --color-primary', /--color-primary\s*:/g],
    ['un-namespaced --radius-*', /--radius-(?:sm|md|lg)\s*:/g],
    ['un-namespaced --shadow-*', /--shadow-(?:popover|card)\s*:/g],
]

const checkInstall = (workDirectory: string): void => {
    const registryOutput = join(workDirectory, 'r')
    const appDirectory = join(workDirectory, 'app')

    step('1. Build the registry')
    run(
        'pnpm',
        [
            'exec',
            'shadcn',
            'build',
            'registry.json',
            '--output',
            registryOutput,
        ],
        REPO_ROOT
    )
    step('2. Point built dependencies at local item files')
    const built = prepareLocalRegistry(registryOutput)
    if (built.length === 0) {
        fail(1, 'shadcn build produced no item JSON')
    }

    step('3a. Install standalone UI items without block dependencies')
    const uiAppDirectory = join(workDirectory, 'ui-app')
    cpSync(CONSUMER_TEMPLATE, uiAppDirectory, { recursive: true })
    cpSync(
        join(CONSUMER_TEMPLATE, 'standalone.tsx'),
        join(uiAppDirectory, 'src', 'main.tsx')
    )
    run('pnpm', ['install', '--no-frozen-lockfile'], uiAppDirectory)
    run(
        'pnpm',
        [
            'exec',
            'shadcn',
            'add',
            ...[
                'button',
                'card',
                'checkbox',
                'dialog',
                'dropdown-menu',
                'radio-group',
                'switch',
                'toggle',
            ].map((name) => join(registryOutput, `${name}.json`)),
            '-y',
            '--cwd',
            uiAppDirectory,
        ],
        REPO_ROOT
    )
    run('pnpm', ['exec', 'tsc', '--noEmit'], uiAppDirectory)
    run('pnpm', ['exec', 'vite', 'build'], uiAppDirectory)

    step('3b. Install the blocks into a throwaway consumer app')
    cpSync(CONSUMER_TEMPLATE, appDirectory, { recursive: true })
    run('pnpm', ['install', '--no-frozen-lockfile'], appDirectory)
    run(
        'pnpm',
        [
            'exec',
            'shadcn',
            'add',
            join(registryOutput, 'working-list.json'),
            join(registryOutput, 'context-selector.json'),
            join(registryOutput, 'sidebar.json'),
            '-y',
            '--cwd',
            appDirectory,
        ],
        REPO_ROOT
    )

    step('4. No files land in components/ui')
    if (existsSync(join(appDirectory, 'src', 'components', 'ui'))) {
        fail(
            4,
            'src/components/ui exists; primitives must install to src/components/dhis2/ui'
        )
    }

    step('5. Every installed dhis2/ui file belongs to a built ui item')
    const declared = new Set(
        built.flatMap((item) =>
            (item.files ?? []).flatMap((file) =>
                file.target?.startsWith(UI_TARGET_PREFIX)
                    ? [file.target.slice(UI_TARGET_PREFIX.length)]
                    : []
            )
        )
    )
    const uiDirectory = join(appDirectory, UI_INSTALL_DIR)
    const installedUi = existsSync(uiDirectory)
        ? listFiles(uiDirectory).map((file) => relative(uiDirectory, file))
        : []
    const strays = installedUi.filter((file) => !declared.has(file))
    if (strays.length > 0) {
        fail(5, `unlisted files in ${UI_INSTALL_DIR}: ${strays.join(', ')}`)
    }

    step('6. index.css carries only namespaced DHIS2 tokens')
    const css = readFileSync(join(appDirectory, 'src', 'index.css'), 'utf8')
    const violations = FORBIDDEN_CSS.flatMap(([label, pattern]) =>
        [...css.matchAll(pattern)].map((match) => `${label}: ${match[0]}`)
    )
    if (violations.length > 0) {
        fail(
            6,
            `src/index.css has ${violations.length} forbidden declaration(s):\n  ${violations.join('\n  ')}`
        )
    }

    step('7. No installed file imports @/registry/')
    const registryImports = listFiles(join(appDirectory, 'src')).filter(
        (file) => readFileSync(file, 'utf8').includes('@/registry/')
    )
    if (registryImports.length > 0) {
        fail(
            7,
            `files still import @/registry/: ${registryImports.map((file) => relative(appDirectory, file)).join(', ')}`
        )
    }

    step('8. tsc --noEmit')
    run('pnpm', ['exec', 'tsc', '--noEmit'], appDirectory)

    step('9. vite build keeps Tailwind defaults and DHIS2 tokens')
    run('pnpm', ['exec', 'vite', 'build'], appDirectory)
    const assets = join(appDirectory, 'dist', 'assets')
    const emitted = readdirSync(assets)
        .filter((file) => file.endsWith('.css'))
        .map((file) => readFileSync(join(assets, file), 'utf8'))
        .join('\n')
    assertUtilityValue(
        emitted,
        'bg-blue-500',
        '--color-blue-500',
        themeDefault(appDirectory, '--color-blue-500')
    )
    assertUtilityValue(
        emitted,
        'rounded-sm',
        '--radius-sm',
        themeDefault(appDirectory, '--radius-sm')
    )
    // Tailwind emits only the utilities the installed source uses, and the
    // installed `@theme inline` block resolves the token to its value, so check
    // a DHIS2 utility that the installed primitives really use.
    assertUtilityValue(
        emitted,
        'text-dhis2-primary',
        '--color-dhis2-primary',
        '#1565c0'
    )
}

const main = (): void => {
    const workDirectory = mkdtempSync(join(tmpdir(), 'dhis2-registry-check-'))
    const keep = process.env.KEEP_TMP === '1'
    let failed = false
    try {
        checkInstall(workDirectory)
        console.log('\nregistry:check passed: all 9 assertions hold')
    } catch (error) {
        failed = true
        // An assertion's message says it all; anything else is a bug in the
        // check or its tooling, so keep the stack.
        console.error(
            `\n${error instanceof Error ? formatError(error) : String(error)}`
        )
    } finally {
        if (keep) {
            console.log(`Temp dir kept: ${workDirectory}`)
        } else {
            rmSync(workDirectory, { recursive: true, force: true })
            if (failed) {
                console.error(
                    `Temp dir ${workDirectory} removed; rerun with KEEP_TMP=1 to keep it`
                )
            }
        }
    }
    process.exitCode = failed ? 1 : 0
}

main()
