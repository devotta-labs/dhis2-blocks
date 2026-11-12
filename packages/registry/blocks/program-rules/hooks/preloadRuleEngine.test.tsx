import { renderHook } from 'vitest-browser-react'
import {
    preloadRuleEngine,
    ruleEngineChunk,
    useRuleEngine,
} from './loadRuleEngine'

afterEach(() => vi.restoreAllMocks())

// In its own file: the engine is imported once per page, so an import by another test would hide the one checked here.
test('preloadRuleEngine starts the import once and warms the engine; useRuleEngine reuses it', async () => {
    const engine = await ruleEngineChunk.load()
    const evaluate = vi.spyOn(engine.RuleEngineJs.prototype, 'evaluateEvent')
    const load = vi.spyOn(ruleEngineChunk, 'load')

    preloadRuleEngine()
    preloadRuleEngine()
    await expect.poll(() => evaluate.mock.calls.length).toBe(1)

    const { result } = await renderHook(() => useRuleEngine(true))
    await expect.poll(() => result.current.engine).toBe(engine)
    preloadRuleEngine()
    // Once the engine is loaded and warm, nothing is imported or evaluated again.
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(load).toHaveBeenCalledTimes(1)
    expect(evaluate).toHaveBeenCalledTimes(1)
})
