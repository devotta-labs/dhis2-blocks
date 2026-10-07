import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = mkdtempSync(join(tmpdir(), 'dhis2-effect-rule-'))

const config = join(directory, 'oxlint.json')

const invalid = join(directory, 'invalid.ts')

const valid = join(directory, 'valid.ts')

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
            rules: { 'dhis2-blocks/no-react-effects': 'error' },
        })
    )

    const source =
        'import { useEffect as run } from "react"; export function Component() { run(() => notify(), []); }\n'

    writeFileSync(invalid, source)
    writeFileSync(
        valid,
        'import { useEffect } from "react"; export function Component() {\n// EFFECT: window.resize -- Listen while mounted and remove the listener on cleanup.\nuseEffect(() => subscribe(), []); }\n'
    )

    const rejected = run(invalid)
    assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr)
    assert.match(rejected.stdout + rejected.stderr, /no-react-effects/)
    assert.equal(
        readFileSync(invalid, 'utf8'),
        source,
        'Never delete an effect or invent its justification with an autofix.'
    )

    const accepted = run(valid)
    assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr)
} finally {
    rmSync(directory, { recursive: true, force: true })
}
