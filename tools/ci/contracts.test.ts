import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import picomatch from 'picomatch'
import { parse } from 'yaml'
import { z } from 'zod'
import { REPO_ROOT } from '../registry/layout.ts'

type Pattern = string | Pattern[]
const PatternSchema: z.ZodType<Pattern> = z.lazy(() =>
    z.union([z.string(), z.array(PatternSchema)])
)
const flatten = (pattern: Pattern): string[] =>
    Array.isArray(pattern) ? pattern.flatMap(flatten) : [pattern]
const filters = z
    .record(z.string(), PatternSchema)
    .parse(parse(readFileSync(join(REPO_ROOT, '.github/filters.yml'), 'utf8')))
const selected = (path: string) =>
    Object.entries(filters)
        .filter(([, patterns]) =>
            picomatch(flatten(patterns), { dot: true })(path)
        )
        .map(([name]) => name)
        .sort()

test('CI selects tooling, API and docs boundaries without routing docs specs to web E2E', () => {
    assert.deepEqual(selected('tools/registry/localRegistry.ts'), [
        'quality',
        'tooling',
    ])
    assert.deepEqual(selected('api/dhis2.mjs'), ['docs', 'docs-e2e'])
    assert.deepEqual(selected('e2e/specs-docs/catalog.spec.ts'), [
        'docs-e2e',
        'quality',
    ])
    assert.deepEqual(selected('scripts/docs/test-e2e.sh'), [
        'docs-e2e',
        'tooling',
    ])
    assert.deepEqual(selected('apps/docs/src/App.tsx'), [
        'docs',
        'docs-e2e',
        'quality',
    ])
    assert.deepEqual(selected('README.md'), [])
    assert.ok(selected('tools/registry/layout.ts').includes('web'))
    assert.ok(selected('e2e/fixtures/ids.ts').includes('e2e'))
    const workflow = parse(
        readFileSync(join(REPO_ROOT, '.github/workflows/verify.yml'), 'utf8')
    )
    for (const job of ['typecheck', 'test'])
        assert.match(workflow.jobs[job].if, /needs.changes.outputs.tooling/)
    assert.ok(
        workflow.jobs.registry.steps.some(
            (step: { uses?: string }) => step.uses === './.github/actions/setup'
        )
    )
})

const DryRunSchema = z.object({
    tasks: z.array(
        z.object({
            taskId: z.string(),
            hash: z.string(),
            inputs: z.record(z.string(), z.string()),
            dependencies: z.array(z.string()),
        })
    ),
})
const dryRun = (cwd: string) =>
    DryRunSchema.parse(
        JSON.parse(
            execFileSync(
                join(REPO_ROOT, 'node_modules/.bin/turbo'),
                ['run', 'test', '--dry=json'],
                { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
            )
        )
    )

test('API-only edits change docs test hash, not registry or web; alias imports and transit dependencies are tracked', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'turbo-inputs-'))
    t.after(() => rmSync(root, { recursive: true, force: true }))
    for (const file of [
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'turbo.json',
        'api/dhis2.mjs',
        'tools/registry/layout.ts',
        'apps/docs/package.json',
        'apps/web/package.json',
        'packages/registry/package.json',
    ]) {
        mkdirSync(dirname(join(root, file)), { recursive: true })
        cpSync(join(REPO_ROOT, file), join(root, file))
    }
    const path = join(root, 'api/dhis2.mjs')
    const original = readFileSync(path, 'utf8')
    const registrySource = join(root, 'packages/registry/components/fixture.ts')
    mkdirSync(dirname(registrySource), { recursive: true })
    writeFileSync(registrySource, 'export const value = 1')
    const before = dryRun(root)
    const tests = before.tasks.filter(({ taskId }) => taskId.endsWith('#test'))
    assert.deepEqual(tests.map(({ taskId }) => taskId).sort(), [
        '@dhis2-blocks/docs#test',
        '@dhis2-blocks/registry#test',
        '@dhis2-blocks/web#test',
    ])
    try {
        writeFileSync(path, `${original}\n// cache-boundary fixture\n`)
        const after = dryRun(root)
        for (const task of tests) {
            const next = after.tasks.find(
                ({ taskId }) => taskId === task.taskId
            )
            assert.ok(next)
            if (task.taskId === '@dhis2-blocks/docs#test')
                assert.notEqual(next.hash, task.hash)
            else assert.equal(next.hash, task.hash)
            assert.ok(
                Object.keys(task.inputs).some((input) =>
                    input.endsWith('tools/registry/layout.ts')
                )
            )
            if (task.taskId !== '@dhis2-blocks/registry#test')
                assert.ok(
                    task.dependencies.includes('@dhis2-blocks/registry#transit')
                )
        }
    } finally {
        writeFileSync(path, original)
    }
    const layout = join(root, 'tools/registry/layout.ts')
    const originalLayout = readFileSync(layout, 'utf8')
    writeFileSync(layout, `${originalLayout}\n// shared alias fixture\n`)
    const aliasChange = dryRun(root)
    writeFileSync(layout, originalLayout)
    writeFileSync(registrySource, 'export const value = 2')
    const dependencyChange = dryRun(root)
    for (const task of tests) {
        assert.notEqual(
            aliasChange.tasks.find(({ taskId }) => taskId === task.taskId)
                ?.hash,
            task.hash
        )
        assert.notEqual(
            dependencyChange.tasks.find(({ taskId }) => taskId === task.taskId)
                ?.hash,
            task.hash
        )
    }
})
