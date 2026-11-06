import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const repo = fileURLToPath(new URL('../../', import.meta.url))
const report = z.object({
    diagnostics: z.array(z.object({ code: z.string(), message: z.string() })),
})

const forms = [
    'function input(value: TYPE) {}',
    'const input = (value: TYPE) => {}',
    'const input = function(value: TYPE) {}',
    'function input(value: TYPE = {}) {}',
    'function input(...value: TYPE) {}',
    'class Input { constructor(public value: TYPE) {} }',
    'class Input { constructor(public value: TYPE = {}) {} }',
    'type Input = (value: TYPE) => void',
    'type Input = new (value: TYPE) => Result',
    'interface Input { (value: TYPE): void }',
    'interface Input { new (value: TYPE): Result }',
    'interface Input { run(value: TYPE): void }',
    'declare function input(value: TYPE): void',
    'abstract class Input { abstract run(value: TYPE): void }',
]

for (const type of ['object', 'unknown']) {
    test(`actual no-${type}-parameters rule covers parameter wrappers and signature owners`, (t) => {
        const root = mkdtempSync(join(tmpdir(), `parameter-${type}-`))
        t.after(() => rmSync(root, { recursive: true, force: true }))
        const rule = `anti-slop/no-${type}-parameters`
        const config = join(root, '.oxlintrc.json')
        writeFileSync(
            config,
            JSON.stringify({
                categories: { correctness: 'off' },
                jsPlugins: [
                    {
                        name: 'anti-slop',
                        specifier: join(
                            repo,
                            'tools/oxlint/anti-slop/index.ts'
                        ),
                    },
                ],
                rules: { [rule]: 'error' },
            })
        )
        const lint = (source: string) => {
            const path = join(root, 'input.ts')
            writeFileSync(path, source)
            const result = spawnSync(
                process.execPath,
                [
                    join(repo, 'node_modules/oxlint/bin/oxlint'),
                    '--config',
                    config,
                    '--format',
                    'json',
                    path,
                ],
                { cwd: root, encoding: 'utf8', timeout: 10000 }
            )
            assert.ok(result.status === 0 || result.status === 1, result.stderr)
            const parsed = report.parse(JSON.parse(result.stdout))
            for (const diagnostic of parsed.diagnostics) {
                assert.equal(
                    diagnostic.code,
                    `anti-slop(no-${type}-parameters)`
                )
            }
            return parsed.diagnostics
        }
        for (const form of forms) {
            const source = form.replace('TYPE', type)
            const diagnostics = lint(source)
            assert.equal(diagnostics.length, 1, source)
            assert.match(diagnostics[0].message, /Parameter `.*value/)
            assert.equal(lint(form.replace('TYPE', 'Owner')).length, 0, form)
        }
        assert.equal(lint('function input(value) {}').length, 0)
        assert.equal(lint(`function input(...value: ${type}[]) {}`).length, 0)
        if (type === 'object') {
            assert.equal(
                lint(
                    'type Input = object; type Alias = Input | null; function input(value: Alias) {}'
                ).length,
                1
            )
            assert.equal(
                lint(
                    'export type Input = object; function input(value: Input) {}'
                ).length,
                1
            )
            assert.equal(
                lint(
                    'type Input = object; function input<Input>(value: Input) {}'
                ).length,
                0
            )
            assert.equal(
                lint(
                    'type Input = object; class Box<Input> { run(value: Input) {} }'
                ).length,
                0
            )
            assert.equal(
                lint(
                    'type Input = object; type Box = { [Input in string]: (value: Input) => void }'
                ).length,
                0
            )
            assert.equal(
                lint(
                    'type Input = object; type Box<T> = T extends infer Input ? (value: Input) => void : never'
                ).length,
                0
            )
            assert.equal(
                lint(
                    'type Input<T> = object; function input(value: Input<string>) {}'
                ).length,
                0
            )
            assert.equal(
                lint(
                    'type Input = Other; type Other = Input; function input(value: Input) {}'
                ).length,
                0
            )
            assert.equal(
                lint('function input(value: { id: string }) {}').length,
                0
            )
            assert.equal(lint('function input(cause: object) {}').length, 1)
        } else {
            for (const source of [
                'function input(cause: unknown) {}',
                'function input(cause: unknown = undefined) {}',
                'function input(...cause: unknown) {}',
                'class Input { constructor(public cause: unknown = undefined) {} }',
            ])
                assert.equal(lint(source).length, 0, source)
            for (const source of [
                'function input(error: unknown) {}',
                'function input(Cause: unknown) {}',
                'function input({ cause }: unknown) {}',
                'function input({ error: cause }: unknown) {}',
            ])
                assert.equal(lint(source).length, 1, source)
            assert.equal(lint('function input(value: object) {}').length, 0)
        }
    })
}
