import { spawn } from 'node:child_process'
import {
    cpSync,
    existsSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

const SHADCN = 'shadcn@4.22.1'
const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CONSUMER_TEMPLATE = join(import.meta.dirname, 'consumer')
const UI_TARGET_PREFIX = '@components/dhis2/ui/'
const UI_INSTALL_DIR = join('src', 'components', 'dhis2', 'ui')
const GITHUB_ADDRESS = /devotta-labs\/dhis2-blocks\/([a-z0-9-]+)/g

class AssertionError extends Error {}

const fail = (assertion: number, message: string): never => {
    throw new AssertionError(`Assertion ${assertion} failed: ${message}`)
}

const step = (message: string): void => {
    console.log(`\n==> ${message}`)
}

// Async on purpose: the registry server lives in this process, so a blocking
// spawn would starve it and deadlock `shadcn add`.
const run = (command: string, args: string[], cwd: string): Promise<void> =>
    new Promise((resolve, reject) => {
        console.log(`$ ${command} ${args.join(' ')}  (cwd: ${cwd})`)
        const child = spawn(command, args, {
            cwd,
            stdio: 'inherit',
            env: { ...process.env, CI: 'true' },
        })
        child.once('error', reject)
        child.once('exit', (code, signal) => {
            if (code === 0) {
                resolve()
                return
            }
            reject(
                new Error(
                    `\`${command} ${args.join(' ')}\` exited with ${String(code ?? signal)}`
                )
            )
        })
    })

const listFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
            ? listFiles(join(directory, entry.name))
            : [join(directory, entry.name)]
    )

type BuiltItem = { files: { target: string }[] }

// SAFETY: Callers name the shape of the registry JSON files this check reads.
const readJson = <T>(path: string): T =>
    JSON.parse(readFileSync(path, 'utf8')) as T

const listen = (server: Server): Promise<number> =>
    new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => {
            // SAFETY: Listening on a host and port binds a TCP socket, so the address is never a pipe path.
            const address = server.address() as AddressInfo | null
            if (address === null) {
                reject(new Error('Registry server has no TCP address'))
                return
            }
            resolve(address.port)
        })
    })

const serveDirectory = (directory: string): Server =>
    createServer((request, response) => {
        const name = (request.url ?? '').split('?')[0].replace(/^\/+/, '')
        const file = join(directory, name)
        const inside = relative(directory, file).startsWith('..') === false
        if (inside && existsSync(file) && statSync(file).isFile()) {
            response.writeHead(200, { 'content-type': 'application/json' })
            response.end(readFileSync(file))
            return
        }
        response.writeHead(404)
        response.end()
    })

const builtItems = (registryDirectory: string): BuiltItem[] =>
    readdirSync(registryDirectory)
        .filter((file) => file.endsWith('.json'))
        .map((file) =>
            readJson<{ files?: BuiltItem['files'] }>(
                join(registryDirectory, file)
            )
        )
        .filter((item): item is BuiltItem => Array.isArray(item.files))

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

const checkInstall = async (workDirectory: string): Promise<void> => {
    const registryOutput = join(workDirectory, 'r')
    const appDirectory = join(workDirectory, 'app')

    step('1. Build the registry')
    await run(
        'pnpm',
        ['dlx', SHADCN, 'build', 'registry.json', '--output', registryOutput],
        REPO_ROOT
    )
    const built = builtItems(registryOutput)
    if (built.length === 0) {
        fail(1, 'shadcn build produced no item JSON')
    }

    step('2. Serve the built registry over HTTP')
    const server = serveDirectory(registryOutput)
    const port = await listen(server)
    try {
        for (const file of readdirSync(registryOutput)) {
            if (file.endsWith('.json')) {
                const path = join(registryOutput, file)
                writeFileSync(
                    path,
                    readFileSync(path, 'utf8').replace(
                        GITHUB_ADDRESS,
                        `http://127.0.0.1:${port}/$1.json`
                    )
                )
            }
        }
        const origin = `http://127.0.0.1:${port}`
        console.log(`Serving ${registryOutput} on ${origin}`)

        step('3. Install standalone UI items without block dependencies')
        const uiAppDirectory = join(workDirectory, 'ui-app')
        cpSync(CONSUMER_TEMPLATE, uiAppDirectory, { recursive: true })
        cpSync(
            join(CONSUMER_TEMPLATE, 'standalone.tsx'),
            join(uiAppDirectory, 'src', 'main.tsx')
        )
        await run('pnpm', ['install', '--no-frozen-lockfile'], uiAppDirectory)
        await run(
            'pnpm',
            [
                'dlx',
                SHADCN,
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
                ].map((name) => `${origin}/${name}.json`),
                '-y',
            ],
            uiAppDirectory
        )
        await run('pnpm', ['exec', 'tsc', '--noEmit'], uiAppDirectory)
        await run('pnpm', ['exec', 'vite', 'build'], uiAppDirectory)

        step('3. Install the blocks into a throwaway consumer app')
        cpSync(CONSUMER_TEMPLATE, appDirectory, { recursive: true })
        await run('pnpm', ['install', '--no-frozen-lockfile'], appDirectory)
        await run(
            'pnpm',
            [
                'dlx',
                SHADCN,
                'add',
                `${origin}/working-list.json`,
                `${origin}/context-selector.json`,
                '-y',
            ],
            appDirectory
        )
    } finally {
        server.close()
    }

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
            item.files
                .map((file) => file.target)
                .filter((target) => target.startsWith(UI_TARGET_PREFIX))
                .map((target) => target.slice(UI_TARGET_PREFIX.length))
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
    await run('pnpm', ['exec', 'tsc', '--noEmit'], appDirectory)

    step('9. vite build keeps Tailwind defaults and DHIS2 tokens')
    await run('pnpm', ['exec', 'vite', 'build'], appDirectory)
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

const main = async (): Promise<void> => {
    const workDirectory = mkdtempSync(join(tmpdir(), 'dhis2-registry-check-'))
    const keep = process.env.KEEP_TMP === '1'
    let failed = false
    try {
        await checkInstall(workDirectory)
        console.log('\nregistry:check passed: all 9 assertions hold')
    } catch (error) {
        failed = true
        // An assertion's message says it all; anything else is a bug in the
        // check or its tooling, so keep the stack.
        console.error(
            `\n${
                error instanceof AssertionError
                    ? error.message
                    : error instanceof Error
                      ? (error.stack ?? error.message)
                      : String(error)
            }`
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

await main()
