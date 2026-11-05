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
