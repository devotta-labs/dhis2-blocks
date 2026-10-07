import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = mkdtempSync(join(tmpdir(), 'dhis2-stylesheet-policy-'))

const guard = fileURLToPath(
    new URL('../check-stylesheets.mjs', import.meta.url)
)

const entry = 'apps/web/src/index.css'

const write = (path: string, source: string) => {
    const target = join(directory, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, source)
}

const run = () =>
    spawnSync(process.execPath, [guard, directory], { encoding: 'utf8' })

const accepted = () => {
    const result = run()
    assert.equal(result.status, 0, result.stdout + result.stderr)
}

const rejected = (pattern: RegExp) => {
    const result = run()
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stderr, pattern)
}

try {
    execFileSync('git', ['init', '--quiet', directory])
    write('.gitignore', 'generated/\n')
    write('generated/build.css', 'body { color: red; }')
    write('example.ts', 'const filename = "styles.css";')
    write(
        entry,
        readFileSync(
            resolve(dirname(fileURLToPath(import.meta.url)), '../../..', entry),
            'utf8'
        )
    )
    accepted()

    // Untracked, unused files and preprocessor files fail anywhere in the repo.
    for (const path of [
        'unused.css',
        'packages/block/style.module.CSS',
        'docs/theme.scss',
        'style.sass',
        'style.less',
        'style.styl',
        'style.stylus',
        'style.pcss',
        'style.postcss',
        'style.sss',
        'file with spaces.css',
    ]) {
        write(path, '')
        rejected(/authored stylesheets are banned/)
        rmSync(join(directory, path))
    }

    // Tracked files remain checked even after a later ignore rule is added.
    write('tracked.css', 'body {}')
    execFileSync('git', ['add', 'tracked.css'], { cwd: directory })
    write('.gitignore', 'generated/\ntracked.css\n')
    rejected(/tracked.css: authored stylesheets are banned/)
    rmSync(join(directory, 'tracked.css'))
    accepted()

    for (const source of [
        '@import "tailwindcss/theme.css"; @import \'tailwindcss/utilities.css\';',
        '/* body { color: red; } */ @source "../components"; /* end */',
        '@source not inline("container");',
        '@source "../folder/*/components";',
    ]) {
        write(entry, source)
        accepted()
    }

    for (const source of [
        'body { color: red; }',
        '@import "tailwindcss/utilities.css"; body { color: red; }',
        '@import "./custom.css";',
        '@import "tailwindcss/utilities.css" layer(utilities);',
        '@import url("https://example.com/style.css");',
        '@theme { --color-brand: red; }',
        '@utility hidden { display: none; }',
        '@layer utilities { .hidden { display: none; } }',
        '@media (prefers-reduced-motion: reduce) { * { animation: none; } }',
        '@apply text-red-500;',
        '@source "../components"; color: red;',
        '@source inline("text-red-500!");',
        '@source not inline("hidden");',
        '@source "../components"; /* unterminated',
    ]) {
        write(entry, source)
        rejected(/only Tailwind compiler imports and source directives/)
    }

    const config = join(directory, 'oxlint.json')
    write(
        'oxlint.json',
        JSON.stringify({
            jsPlugins: [
                {
                    name: 'dhis2-blocks',
                    specifier: fileURLToPath(
                        new URL('../index.ts', import.meta.url)
                    ),
                },
            ],
            rules: { 'dhis2-blocks/no-stylesheets': 'error' },
        })
    )

    const source =
        'import styles from "./styles.module.css?inline"; export const View = <style>{styles}</style>;\n'

    write('invalid.tsx', source)

    const result = spawnSync(
        'pnpm',
        [
            'exec',
            'oxlint',
            '--config',
            config,
            '--fix',
            join(directory, 'invalid.tsx'),
        ],
        { encoding: 'utf8' }
    )

    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stdout + result.stderr, /no-stylesheets/)
    assert.equal(
        readFileSync(join(directory, 'invalid.tsx'), 'utf8'),
        source,
        'Do not delete styles with an autofix.'
    )
} finally {
    rmSync(directory, { recursive: true, force: true })
}
