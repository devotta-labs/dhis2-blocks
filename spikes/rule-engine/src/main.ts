// Nothing here imports the engine statically: it must land in its own chunk.
const out = document.getElementById('out')!
const w = window as any

document.getElementById('run')!.addEventListener('click', async () => {
    const t0 = performance.now()
    const E = await import('@dhis2/rule-engine')
    const t1 = performance.now()
    const engine = new E.RuleEngineJs(false)
    const t2 = performance.now()
    // fixtures and harness are a separate chunk, loaded after the timing above
    const [{ rmnch }, { large }, { bench, benchSubset }, { rmnchScenarios }] = await Promise.all([
        import('./rmnch'), import('./large'), import('./bench'), import('./scenarios'),
    ])
    void engine
    const results = {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        moduleLoadMs: +(t1 - t0).toFixed(2),
        engineInitMs: +(t2 - t1).toFixed(2),
        scenarios: rmnchScenarios(E, rmnch).scenarios.map((s) => ({ name: s.name, pass: s.pass })),
        rmnch: bench(E, rmnch),
        large: bench(E, large),
        // RMNCH with its 3 `!==` conditions rewritten to `!=`, so no rule errors are logged
        rmnchPatched: bench(E, {
            ...rmnch,
            fx: { ...rmnch.fx, programRules: rmnch.fx.programRules.map((r) => ({ ...r, condition: r.condition?.replaceAll('!==', '!=') })) },
        }),
        // pruning stand-in: only a slice of the large program's rules
        largeSubsets: [10, 30, 100].map((n) => benchSubset(E, large, new Set(large.fx.programRules.slice(0, n).map((r) => r.id)))),
    }
    w.__results = results
    out.textContent = JSON.stringify(results, null, 2)
})
w.__ready = true
