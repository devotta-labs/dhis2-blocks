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
// Files a shadcn-initialised host owns. The install must leave them alone.
const HOST_SENTINELS = [
    join('src', 'components', 'ui', 'button.tsx'),
    join('src', 'lib', 'utils.ts'),
]
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

// A stylesheet as comparable entries: every custom-property declaration and
// every at-rule statement (`@import`, `@source`, `@apply`, …), whitespace
// normalised, so reformatting does not read as a change.
const cssEntries = (css: string): string[] =>
    [...css.matchAll(/(--[\w*-]+\s*:[^;}]+|@[a-z-]+[^;{}]*;)/g)].map((match) =>
        match[1]
            .replace(/\s+/g, ' ')
            .replace(/\s*:\s*/, ': ')
            .replace(/;$/, '')
            .replace(/"/g, "'")
            .trim()
    )

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

    const hostSentinels: { file: string; content: Buffer }[] = []
    let hostCss = ''

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

        step('3. Install the items into a throwaway consumer app')
        cpSync(CONSUMER_TEMPLATE, appDirectory, { recursive: true })
        hostSentinels.push(
            ...HOST_SENTINELS.map((file) => ({
                file,
                content: readFileSync(join(appDirectory, file)),
            }))
        )
        hostCss = readFileSync(join(appDirectory, 'src', 'index.css'), 'utf8')
        await run('pnpm', ['install', '--no-frozen-lockfile'], appDirectory)
        await run(
            'pnpm',
            [
                'dlx',
                SHADCN,
                'add',
                `${origin}/working-list.json`,
                `${origin}/event-form.json`,
                `${origin}/context-selector.json`,
                `${origin}/program-rules.json`,
                `${origin}/use-program-rules.json`,
                '-y',
            ],
            appDirectory
        )
    } finally {
        server.close()
    }

    step('4. The shadcn host keeps its own components/ui and lib/utils.ts')
    for (const { file, content } of hostSentinels) {
        const installed = join(appDirectory, file)
        if (
            !existsSync(installed) ||
            !content.equals(readFileSync(installed))
        ) {
            fail(4, `${file} is not byte-identical to the host's own copy`)
        }
    }
    const uiOwnFiles = listFiles(join(appDirectory, 'src', 'components', 'ui'))
        .map((file) =>
            relative(join(appDirectory, 'src', 'components', 'ui'), file)
        )
        .filter((file) => file !== 'button.tsx')
    if (uiOwnFiles.length > 0) {
        fail(
            4,
            `src/components/ui gained ${uiOwnFiles.join(', ')}; primitives must install to src/components/dhis2/ui`
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

    step('6. index.css keeps the host CSS and only adds dhis2-named lines')
    const css = readFileSync(join(appDirectory, 'src', 'index.css'), 'utf8')
    const removed = cssEntries(hostCss).filter(
        (entry) => !cssEntries(css).includes(entry)
    )
    if (removed.length > 0) {
        fail(6, `src/index.css lost host CSS:\n  ${removed.join('\n  ')}`)
    }
    const added = cssEntries(css).filter(
        (entry) => !cssEntries(hostCss).includes(entry) && !/dhis2/.test(entry)
    )
    if (added.length > 0) {
        fail(
            6,
            `src/index.css gained ${added.length} line(s) that are not dhis2-named:\n  ${added.join('\n  ')}`
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

    step('9. vite build keeps the host and Tailwind tokens and adds DHIS2 ones')
    // The host's own `--radius-sm` (from shadcn's init CSS) must win over
    // Tailwind's default, and the DHIS2 token must be declared next to it.
    const hostRadius = declarationValues(hostCss, '--radius-sm')
    if (hostRadius.length !== 1) {
        throw new Error('The consumer template must declare --radius-sm once')
    }
    if (
        !declarationValues(css, '--color-dhis2-primary')
            .map(normalizeCssValue)
            .includes('#1565c0')
    ) {
        fail(9, 'src/index.css does not declare --color-dhis2-primary: #1565c0')
    }
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
    assertUtilityValue(emitted, 'rounded-sm', '--radius-sm', hostRadius[0])
    // The host itself uses `text-dhis2-primary`, so this holds whatever the
    // installed items use.
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
