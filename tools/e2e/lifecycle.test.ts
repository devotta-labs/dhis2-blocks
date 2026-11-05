import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
    cpSync,
    existsSync,
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import type { TestContext } from 'node:test'

const repo = fileURLToPath(new URL('../../', import.meta.url))
const baseEnv = { PATH: process.env.PATH, HOME: process.env.HOME }
const printLane = `printf '%s|%s|%s|%s|%s|%s|%s|%s|%s|%s\\n' "$E2E_VERSION_SLUG" "$DHIS2_IMAGE" "$DHIS2_DB_DUMP_URL" "$E2E_COMPOSE_PROJECT" "$DHIS2_HTTP_PORT" "$E2E_APP_PORT" "$E2E_PROXY_PORT" "$E2E_DHIS2_URL" "$E2E_APP_URL" "$E2E_PROXY_URL"`

function shell(source: string, env: NodeJS.ProcessEnv = {}, cwd = repo) {
    return spawnSync('bash', ['-euc', source], {
        cwd,
        env: { ...baseEnv, ...env },
        encoding: 'utf8',
        timeout: 10000,
    })
}

test('sequential and isolated version resolutions agree without subshell isolation', () => {
    const sequential = shell(
        `source scripts/e2e/versions.sh; for v in 41 42 43 dev; do e2e_load_version "$v"; ${printLane}; done`
    )
    assert.equal(sequential.status, 0, sequential.stderr)
    const rows = sequential.stdout.trim().split('\n')
    for (const [index, version] of ['41', '42', '43', 'dev'].entries()) {
        const isolated = shell(
            `source scripts/e2e/versions.sh; e2e_load_version ${version}; ${printLane}`
        )
        assert.equal(isolated.status, 0, isolated.stderr)
        assert.equal(rows[index], isolated.stdout.trim())
        const suffix = version === 'dev' ? '44' : version
        const image =
            version === 'dev'
                ? 'dhis2/core-dev:latest'
                : `dhis2/core:2.${version}`
        const dump = version === 'dev' ? 'dev' : `2.${version}`
        assert.equal(
            rows[index],
            `${version}|${image}|https://databases.dhis2.org/sierra-leone/${dump}/dhis2-db-sierra-leone.sql.gz|working-list-e2e-${version}|584${suffix}|594${suffix}|604${suffix}|http://127.0.0.1:584${suffix}|http://localhost:594${suffix}|http://localhost:604${suffix}`
        )
    }
})

test('caller overrides beat lane defaults and retain custom host URLs across versions', () => {
    const result = shell(
        `source scripts/e2e/versions.sh; for v in 41 42; do e2e_load_version "$v"; ${printLane}; done`,
        {
            DHIS2_HTTP_PORT: '51001',
            E2E_APP_PORT: '51002',
            E2E_PROXY_PORT: '51003',
            DHIS2_E2E_PORT_42: '52001',
            E2E_COMPOSE_PROJECT: 'custom-project',
            E2E_DHIS2_URL: 'http://backend.test/context',
            E2E_APP_URL: 'http://app.test',
            E2E_PROXY_URL: 'http://proxy.test',
        }
    )
    assert.equal(result.status, 0, result.stderr)
    for (const row of result.stdout.trim().split('\n')) {
        assert.ok(
            row.endsWith(
                '|custom-project|51001|51002|51003|http://backend.test/context|http://app.test|http://proxy.test'
            )
        )
    }
    const lanes = shell(
        `source scripts/e2e/versions.sh; for v in 41 42 dev; do e2e_load_version "$v"; ${printLane}; done`,
        {
            DHIS2_E2E_PORT_42: '52001',
            DHIS2_E2E_APP_PORT_42: '52002',
            DHIS2_E2E_PROXY_PORT_42: '52003',
            DHIS2_E2E_PORT_DEV: '53001',
        }
    )
    assert.equal(lanes.status, 0, lanes.stderr)
    assert.match(lanes.stdout, /working-list-e2e-41\|58441\|59441\|60441/)
    assert.match(lanes.stdout, /working-list-e2e-42\|52001\|52002\|52003/)
    assert.match(lanes.stdout, /working-list-e2e-dev\|53001\|59444\|60444/)
})

