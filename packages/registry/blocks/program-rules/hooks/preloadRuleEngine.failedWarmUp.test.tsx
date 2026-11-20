import { renderHook } from 'vitest-browser-react'
import {
    loadRuleEngine,
    preloadRuleEngine,
    ruleEngineChunk,
    useRuleEngine,
} from './loadRuleEngine'

afterEach(() => vi.restoreAllMocks())

test('a warm-up that fails is forgotten without a word, and does not break useRuleEngine', async () => {
    const engine = await ruleEngineChunk.load()
    // oxlint-disable-next-line landmines-testing/no-test-doubles -- Warm-up always supplies valid empty data, so the real engine cannot be made to fail through inputs.
    const evaluate = vi
        .spyOn(engine.RuleEngineJs.prototype, 'evaluateEvent')
        .mockImplementation(() => {
            throw new Error('The engine failed')
        })
    const said = (['log', 'warn', 'error'] as const).map((level) =>
        vi.spyOn(console, level)
    )

    preloadRuleEngine()
    await loadRuleEngine()
    expect(evaluate).toHaveBeenCalledTimes(1)
    const { result } = await renderHook(() => useRuleEngine(true))
    await expect.poll(() => result.current.engine).toBe(engine)
    expect(result.current.error).toBeUndefined()

    preloadRuleEngine()
    await loadRuleEngine()
    expect(evaluate).toHaveBeenCalledTimes(2)
    for (const spy of said) {
        expect(spy).not.toHaveBeenCalled()
    }
})
