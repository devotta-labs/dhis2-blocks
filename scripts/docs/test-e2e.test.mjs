import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const runner = fileURLToPath(new URL('./test-e2e.sh', import.meta.url))

for (const [version, status, keep] of [
    ['41', 0, false],
    ['43', 1, false],
    ['dev', 0, false],
    ['41', 1, true],
]) {
    test(`docs ${version}: exit ${status}, keep=${keep}`, (t) => {
        const directory = mkdtempSync(join(tmpdir(), 'docs-runner-'))

        t.after(() => rmSync(directory, { recursive: true, force: true }))
        writeFileSync(
            join(directory, 'docker'),
            `#!/bin/sh
printf '%s\\n' "$*" >> "$TEST_DOCKER_LOG"
case "$*" in *'ps --status running --quiet dhis2') echo existing-container;; esac
`,
            { mode: 0o755 }
        )
        writeFileSync(
            join(directory, 'pnpm'),
            `#!/bin/sh
printf '%s\\n' "$*" >> "$TEST_PNPM_LOG"
case "$*" in 'exec playwright test'*) exit "$TEST_PLAYWRIGHT_STATUS";; esac
`,
            { mode: 0o755 }
        )
        for (const command of ['curl', 'jq', 'lsof']) {
            writeFileSync(join(directory, command), '#!/bin/sh\nexit 1\n', {
                mode: 0o755,
            })
        }

        const dockerLog = join(directory, 'docker.log')
        const pnpmLog = join(directory, 'pnpm.log')
        const result = spawnSync('bash', [runner, version, '--grep', 'smoke'], {
            encoding: 'utf8',
            env: {
                ...process.env,
                PATH: `${directory}:${process.env.PATH}`,
                DOCS_COMPOSE_PROJECT: 'dhis2-blocks-docs',
                KEEP_DOCS_STACK: keep ? '1' : '0',
                TEST_DOCKER_LOG: dockerLog,
                TEST_PNPM_LOG: pnpmLog,
                TEST_PLAYWRIGHT_STATUS: String(status),
            },
        })

        assert.equal(result.status, status, result.stderr)
        assert.deepEqual(readFileSync(pnpmLog, 'utf8').trim().split('\n'), [
            'build:docs',
            'exec playwright test --config playwright.docs.config.ts --grep smoke',
        ])

        const teardown = readFileSync(dockerLog, 'utf8')
            .trim()
            .split('\n')
            .filter((line) => line.endsWith(' down'))

        assert.equal(teardown.length, keep ? 0 : 1)
        if (!keep) {
            assert.ok(
                teardown[0].includes(
                    `--project-name dhis2-blocks-docs-${version} `
                )
            )
        }
    })
}
