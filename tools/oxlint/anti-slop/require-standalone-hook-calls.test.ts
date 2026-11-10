import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const rule = 'anti-slop/require-standalone-hook-calls'
const diagnosticCode = 'anti-slop(require-standalone-hook-calls)'
const valid = [
    "function Component() { const { status } = useFinderResults(); if (status !== 'searching') return null; }",
    'function Component() { const result = useFinderResults(); return result.status; }',
    'function Component() { let [value, setValue] = useState(0); }',
    'function Component() { const { data: { event } } = useTimelineEventEntry(); }',
    'function Component() { useEffect(() => { if (ready) notify(); }, []); }',
    'function Component() { React.useEffect(() => {}, []); }',
    'const Component = () => { const state = React.useState(0); }',
    'const Component = function () { const state = useState(0); }',
    'function useCustom() { return useContext(Context); }',
    'const useCustom = () => useContext(Context)',
    'const useCustom = () => (React.useContext(Context))',
    'function Component() { const value = (useValue()); }',
    'function Component() { const value = useValue<string>(); }',
    'function Component() { const value = useValue() as Value; }',
    'function Component() { const value = useValue() satisfies Value; }',
    'function Component() { const value = useValue()!; }',
    'function Component() { const value = ((useValue() as Value)!) satisfies Value; }',
    'function Component() { const value = (useValue as Hook)(); }',
    'function Component() { const value = useValue!(); }',
    "function Component() { const value = Hooks['useValue'](); }",
    'function Component() { const value = use2DPosition(); }',
    'function Component() { const value = useValue(flag ? first : second); }',
    'function Component() { const value = useValue({ enabled: flag && ready }); }',
    'function Component() { const value = useValue(() => compute().value); }',
    'function Component() { const value = useValue(); if (ready) consume(value.status); }',
    'function Component() { function useInner() { return useValue(); } }',
    'function Component() { const first = useValue(), second = useOther(); }',
    'function Component() { const value = useValue(); return () => value.status; }',
    'const Component = memo(() => { const value = useValue(); return value; })',
    'const Component = React.forwardRef((props, ref) => { const value = useValue(); return value; })',
    "if (user.status !== 'searching') notify()",
    "if (getResults().status !== 'searching') notify()",
    'const status = usefinder().status',
    'const status = useful().status',
    'const status = use_value().status',
    'const status = reuseFinder().status',
    "vi.useFakeTimers().setSystemTime(new Date())",
    "test.use({ storageState: 'state.json' })",
    'app.use(middleware)',
    'const status = service.useValue().status',
    'const status = Namespace.notAHook().status',
    'const value = new useValue().status',
    'const hook = useValue; consume(hook)',
    'const value = Registry[key]().status',
    "const object = { useValue: 'not a call' }",
]

