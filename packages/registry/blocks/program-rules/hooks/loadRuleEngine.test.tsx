import { renderHook } from 'vitest-browser-react'
import {
    preloadRuleEngine,
    ruleEngineChunk,
    useRuleEngine,
} from './loadRuleEngine'

afterEach(() => vi.restoreAllMocks())

// In its own file: once the engine has loaded, every later use on the page has it at once.
test('a failed preload is forgotten, so the next attempt tries again', async () => {
    const load = vi
        .spyOn(ruleEngineChunk, 'load')
        .mockRejectedValue(new TypeError('Failed to fetch the chunk'))
    preloadRuleEngine()
    await expect.poll(() => load.mock.calls.length).toBe(1)
    // Asking again until the failure has settled: a failure that was kept would never import again.
    await expect
        .poll(() => {
            preloadRuleEngine()
            return load.mock.calls.length
        })
        .toBeGreaterThan(1)
})

test('a failed engine import is tried again by the next mount, and when the connection comes back', async () => {
    const fetchChunk = ruleEngineChunk.load
    const load = vi
        .spyOn(ruleEngineChunk, 'load')
        .mockRejectedValue(new TypeError('Failed to fetch the chunk'))
    const first = await renderHook(() => useRuleEngine(true))
    await expect
        .poll(() => first.result.current.error?.message)
        .toBe('Failed to fetch the chunk')
    await first.unmount()

    const second = await renderHook(() => useRuleEngine(true))
    await expect.poll(() => load.mock.calls.length).toBe(2)
    await expect
        .poll(() => second.result.current.error?.message)
        .toBe('Failed to fetch the chunk')

    load.mockImplementation(fetchChunk)
    window.dispatchEvent(new Event('online'))
    await expect
        .poll(() => second.result.current.engine, { timeout: 10_000 })
        .toBeDefined()
    expect(second.result.current.error).toBeUndefined()
})
