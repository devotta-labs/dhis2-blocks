import type { CellKey } from '../model/types'
import type { SaveOutcome, SyncOptions } from './sync'
import {
    SOURCE,
    answer,
    answering,
    begin,
    change,
    cleanUp,
    later,
    open,
    setup,
} from './__tests__/syncRig'

afterEach(cleanUp)

test('removes saved records and reports them with the value that was sent', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change({ value: '5', at: 7 }))
    const { save } = answering('saved')
    const run = begin(outbox, lockName, save)
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
    expect(run.outcomes).toEqual([
        { sourceKey: SOURCE, key: 'r1.c1', result: 'saved', value: '5', at: 7 },
    ])
    expect(run.statuses).toEqual(['sending', 'idle'])
    expect(await outbox.list()).toEqual([])
})

test('keeps failed records with their reason and does not send them again', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change())
    const { save, calls } = answering('failed', 'E1302')
    const run = begin(outbox, lockName, save)
    await vi.waitFor(() => expect(run.outcomes).toHaveLength(1))
    expect(run.outcomes[0]).toMatchObject({ result: 'failed', reason: 'E1302' })
    expect(await outbox.list()).toMatchObject([
        { key: 'r1.c1', state: 'failed', reason: 'E1302' },
    ])

    await outbox.put(change({ key: 'r2.c1' }))
    run.sync.nudge()
    await vi.waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[1]?.records.map((record) => record.key)).toEqual(['r2.c1'])
})

test('keeps waiting records and sends them again on the next nudge', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change())
    let round = 0
    const sent: string[][] = []
    const run = begin(outbox, lockName, async (_, records) => {
        round += 1
        sent.push(records.map((record) => record.state))
        return records.map((record) =>
            answer(record, round === 1 ? 'waiting' : 'saved', 'Needs a date')
        )
    })
    await vi.waitFor(() => expect(run.outcomes).toHaveLength(1))
    expect(await outbox.list()).toMatchObject([
        { state: 'waiting', reason: 'Needs a date' },
    ])

    run.sync.nudge()
    await vi.waitFor(() => expect(run.outcomes).toHaveLength(2))
    expect(sent).toEqual([['queued'], ['waiting']])
    expect(await outbox.list()).toEqual([])
})

test('gives every failed and waiting record its own reason', async () => {
    const { outbox, lockName } = await setup()
    await outbox.putMany([
        change({ key: 'r1.c1' }),
        change({ key: 'r2.c1' }),
        change({ key: 'r3.c1' }),
        change({ key: 'r4.c1' }),
    ])
    const answers = new Map<CellKey, Pick<SaveOutcome, 'result' | 'reason'>>([
        ['r1.c1', { result: 'failed', reason: 'Period closed' }],
        ['r2.c1', { result: 'failed', reason: 'Locked' }],
        ['r3.c1', { result: 'waiting', reason: 'Needs a date' }],
    ])
    const run = begin(outbox, lockName, async (_, records) =>
        records.map((record) => {
            const given = answers.get(record.key)
            return answer(record, given?.result ?? 'saved', given?.reason)
        })
    )
    await vi.waitFor(() => expect(run.outcomes).toHaveLength(4))
    expect(await outbox.list()).toMatchObject([
        { key: 'r1.c1', state: 'failed', reason: 'Period closed' },
        { key: 'r2.c1', state: 'failed', reason: 'Locked' },
        { key: 'r3.c1', state: 'waiting', reason: 'Needs a date' },
    ])
})

test('leaves a record the source gave no answer for as it was', async () => {
    const { outbox, lockName } = await setup()
    await outbox.putMany([change({ key: 'r1.c1' }), change({ key: 'r2.c1' })])
    const run = begin(outbox, lockName, async (_, records) =>
        records
            .filter((record) => record.key === 'r2.c1')
            .map((record) => answer(record, 'saved'))
    )
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
    expect(await outbox.list()).toMatchObject([
        { key: 'r1.c1', state: 'queued' },
    ])
})

test('ignores an outcome for a cell the source was not given', async () => {
    const { outbox, lockName } = await setup()
    await outbox.putMany([change({ key: 'r1.c1' }), change({ key: 'r2.c1' })])
    const run = begin(outbox, lockName, async () => [
        { sourceKey: SOURCE, key: 'r1.c1', result: 'saved' },
        // A key that was not sent, and the key that was sent under another source.
        { sourceKey: SOURCE, key: 'r9.c9', result: 'saved' },
        { sourceKey: 'dataset:d1', key: 'r2.c1', result: 'saved' },
    ])
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
    expect(run.outcomes).toMatchObject([{ sourceKey: SOURCE, key: 'r1.c1' }])
    expect(run.outcomes).toHaveLength(1)
    expect(await outbox.list()).toMatchObject([
        { key: 'r2.c1', state: 'queued' },
    ])
})

