/// <reference types="node" />
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = mkdtempSync(join(tmpdir(), 'dhis2-tailwind-rule-'))

const config = join(directory, 'oxlint.json')

const invalid = join(directory, 'invalid.tsx')

const valid = join(directory, 'valid.tsx')

const source =
    'const token = "hover:!bg-white"; export const view = <div className={token} />;\n'

const run = (...files: string[]) =>
    spawnSync(
        'pnpm',
        ['exec', 'oxlint', '--config', config, '--fix', ...files],
        { encoding: 'utf8' }
    )

try {
    writeFileSync(
        config,
        JSON.stringify({
            jsPlugins: [
                {
                    name: 'dhis2-blocks',
                    specifier: fileURLToPath(
                        new URL('../index.ts', import.meta.url)
                    ),
                },
            ],
            rules: {
                'dhis2-blocks/no-tailwind-important': 'error',
                'dhis2-blocks/inline-classnames': 'error',
            },
        })
    )
    writeFileSync(invalid, source)
    writeFileSync(
        valid,
        'export const view = <div className="sr-only">Hello!</div>;\n'
    )

    const rejected = run(invalid, valid)

    assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr)
    assert.match(rejected.stdout + rejected.stderr, /no-tailwind-important/)
    assert.match(rejected.stdout + rejected.stderr, /inline-classnames/)
    assert.equal(
        readFileSync(invalid, 'utf8'),
        source,
        'The rule must not silently remove a cascade workaround.'
    )

    const accepted = run(valid)

    assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr)
} finally {
    rmSync(directory, { recursive: true, force: true })
}
