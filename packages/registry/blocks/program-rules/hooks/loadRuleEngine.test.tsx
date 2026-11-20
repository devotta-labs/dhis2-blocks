import { renderHook } from 'vitest-browser-react'
import { setBrowserOffline } from '../../../test/network-status.test-utils'
import { createRuleEngineLoader, ruleEngineChunk } from './loadRuleEngine'

const failedModuleImport = () => {
    const url = URL.createObjectURL(
        new Blob(['export {}'], { type: 'text/javascript' })
    )
    URL.revokeObjectURL(url)
    return import(/* @vite-ignore */ url)
}

test('a failed preload is forgotten, so the next attempt tries again', async () => {
    let attempts = 0
    const { load, preload } = createRuleEngineLoader(() => {
        attempts += 1
        return failedModuleImport()
    })

    preload()
    await expect(load()).rejects.toBeInstanceOf(TypeError)
    expect(attempts).toBe(1)
    preload()
    await expect(load()).rejects.toBeInstanceOf(TypeError)
    expect(attempts).toBe(2)
})

test('a failed engine import is tried again by the next mount, and when the connection comes back', async () => {
    let attempts = 0
    const { useEngine } = createRuleEngineLoader(() => {
        attempts += 1
        return navigator.onLine ? ruleEngineChunk.load() : failedModuleImport()
    })
    await setBrowserOffline(true)
    const first = await renderHook(() => useEngine(true))
    await expect
        .poll(() => first.result.current.error)
        .toBeInstanceOf(TypeError)
    await first.unmount()

    const second = await renderHook(() => useEngine(true))
    await expect
        .poll(() => second.result.current.error)
        .toBeInstanceOf(TypeError)
    expect(attempts).toBe(2)

    await setBrowserOffline(false)
    await expect
        .poll(() => second.result.current.engine, { timeout: 10_000 })
        .toBeDefined()
    expect(attempts).toBe(3)
    expect(second.result.current.error).toBeUndefined()
})