test('docs namespace and ports are explicit, and children reuse the resolved lane', () => {
    const result = shell(
        `source scripts/docs/lib-docs.sh
        docs_load_version 41; ${printLane}
        docs_load_version 42; ${printLane}
        DOCS_DHIS2_PORT=invalid DOCS_PORT=invalid bash -eu <<'CHILD'
source scripts/e2e/versions.sh; e2e_load_version 42; ${printLane}
CHILD
        e2e_load_version 43 e2e; ${printLane}`,
        {
            DHIS2_HTTP_PORT: '51001',
            E2E_COMPOSE_PROJECT: 'web-only',
            E2E_APP_URL: 'http://web-only.test',
            DOCS_COMPOSE_PROJECT: 'my-docs',
            DOCS_DHIS2_PORT: '52001',
            DOCS_PORT: '52002',
        }
    )
    assert.equal(result.status, 0, result.stderr)
    const rows = result.stdout.trim().split('\n')
    assert.match(
        rows[0],
        /my-docs-41\|52001\|52002\|60441\|http:\/\/127.0.0.1:52001\|http:\/\/localhost:52002/
    )
    assert.match(rows[1], /my-docs-42\|52001\|52002\|60442/)
    assert.equal(rows[1], rows[2])
    assert.match(
        rows[3],
        /web-only\|51001\|59443\|60443\|http:\/\/127.0.0.1:51001\|http:\/\/web-only.test/
    )
})

test('unsupported versions, invalid ports and port collisions fail before lifecycle work', () => {
    assert.equal(
        shell('source scripts/e2e/versions.sh; e2e_load_version 40').status,
        64
    )
    for (const port of [
        '0',
        '1023',
        '65536',
        '-1',
        '3e3',
        'abc',
        '999999999999999999999',
    ]) {
        const result = shell(
            'source scripts/e2e/versions.sh; e2e_load_version 42',
            { DHIS2_HTTP_PORT: port }
        )
        assert.equal(result.status, 64, result.stderr)
        assert.match(result.stderr, /Invalid E2E port/)
    }
    assert.equal(
        shell('source scripts/docs/lib-docs.sh; docs_load_version 42', {
            DOCS_PORT: 'invalid',
        }).status,
        64
    )
    assert.equal(
        shell('source scripts/e2e/versions.sh; e2e_load_version 42', {
            DHIS2_HTTP_PORT: '51000',
            E2E_APP_PORT: '51000',
        }).status,
        73
    )
})

test('a failed resolution does not replace the last resolved lane', () => {
    const result = shell(`source scripts/e2e/versions.sh
        e2e_load_version 41; ${printLane}
        if DOCS_PORT=invalid e2e_load_version 42 docs; then exit 1; fi
        e2e_load_version 41; ${printLane}`)
    assert.equal(result.status, 0, result.stderr)
    const [before, after] = result.stdout.trim().split('\n')
    assert.equal(before, after)
})

function fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'backend-lifecycle-'))
    t.after(() => rmSync(root, { recursive: true, force: true }))
    mkdirSync(join(root, 'bin'))
    cpSync(join(repo, 'scripts'), join(root, 'scripts'), { recursive: true })
    const executable = (path: string, script: string) =>
        writeFileSync(
            join(root, path),
            `#!/usr/bin/env bash\nset -eu\n${script}\n`,
            { mode: 0o755 }
        )
    executable(
        'bin/docker',
        `printf '%s\\n' "$*" >> "$FIXTURE_LOG"
        if [[ " $* " == *' down '* && "\${FAIL_DOWN:-0}" == 1 ]]; then echo 'fixture teardown failed' >&2; exit 17; fi`
    )
    executable('bin/curl', 'exit 0')
    executable('bin/jq', 'exit 0')
    executable('bin/lsof', 'exit 1')
    executable(
        'bin/pnpm',
        `if [[ "$1" == exec ]]; then exit "\${TEST_EXIT:-0}"; fi`
    )
    for (const script of ['wait-for-dhis2', 'seed-metadata']) {
        executable(
            `scripts/e2e/${script}.sh`,
            `source "$(dirname "$0")/versions.sh"
            e2e_load_version "$1"
            printf '%s %s %s %s\\n' '${script}' "$E2E_COMPOSE_PROJECT" "$DHIS2_HTTP_PORT" "$E2E_APP_URL" >> "$FIXTURE_LOG"`
        )
    }
    const log = join(root, 'commands.log')
    return {
        root,
        run: (entry: string, env: NodeJS.ProcessEnv = {}) =>
            shell(
                `bash scripts/${entry}`,
                {
                    PATH: `${join(root, 'bin')}:${process.env.PATH}`,
                    FIXTURE_LOG: log,
                    ...env,
                },
                root
            ),
        log: () => readFileSync(log, 'utf8'),
    }
}

