import { renderHook } from 'vitest-browser-react'
import {
    loadRuleEngine,
    preloadRuleEngine,
    ruleEngineChunk,
    useRuleEngine,
} from './loadRuleEngine'

afterEach(() => vi.restoreAllMocks())

test('a failed preload is forgotten, so the next attempt tries again', async () => {
    const load = vi
        .spyOn(ruleEngineChunk, 'load')
        .mockRejectedValue(new TypeError('Failed to fetch the chunk'))
    preloadRuleEngine()
    await expect(loadRuleEngine()).rejects.toThrow('Failed to fetch the chunk')
    expect(load).toHaveBeenCalledTimes(1)
    preloadRuleEngine()
    await expect(loadRuleEngine()).rejects.toThrow('Failed to fetch the chunk')
    expect(load).toHaveBeenCalledTimes(2)
})

test('a failed engine import is tried again by the next mount, and when the connection comes back', async () => {
    const load = vi
        .spyOn(ruleEngineChunk, 'load')
        .mockRejectedValue(new TypeError('Failed to fetch the chunk'))
    const first = await renderHook(() => useRuleEngine(true))
    await expect
        .poll(() => first.result.current.error?.message)
        .toBe('Failed to fetch the chunk')
    await first.unmount()

    const second = await renderHook(() => useRuleEngine(true))
    await expect
        .poll(() => second.result.current.error?.message)
        .toBe('Failed to fetch the chunk')
    expect(load).toHaveBeenCalledTimes(2)

    load.mockRestore()
    window.dispatchEvent(new Event('online'))
    await expect
        .poll(() => second.result.current.engine, { timeout: 10_000 })
        .toBeDefined()
    expect(second.result.current.error).toBeUndefined()
})
