import { startSync } from './sync'
import { change, cleanUp, later, setup } from './__tests__/syncRig'

afterEach(cleanUp)

test('stop during a back-off settles at once', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change())
    const delays: number[] = []
    let saves = 0
    const sync = startSync({
        outbox,
        lockName,
        save: async () => {
            saves += 1
            throw new Error('The connection dropped')
        },
        onOutcomes: () => {},
        onStatus: () => {},
        sleep: (ms) => {
            delays.push(ms)
            return later(ms)
        },
    })
    await vi.waitFor(() => expect(delays).toHaveLength(1))
    const started = performance.now()
    await expect(sync.stop()).resolves.toBeUndefined()
    expect(performance.now() - started).toBeLessThan(delays[0] / 2)
    // Past the delay, no round follows.
    const tries = saves
    await later(delays[0] + 100)
    expect(saves).toBe(tries)
})

test('a change during a back-off is sent at once, not after the delay', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change({ key: 'r1.c1', at: 1 }))
    const sent: string[][] = []
    const delays: number[] = []
    const sync = startSync({
        outbox,
        lockName,
        save: async (sourceKey, records) => {
            sent.push(records.map(({ key }) => key))
            if (sent.length === 1) {
                throw new Error('The connection dropped')
            }
            return records.map(({ key }) => ({
                sourceKey,
                key,
                result: 'saved' as const,
            }))
        },
        onOutcomes: () => {},
        onStatus: () => {},
        // A delay that never ends: only a wake ends the wait.
        sleep: (ms) => {
            delays.push(ms)
            return new Promise(() => {})
        },
    })
    await vi.waitFor(() => expect(delays).toHaveLength(1))
    await outbox.put(change({ key: 'r2.c1', at: 2 }))
    sync.nudge()
    await vi.waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1]).toEqual(['r1.c1', 'r2.c1'])
    await sync.stop()
})