test('validation visits every lane and docs down preserves every selected project volume', (t) => {
    const f = fixture(t)
    const validation = f.run('e2e/validate.sh')
    assert.equal(validation.status, 0, validation.stderr)
    assert.match(validation.stdout, /41:.*ports 58441\/59441\/60441/)
    assert.match(validation.stdout, /42:.*ports 58442\/59442\/60442/)
    assert.match(validation.stdout, /dev:.*ports 58444\/59444\/60444/)
    const down = f.run('docs/down.sh')
    assert.equal(down.status, 0, down.stderr)
    for (const version of ['41', '42', '43', 'dev']) {
        assert.match(
            f.log(),
            new RegExp(`--project-name dhis2-blocks-docs-${version} .* down`)
        )
    }
    assert.ok(!f.log().includes('--volumes'))
})

test('docs reset deletes only its selected project volumes and passes the lane to readiness/seeding', (t) => {
    const f = fixture(t)
    const result = f.run('docs/reset.sh 43', {
        DOCS_COMPOSE_PROJECT: 'local-docs',
        DOCS_DHIS2_PORT: '52001',
        DOCS_PORT: '52002',
    })
    assert.equal(result.status, 0, result.stderr)
    assert.match(
        f.log(),
        /--project-name local-docs-43 .* down --volumes --remove-orphans/
    )
    assert.match(
        f.log(),
        /wait-for-dhis2 local-docs-43 52001 http:\/\/localhost:52002/
    )
    assert.match(
        f.log(),
        /seed-metadata local-docs-43 52001 http:\/\/localhost:52002/
    )
    assert.ok(!f.log().includes('working-list-e2e'))
})

for (const profile of ['docs', 'e2e']) {
    for (const exitCode of [0, 9]) {
        test(`${profile} cleanup reports failure and preserves original exit ${exitCode}`, (t) => {
            const f = fixture(t)
            const entry =
                profile === 'docs' ? 'docs/test-e2e.sh' : 'e2e/run-version.sh'
            const result = f.run(`${entry} 42`, {
                TEST_EXIT: String(exitCode),
                FAIL_DOWN: '1',
            })
            assert.equal(result.status, exitCode, result.stderr)
            const project =
                profile === 'docs'
                    ? 'dhis2-blocks-docs-42'
                    : 'working-list-e2e-42'
            assert.match(
                result.stderr,
                new RegExp(`Cleanup failed for ${project} \\(exit 17\\)`)
            )
            assert.match(result.stderr, /fixture teardown failed/)
            assert.equal(
                existsSync(join(f.root, '.d2/e2e-app-shell.lock')),
                false
            )
        })
    }
}

test('a locked shared app shell rejects another lane without tearing down the owner', (t) => {
    const f = fixture(t)
    const lock = join(f.root, '.d2/e2e-app-shell.lock')
    mkdirSync(lock, { recursive: true })
    writeFileSync(join(lock, 'owner'), 'another lane')
    const result = f.run('e2e/run-version.sh 42')
    assert.equal(result.status, 73)
    assert.match(result.stderr, /locked by another lane/)
    assert.equal(readFileSync(join(lock, 'owner'), 'utf8'), 'another lane')
    assert.equal(existsSync(join(f.root, 'commands.log')), false)
})
