import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    throughNetwork,
    type LabNetwork,
    type RequestLogEntry,
} from './network'

const send = (network: LabNetwork, signal?: AbortSignal) => {
    let entries: RequestLogEntry[] = []
    const result = throughNetwork(
        network,
        { resource: 'tracker/events' },
        () => 'answer',
        (update) => {
            entries = update(entries)
        },
        signal
    )
    return { result, log: () => entries }
}

describe('throughNetwork', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('answers after the endpoint’s own delay over the default', async () => {
        const { result, log } = send({
            delay: 100,
            endpoints: { 'tracker/events': { delay: 2000 } },
        })
        await vi.advanceTimersByTimeAsync(1999)
        expect(log()[0].outcome).toBe('pending')
        await vi.advanceTimersByTimeAsync(1)
        await expect(result).resolves.toBe('answer')
        expect(log()[0]).toMatchObject({ outcome: 'ok', ms: 2000 })
    })

    it('fails with an HTTP error when the endpoint fails', async () => {
        const { result, log } = send({
            delay: 0,
            endpoints: { 'tracker/events': { behaviour: 'fails' } },
        })
        const failed = expect(result).rejects.toMatchObject({
            details: { httpStatusCode: 500 },
        })
        await vi.runAllTimersAsync()
        await failed
        expect(log()[0].outcome).toBe('failed')
    })

    it('never answers a hanging endpoint until the request is aborted', async () => {
        const controller = new AbortController()
        const { result, log } = send(
            {
                delay: 0,
                endpoints: { 'tracker/events': { behaviour: 'hangs' } },
            },
            controller.signal
        )
        const aborted = expect(result).rejects.toThrow('Aborted')
        await vi.advanceTimersByTimeAsync(60_000)
        expect(log()[0].outcome).toBe('pending')
        controller.abort()
        await aborted
        expect(log()[0].outcome).toBe('aborted')
    })
})