test('restores unsent new rows after a reload', async () => {
    const { server, outbox, lockName } = await setup()
    const row = { programStageId: 's1', orgUnitId: 'ou1', isNew: true }
    await outbox.put(change({ row }))
    const first = begin(outbox, lockName, async () => [])
    await vi.waitFor(() => expect(first.statuses.at(-1)).toBe('idle'))
    first.sync.stop()
    outbox.close()

    const reopened = await open(server)
    const { save, calls } = answering('saved')
    const second = begin(reopened, lockName, save)
    await vi.waitFor(() => expect(second.outcomes).toHaveLength(1))
    expect(calls[0]?.records).toMatchObject([{ key: 'r1.c1', value: '5', row }])
    expect(await reopened.list()).toEqual([])
})

test('one loop per lock name across two handles', async () => {
    const { server, outbox: tabA, lockName } = await setup()
    const tabB = await open(server)
    await tabA.put(change())
    let sending = 0
    let mostAtOnce = 0
    let calls = 0
    const save: SyncOptions['save'] = async (_, records) => {
        calls += 1
        sending += 1
        mostAtOnce = Math.max(mostAtOnce, sending)
        await later(50)
        sending -= 1
        return records.map((record) => answer(record, 'saved'))
    }
    const a = begin(tabA, lockName, save)
    const b = begin(tabB, lockName, save)
    await vi.waitFor(() => {
        expect(a.statuses.at(-1)).toBe('idle')
        expect(b.statuses.at(-1)).toBe('idle')
    })
    expect(calls).toBe(1)
    expect(mostAtOnce).toBe(1)
})

test('sends each source once, oldest change first', async () => {
    const { outbox, lockName } = await setup()
    await outbox.putMany([
        change({ key: 'r1.c1', at: 3 }),
        change({ key: 'r2.c1', at: 1 }),
        change({ key: 'r3.c1', at: 2 }),
        change({ sourceKey: 'dataset:d1', key: 'r1.c1', at: 4 }),
    ])
    const { save, calls } = answering('saved')
    const run = begin(outbox, lockName, save)
    await vi.waitFor(() => expect(run.outcomes).toHaveLength(4))
    expect(calls).toHaveLength(2)
    expect(
        calls
            .find((call) => call.sourceKey === SOURCE)
            ?.records.map((r) => r.key)
    ).toEqual(['r2.c1', 'r3.c1', 'r1.c1'])
    expect(
        calls.find((call) => call.sourceKey === 'dataset:d1')?.records
    ).toHaveLength(1)
})

test('a change made while its cell was being sent is kept and sent next', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change({ value: '5', at: 1 }))
    const sent: Array<string | null> = []
    const run = begin(outbox, lockName, async (_, records) => {
        sent.push(...records.map((record) => record.value))
        if (sent.length === 1) {
            await outbox.put(change({ value: '6', at: 2 }))
        }
        return records.map((record) => answer(record, 'saved'))
    })
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
    expect(run.outcomes).toMatchObject([{ result: 'saved', value: '5', at: 1 }])
    expect(await outbox.list()).toMatchObject([
        { value: '6', at: 2, state: 'queued' },
    ])

    run.sync.nudge()
    await vi.waitFor(() => expect(run.outcomes).toHaveLength(2))
    expect(sent).toEqual(['5', '6'])
    expect(run.outcomes[1]).toMatchObject({ value: '6', at: 2 })
    expect(await outbox.list()).toEqual([])
})

test('a change made while its cell was being sent keeps its state when the sent one fails', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change({ value: '5', at: 1 }))
    const run = begin(outbox, lockName, async (_, records) => {
        await outbox.put(change({ value: '6', at: 2 }))
        return records.map((record) => answer(record, 'failed', 'Locked'))
    })
    await vi.waitFor(() => expect(run.outcomes).toHaveLength(1))
    const [record] = await outbox.list()
    expect(record).toMatchObject({ value: '6', state: 'queued' })
    expect(record?.reason).toBeUndefined()
})

test('nudges during a round schedule exactly one more round and never overlap', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change())
    const gate = Promise.withResolvers<void>()
    let rounds = 0
    let sending = 0
    let mostAtOnce = 0
    const run = begin(outbox, lockName, async (_, records) => {
        rounds += 1
        sending += 1
        mostAtOnce = Math.max(mostAtOnce, sending)
        if (rounds === 1) {
            await gate.promise
        }
        sending -= 1
        // Waiting records are sent again on every round, so rounds can be counted.
        return records.map((record) =>
            answer(record, 'waiting', 'Needs a date')
        )
    })
    await vi.waitFor(() => expect(rounds).toBe(1))
    run.sync.nudge()
    run.sync.nudge()
    run.sync.nudge()
    gate.resolve()
    await vi.waitFor(() => expect(rounds).toBe(2))
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
    await later(50)
    expect(rounds).toBe(2)
    expect(mostAtOnce).toBe(1)
})

test('still sends on a page that has no Web Locks', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change())
    // SAFETY: an insecure page has no `navigator.locks`, though its type says it always exists.
    vi.spyOn(navigator, 'locks', 'get').mockReturnValue(undefined as never)
    const { save, calls } = answering('saved')
    const run = begin(outbox, lockName, save)
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
    expect(calls).toHaveLength(1)
    expect(await outbox.list()).toEqual([])
})
