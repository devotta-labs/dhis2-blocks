import { renderHook } from 'vitest-browser-react'
import {
    preloadRuleEngine,
    ruleEngineChunk,
    useRuleEngine,
} from './loadRuleEngine'

afterEach(() => vi.restoreAllMocks())

// In its own file: the engine is imported once per page, and this one's warm-up is made to fail.
test('a warm-up that fails is forgotten without a word, and does not break useRuleEngine', async () => {
    const engine = await ruleEngineChunk.load()
    const evaluate = vi
        .spyOn(engine.RuleEngineJs.prototype, 'evaluateEvent')
        .mockImplementation(() => {
            throw new Error('The engine failed')
        })
    const said = (['log', 'warn', 'error'] as const).map((level) =>
        vi.spyOn(console, level)
    )

    preloadRuleEngine()
    await expect.poll(() => evaluate.mock.calls.length).toBe(1)
    const { result } = await renderHook(() => useRuleEngine(true))
    await expect.poll(() => result.current.engine).toBe(engine)
    expect(result.current.error).toBeUndefined()

    // Asking again until the failure has settled: a warm-up that was kept would never run again.
    await expect
        .poll(() => {
            preloadRuleEngine()
            return evaluate.mock.calls.length
        })
        .toBeGreaterThan(1)
    for (const spy of said) {
        expect(spy).not.toHaveBeenCalled()
    }
})
