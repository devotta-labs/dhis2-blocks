import { recording } from '../test/recording'
import { startSync } from './sync'
import { change, cleanUp, setup } from './test/syncRig'

afterEach(cleanUp)

test('stop during a back-off settles at once', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change())
    const delayed = recording<number>()
    const delay = Promise.withResolvers<void>()
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
            delayed.add(ms)
            return delay.promise
        },
    })
    await delayed.reached(1)
    expect(delayed.values).toHaveLength(1)
    const started = performance.now()
    await expect(sync.stop()).resolves.toBeUndefined()
    expect(performance.now() - started).toBeLessThan(delayed.values[0] / 2)
    const tries = saves
    delay.resolve()
    await delay.promise
    expect(saves).toBe(tries)
})

test('a change during a back-off is sent at once, not after the delay', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change({ key: 'r1.c1', at: 1 }))
    const sent = recording<string[]>()
    const delayed = recording<number>()
    const sync = startSync({
        outbox,
        lockName,
        save: async (sourceKey, records) => {
            sent.add(records.map(({ key }) => key))
            if (sent.values.length === 1) {
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
        sleep: (ms) => {
            delayed.add(ms)
            return new Promise(() => {})
        },
    })
    await delayed.reached(1)
    expect(delayed.values).toHaveLength(1)
    await outbox.put(change({ key: 'r2.c1', at: 2 }))
    sync.nudge()
    await sent.reached(2)
    expect(sent.values).toHaveLength(2)
    expect(sent.values[1]).toEqual(['r1.c1', 'r2.c1'])
    await sync.stop()
})
