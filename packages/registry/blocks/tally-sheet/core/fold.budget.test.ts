import { expect, test } from 'vitest'
import { LARGE, tapOn, tapsOn } from '../test/tally.fixture'
import { createTallyStore } from '../store/store'
import { createFold } from './fold'
import { indexLayout } from './layout'

const fastest = (run: () => void, times = 5) =>
    Math.min(
        ...Array.from({ length: times }, () => {
            const started = performance.now()
            run()
            return performance.now() - started
        })
    )

test('folding a 10,000-entry log on a 30 by 8 sheet takes under 25 ms', () => {
    const index = indexLayout(LARGE)
    const entries = tapsOn(LARGE, 10_000)
    expect(fastest(() => createFold(index).take(entries))).toBeLessThan(25)
})

test('a tap costs the same on a 100,000-entry log as on an empty one', () => {
    const tapsIn = (logged: number) => {
        const store = createTallyStore({
            layout: LARGE,
            entries: tapsOn(LARGE, logged),
        })
        return fastest(() => {
            for (let tap = 0; tap < 1000; tap += 1) {
                store.getState().tap(tap % 240)
            }
        })
    }
    const empty = tapsIn(0)
    const long = tapsIn(100_000)
    expect(long).toBeLessThan(Math.max(empty * 4, 20))
})

test('receiving a log that continues the last one folds only what is new', () => {
    const entries = tapsOn(LARGE, 100_000)
    const store = createTallyStore({ layout: LARGE, entries })
    const next = [...entries, tapOn('row0', { age: 'a', sex: 'female' })]
    const started = performance.now()
    store.getState().receive(next)
    const took = performance.now() - started
    expect(store.getState().total).toBe(100_001)
    expect(took).toBeLessThan(20)
})

test('receiving a re-sorted 100,000-entry log does not fold it again', () => {
    const entries = tapsOn(LARGE, 100_000)
    const store = createTallyStore({ layout: LARGE, entries })
    const refold = fastest(() => createTallyStore({ layout: LARGE, entries }))
    const sorted = [tapOn('row1', { age: 'b', sex: 'male' }), ...entries]
    const started = performance.now()
    store.getState().receive(sorted)
    const took = performance.now() - started
    expect(store.getState().total).toBe(100_001)
    expect(store.getState().replaced).toBe(0)
    expect(took).toBeLessThan(Math.max(refold * 2, 40))
})

test('another device’s 100,000 entries do not slow this device’s undo', () => {
    const theirs = tapsOn(LARGE, 100_000).map((entry) => ({
        ...entry,
        by: 'phone',
    }))
    const store = createTallyStore({
        layout: LARGE,
        entries: theirs,
        by: 'tablet',
    })
    const took = fastest(() => {
        store.getState().tap(0)
        store.getState().undo()
    })
    expect(store.getState().canUndo).toBe(false)
    expect(took).toBeLessThan(20)
})
