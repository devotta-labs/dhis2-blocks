import { renderHook } from 'vitest-browser-react'
import {
    loadRuleEngine,
    preloadRuleEngine,
    ruleEngineChunk,
    useRuleEngine,
} from './loadRuleEngine'

afterEach(() => vi.restoreAllMocks())

test('preloadRuleEngine starts the import once and warms the engine; useRuleEngine reuses it', async () => {
    const engine = await ruleEngineChunk.load()
    const evaluate = vi.spyOn(engine.RuleEngineJs.prototype, 'evaluateEvent')
    const load = vi.spyOn(ruleEngineChunk, 'load')

    preloadRuleEngine()
    preloadRuleEngine()
    await loadRuleEngine()
    expect(evaluate).toHaveBeenCalledTimes(1)

    const { result } = await renderHook(() => useRuleEngine(true))
    await expect.poll(() => result.current.engine).toBe(engine)
    preloadRuleEngine()
    await loadRuleEngine()
    expect(load).toHaveBeenCalledTimes(1)
    expect(evaluate).toHaveBeenCalledTimes(1)
})
