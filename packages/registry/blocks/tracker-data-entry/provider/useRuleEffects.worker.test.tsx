/// <reference types="@vitest/browser-playwright" />
import { emptyEffects } from '@/components/program-rules'
import type { EventsRules } from '@/components/program-rules'
import { cellKey } from '@/components/spreadsheet'
import { holdIdle, later } from './__tests__/rig'
import {
    busy,
    connect,
    FIVE_ROWS,
    hiding,
    standIn,
} from './__tests__/standInRig'

// Stand-in rules with a stand-in worker: what loading does where `evaluateInBackground` answers.

afterEach(() => vi.restoreAllMocks())
beforeEach(() => performance.clearMeasures('data-entry:rules'))

/** `rules` with a worker that answers when the test says: with what the rules said when asked, or as a failed worker. */
const withWorker = (rules: EventsRules) => {
    const asked: Array<{
        rowIds: ReadonlyArray<string>
        answer(done?: number): Promise<void>
        fail(): Promise<void>
    }> = []
    // The rows evaluated on the main thread.
    const here: string[] = []
    const inWorker: EventsRules = {
        ...rules,
        evaluate: (rows, rowIds) => {
            here.push(...rowIds)
            return rules.evaluate(rows, rowIds)
        },
        evaluateInBackground: (rows, rowIds) =>
            new Promise((resolve) => {
                const evaluation = rules.evaluate(rows, rowIds)
                asked.push({
                    rowIds,
                    answer: async (done = rowIds.length) => {
                        resolve({ evaluation, done })
                        await later(0)
                    },
                    fail: async () => {
                        resolve(undefined)
                        await later(0)
                    },
                })
            }),
    }
    return { rules: inWorker, asked, here }
}

test('where the rules run in a worker, loading applies the rows it got to and asks for the rest, none run here', async () => {
    const idle = holdIdle()
    const { rules, asked } = withWorker(standIn(() => hiding('c2')))
    const { effects, stop } = connect(rules, { rows: FIVE_ROWS })
    // The first slice runs here, as without a worker: quick rules finish the rows in it.
    expect(
        FIVE_ROWS.filter(
            ({ id }) => effects.getState().cells[cellKey(id, 'c2')]?.hiddenBy
        )
    ).toHaveLength(5)
    idle.run()
    expect(asked).toEqual([])
    stop()

    // Slow rules leave rows to the worker.
    const slow = withWorker(
        standIn(() => {
            busy(60)
            return hiding('c2')
        })
    )
    const again = connect(slow.rules, { rows: FIVE_ROWS })
    const shown = () =>
        FIVE_ROWS.filter(
            ({ id }) =>
                again.effects.getState().cells[cellKey(id, 'c2')]?.hiddenBy
        ).map(({ id }) => id)
    expect(shown()).toEqual(['r1', 'r2'])
    idle.next()
    expect(slow.asked).toHaveLength(1)
    expect(slow.asked[0].rowIds).toEqual(['r3', 'r4', 'r5'])
    // The worker got to two of the three.
    await slow.asked[0].answer(2)
    expect(shown()).toEqual(['r1', 'r2', 'r3', 'r4'])
    expect(slow.asked[1].rowIds).toEqual(['r5'])
    await slow.asked[1].answer()
    expect(shown()).toHaveLength(5)
    expect(slow.asked).toHaveLength(2)
    // Only the worker evaluated them.
    expect(slow.here).toEqual(['r1', 'r2'])
    again.stop()
})

test('a row changed while the worker has it runs here on what it holds now; the worker’s answer for it is dropped', async () => {
    const idle = holdIdle()
    // Each row hides Referral while it has no children.
    const rows = new Map<string, string | null | undefined>()
    let slow = true
    const { rules, asked, here } = withWorker(
        standIn((rowId) => {
            if (slow) {
                busy(60)
            }
            return rows.get(rowId) ? emptyEffects() : hiding('c2')
        })
    )
    const { store, effects, stop } = connect(rules, { rows: FIVE_ROWS })
    const hidden = (rowId: string) =>
        effects.getState().cells[cellKey(rowId, 'c2')]?.hiddenBy
    idle.next()
    expect(asked[0].rowIds).toEqual(['r3', 'r4', 'r5'])
    slow = false
    // The worker was asked while r3 had no children; it gets one, and its rules run here after the paint.
    rows.set('r3', '1')
    store.getState().commit(cellKey('r3', 'c1'), '1')
    await expect.poll(() => here).toEqual(['r1', 'r2', 'r3'])
    expect(hidden('r3')).toBeUndefined()
    expect(hidden('r4')).toBeUndefined()

    // r3 runs here again in place of the worker's answer, slowly: what the worker said of the others waits its turn.
    slow = true
    await asked[0].answer()
    expect(here).toEqual(['r1', 'r2', 'r3', 'r3'])
    expect(hidden('r3')).toBeUndefined()
    expect(hidden('r4')).toBeUndefined()
    // r4 changes before its answer is applied: it runs here too.
    slow = false
    rows.set('r4', '1')
    store.getState().commit(cellKey('r4', 'c1'), '1')
    idle.next()
    expect(hidden('r4')).toBeUndefined()
    expect(hidden('r5')).toBeDefined()
    expect(asked).toHaveLength(1)
    expect(here).toEqual(['r1', 'r2', 'r3', 'r3', 'r4'])
    stop()
})

test('a worker that fails leaves its rows to the slices here; one that answers after the rules stopped changes nothing', async () => {
    const idle = holdIdle()
    let fails = false
    const { rules, asked } = withWorker(
        standIn(() => {
            busy(60)
            return hiding('c2')
        })
    )
    const failing: EventsRules = {
        ...rules,
        evaluateInBackground: (...args) =>
            fails ? undefined : rules.evaluateInBackground?.(...args),
    }
    const { effects, stop, reconnect } = connect(failing, { rows: FIVE_ROWS })
    const done = () =>
        FIVE_ROWS.filter(
            ({ id }) => effects.getState().cells[cellKey(id, 'c2')]?.hiddenBy
        ).length
    expect(done()).toBe(2)
    idle.next()
    expect(asked).toHaveLength(1)
    fails = true
    await asked[0].fail()
    expect(done()).toBe(2)
    idle.next()
    expect(done()).toBe(3)
    idle.run()
    expect(done()).toBe(5)
    stop()

    fails = false
    const stopAgain = reconnect({
        ...rules,
        evaluate: (ruleRows, rowIds) => {
            busy(60)
            return standIn(() => emptyEffects()).evaluate(ruleRows, rowIds)
        },
    })
    idle.next()
    expect(asked).toHaveLength(2)
    const before = effects.getState()
    stopAgain()
    await asked[1].answer()
    expect(effects.getState()).toBe(before)
})