const invalid = [
    "function Component() { if (useFinderResults().status !== 'searching') return null; }",
    'function Component() { if (useReady()) return null; }',
    'function Component() { const status = useFinderResults().status; }',
    "function Component() { const status = useFinderResults()['status']; }",
    'function Component() { const status = useFinderResults()?.status; }',
    'function Component() { const status = (useFinderResults()).status; }',
    'function Component() { const status = (useFinderResults() as Result).status; }',
    'function Component() { const status = (useFinderResults() satisfies Result).status; }',
    'function Component() { const status = useFinderResults()!.status; }',
    'function Component() { const value = useValue()(); }',
    'function Component() { const value = useValue().map(transform); }',
    'function Component() { return useValue().status; }',
    'const useCustom = () => useValue().status',
    'function Component() { return <div>{useValue()}</div>; }',
    'function Component() { return <div status={useValue()} />; }',
    'function Component() { return <div {...useValue()} />; }',
    'function Component() { consume(useValue()); }',
    'function Component() { const value = consume(useValue()); }',
    'function Component() { const value = { result: useValue() }; }',
    'function Component() { const value = [useValue()]; }',
    'function Component() { const value = { ...useValue() }; }',
    'function Component() { const value = [...useValue()]; }',
    'function Component() { const value = ready ? useValue() : null; }',
    'function Component() { const value = ready && useValue(); }',
    'function Component() { const value = useValue() || fallback; }',
    'function Component() { const value = useValue() ?? fallback; }',
    'function Component() { const value = !useValue(); }',
    'function Component() { const value = useValue() === expected; }',
    'function Component() { const value = `${useValue()}`; }',
    'function Component() { const value = (notify(), useValue()); }',
    'function Component() { let value; value = useValue(); }',
    'async function Component() { const value = await useValue(); }',
    'function Component() { if (ready) { const value = useValue(); } }',
    'function Component() { if (ready) useEffect(effect); }',
    'function useCustom() { if (ready) return useValue(); }',
    'function Component() { for (const item of items) { useEffect(effect); } }',
    'function Component() { do { const value = useValue(); } while (ready); }',
    'function Component() { label: useEffect(effect); }',
    'function Component() { while (ready) { const value = useValue(); } }',
    'function Component() { for (const value = useValue(); ready;) {} }',
    'function Component() { switch (useValue()) { default: break; } }',
    'function Component() { switch (flag) { default: const value = useValue(); } }',
    'function Component() { try { const value = useValue(); } catch {} }',
    'function Component() { try {} catch { useEffect(effect); } }',
    'function Component() { try {} finally { useEffect(effect); } }',
    'function Component() { { const value = useValue(); } }',
    'function Component(value = useValue()) {}',
    'const value = useValue()',
    'useEffect(effect)',
    'function Component() { const status = React.useState(0)[0]; }',
    "function Component() { const status = Hooks['useValue']().status; }",
    'function Component() { const status = (React.useState)(0)[0]; }',
    'function Component() { const status = use2DPosition().x; }',
    'function Component() { const value = useValue?.(); }',
    'function Component() { const value = React.useState?.(0); }',
    'function Component() { const value = React?.useState(0); }',
    'function Component() { const value = (React?.useState)(0); }',
    'const Component = memo(() => <div>{useValue()}</div>)',
    'class Component { value = useValue(); }',
]

test('standalone hook calls through the configured Oxlint plugin', async (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'standalone-hook-calls-'))
    try {
        const config = JSON.parse(readFileSync(join(root, '.oxlintrc.json'), 'utf8'))
        assert.equal(config.rules[rule], 'error')
        const plugin = config.jsPlugins.find((plugin) => plugin.name === 'anti-slop')
        assert.ok(plugin)
        const configPath = join(directory, '.oxlintrc.json')
        writeFileSync(configPath, JSON.stringify({
            categories: { correctness: 'off' },
            jsPlugins: [{ ...plugin, specifier: resolve(root, plugin.specifier) }],
            rules: { [rule]: 'error' },
        }))
        const cases = [
            ...valid.map((code) => ({ code, count: 0, extension: 'tsx' })),
            ...invalid.map((code) => ({ code, count: 1, extension: 'tsx' })),
            { code: 'function Component() { consume(useFirst(), useSecond()); }', count: 2, extension: 'tsx' },
            { code: 'function Component() { const value = <Value>useValue(); }', count: 0, extension: 'ts' },
            { code: 'function Component() { const value = (<Value>useValue()).status; }', count: 1, extension: 'ts' },
        ]
        for (const [index, entry] of cases.entries()) {
            writeFileSync(join(directory, `case-${index}.${entry.extension}`), entry.code)
        }
        const result = spawnSync(join(root, 'node_modules/.bin/oxlint'), [
            '--config', configPath, '--format', 'json', directory,
        ], { cwd: root, encoding: 'utf8' })
        assert.ifError(result.error)
        assert.equal(result.status, 1, result.stderr || result.stdout)
        const output = JSON.parse(result.stdout)
        assert.equal(output.number_of_files, cases.length)
        assert.ok(output.diagnostics.every((diagnostic) => diagnostic.code === diagnosticCode), result.stdout)

        for (const [index, entry] of cases.entries()) {
            await t.test(entry.code, () => {
                const diagnostics = output.diagnostics.filter((diagnostic) =>
                    resolve(root, diagnostic.filename) === join(directory, `case-${index}.${entry.extension}`))
                assert.equal(diagnostics.length, entry.count, JSON.stringify(diagnostics))
                for (const diagnostic of diagnostics) {
                    assert.equal(diagnostic.severity, 'error')
                    const { offset, length } = diagnostic.labels[0].span
                    assert.match(entry.code.slice(offset, offset + length), /use[A-Z0-9]/u)
                }
            })
        }
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})
