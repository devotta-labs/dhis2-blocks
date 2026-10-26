import type { CellKey, PendingChange } from '../model/types'
import { openOutbox, outboxName } from './outbox'
import type { Outbox, OutboxRecord } from './outbox'

const SOURCE = 'program:p1'

// A fresh server URL per test, so no test sees another's database.
const freshServer = () => `https://${crypto.randomUUID()}.example.org`

const deleteDatabase = (name: string) =>
    new Promise<void>((resolve, reject) => {
        const deleting = indexedDB.deleteDatabase(name)
        deleting.onsuccess = () => resolve()
        deleting.onerror = () => reject(deleting.error)
    })

const opened: Outbox[] = []
const names: string[] = []
const open = async (server: string, user: string) => {
    const outbox = await openOutbox(server, user)
    opened.push(outbox)
    names.push(outboxName(server, user))
    return outbox
}
afterEach(async () => {
    opened.splice(0).forEach((outbox) => outbox.close())
    await Promise.all(names.splice(0).map(deleteDatabase))
})

const change = (overrides: Partial<PendingChange> = {}): PendingChange => ({
    sourceKey: SOURCE,
    key: 'r1.c1',
    value: '5',
    base: null,
    at: 1,
    ...overrides,
})

test('names the database for the server and the user', () => {
    expect(outboxName('https://play.example.org', 'u1')).toBe(
        'dhis2-data-entry:https://play.example.org:u1'
    )
})

test('names the database the same with or without a trailing slash', async () => {
    expect(outboxName('https://x.example.org/', 'u1')).toBe(
        'dhis2-data-entry:https://x.example.org:u1'
    )
    const server = freshServer()
    const withSlash = await open(`${server}/`, 'userA')
    await withSlash.put(change())
    const without = await open(server, 'userA')
    expect(await without.list()).toHaveLength(1)
})

test('a later change to the same cell replaces the earlier one', async () => {
    const outbox = await open(freshServer(), 'userA')
    await outbox.put(change({ value: '5', at: 1 }))
    await outbox.put(change({ value: '6', at: 2 }))
    const records = await outbox.list()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ value: '6', at: 2, state: 'queued' })
})

test('keeps the base the first change was made against', async () => {
    const outbox = await open(freshServer(), 'userA')
    await outbox.put(change({ value: '5', base: '4', at: 1 }))
    await outbox.put(
        change({
            value: '6',
            base: '5',
            at: 2,
            row: {
                programStageId: 's1',
                orgUnitId: 'ou1',
                isNew: true,
            },
        })
    )
    expect(await outbox.list()).toEqual([
        {
            sourceKey: SOURCE,
            key: 'r1.c1',
            value: '6',
            base: '4',
            at: 2,
            row: { programStageId: 's1', orgUnitId: 'ou1', isNew: true },
            state: 'queued',
        },
    ])
})

test('a replacement is queued again and drops the earlier reason', async () => {
    const outbox = await open(freshServer(), 'userA')
    await outbox.put(change())
    await outbox.mark([{ sourceKey: SOURCE, key: 'r1.c1' }], 'failed', 'E1302')
    await outbox.put(change({ value: '6', at: 2 }))
    const [record] = await outbox.list()
    expect(record).toMatchObject({ value: '6', state: 'queued' })
    expect(record?.reason).toBeUndefined()
})

test('keeps cells of different sources and keys apart', async () => {
    const outbox = await open(freshServer(), 'userA')
    await outbox.put(change())
    await outbox.put(change({ key: 'r1.c2' }))
    await outbox.put(change({ sourceKey: 'dataset:d1' }))
    expect(await outbox.list()).toHaveLength(3)
    expect(await outbox.list(SOURCE)).toHaveLength(2)
    expect(await outbox.list('dataset:d1')).toHaveLength(1)
    expect(await outbox.list('dataset:none')).toEqual([])
})

test('a bar in a source key does not make two cells one', async () => {
    const outbox = await open(freshServer(), 'userA')
    await outbox.put(change({ sourceKey: 'a|b', key: 'c.d', value: '1' }))
    await outbox.put(change({ sourceKey: 'a', key: 'b|c.d', value: '2' }))
    expect(await outbox.list()).toHaveLength(2)
    expect(await outbox.list('a')).toMatchObject([{ key: 'b|c.d', value: '2' }])
    expect(await outbox.list('a|b')).toMatchObject([{ key: 'c.d', value: '1' }])
    await outbox.remove([{ sourceKey: 'a', key: 'b|c.d' }])
    expect(await outbox.list()).toMatchObject([{ sourceKey: 'a|b' }])
})

test("keeps each user's changes apart", async () => {
    const server = freshServer()
    const userA = await open(server, 'userA')
    await userA.put(change())
    const userB = await open(server, 'userB')
    expect(await userB.list()).toEqual([])
    expect(await userA.list()).toHaveLength(1)
})

test("keeps each server's changes apart", async () => {
    const userA = await open(freshServer(), 'userA')
    await userA.put(change())
    const sameUserElsewhere = await open(freshServer(), 'userA')
    expect(await sameUserElsewhere.list()).toEqual([])
})

test('deleting the database does not wait for an open outbox', async () => {
    const server = freshServer()
    const outbox = await open(server, 'userA')
    await outbox.put(change())
    await deleteDatabase(outboxName(server, 'userA'))
    const again = await open(server, 'userA')
    expect(await again.list()).toEqual([])
})

test('survives closing and reopening', async () => {
    const server = freshServer()
    const first = await open(server, 'userA')
    await first.put(change({ value: null, base: '4' }))
    first.close()
    const again = await open(server, 'userA')
    expect(await again.list()).toEqual([
        { ...change({ value: null, base: '4' }), state: 'queued' },
    ])
})

test('marks and removes records', async () => {
    const outbox = await open(freshServer(), 'userA')
    await outbox.put(change())
    await outbox.put(change({ key: 'r1.c2' }))

    await outbox.mark([{ sourceKey: SOURCE, key: 'r1.c1' }], 'failed', 'E1302')
    const byKey = async (): Promise<Partial<Record<CellKey, OutboxRecord>>> =>
        Object.fromEntries((await outbox.list()).map((r) => [r.key, r]))
    expect((await byKey())['r1.c1']).toMatchObject({
        state: 'failed',
        reason: 'E1302',
    })
    expect((await byKey())['r1.c2']).toMatchObject({ state: 'queued' })

    await outbox.remove([{ sourceKey: SOURCE, key: 'r1.c1' }])
    expect((await outbox.list()).map((r) => r.key)).toEqual(['r1.c2'])
})

test('marking changes the state and clears an earlier reason', async () => {
    const outbox = await open(freshServer(), 'userA')
    await outbox.put(change())
    const cell = [{ sourceKey: SOURCE, key: 'r1.c1' as const }]
    await outbox.mark(cell, 'waiting', 'Offline')
    expect((await outbox.list())[0]).toMatchObject({
        state: 'waiting',
        reason: 'Offline',
    })
    await outbox.mark(cell, 'queued')
    const [record] = await outbox.list()
    expect(record?.state).toBe('queued')
    expect(record?.reason).toBeUndefined()
})

test('marking or removing a cell that is not stored does nothing', async () => {
    const outbox = await open(freshServer(), 'userA')
    await outbox.put(change())
    const other = [{ sourceKey: SOURCE, key: 'r9.c9' as const }]
    await outbox.mark(other, 'failed', 'x')
    await outbox.remove(other)
    expect(await outbox.list()).toEqual([{ ...change(), state: 'queued' }])
})

test('a newer change survives removing the one that was sent', async () => {
    const outbox = await open(freshServer(), 'userA')
    await outbox.put(change({ value: '5', at: 1 }))
    await outbox.put(change({ value: '6', at: 2 }))
    await outbox.remove([{ sourceKey: SOURCE, key: 'r1.c1', at: 1 }])
    expect(await outbox.list()).toMatchObject([{ value: '6', at: 2 }])
    await outbox.remove([{ sourceKey: SOURCE, key: 'r1.c1', at: 2 }])
    expect(await outbox.list()).toEqual([])
})

test('a newer change keeps its state when an older one is marked', async () => {
    const outbox = await open(freshServer(), 'userA')
    await outbox.put(change({ value: '5', at: 1 }))
    await outbox.put(change({ value: '6', at: 2 }))
    await outbox.mark(
        [{ sourceKey: SOURCE, key: 'r1.c1', at: 1 }],
        'failed',
        'E1302'
    )
    const [record] = await outbox.list()
    expect(record).toMatchObject({ value: '6', state: 'queued' })
    expect(record?.reason).toBeUndefined()
})

test('putMany writes many changes at once and coalesces them', async () => {
    const outbox = await open(freshServer(), 'userA')
    const many = Array.from({ length: 200 }, (_, i) =>
        change({ key: `r${i}.c1`, value: String(i), at: i })
    )
    await outbox.putMany(many)
    expect(await outbox.list()).toHaveLength(200)

    await outbox.putMany(
        many.map((c) => ({ ...c, value: `${c.value}!`, base: 'x', at: 1000 }))
    )
    const records = await outbox.list()
    expect(records).toHaveLength(200)
    expect(records.every((r) => r.at === 1000 && r.base === null)).toBe(true)
    expect(records.find((r) => r.key === 'r7.c1')?.value).toBe('7!')
})

test('putMany coalesces cells that repeat within one call', async () => {
    const outbox = await open(freshServer(), 'userA')
    await outbox.putMany([
        change({ value: '1', base: '0', at: 1 }),
        change({ value: '2', base: '1', at: 2 }),
    ])
    expect(await outbox.list()).toMatchObject([
        { value: '2', base: '0', at: 2 },
    ])
})

test('a batch that fails midway writes nothing', async () => {
    const outbox = await open(freshServer(), 'userA')
    await outbox.put(change({ key: 'r0.c1', value: '0' }))
    const unreadable: PendingChange = {
        ...change({ key: 'r3.c1' }),
        get value(): string {
            throw new Error('cannot read the value')
        },
    }
    await expect(
        outbox.putMany([
            change({ key: 'r1.c1', value: '1' }),
            change({ key: 'r0.c1', value: 'new', at: 2 }),
            unreadable,
        ])
    ).rejects.toThrow('cannot read the value')
    expect(await outbox.list()).toEqual([
        { ...change({ key: 'r0.c1', value: '0' }), state: 'queued' },
    ])
})

test('putMany with nothing to write does nothing', async () => {
    const outbox = await open(freshServer(), 'userA')
    await outbox.putMany([])
    expect(await outbox.list()).toEqual([])
})

test('skips a record that cannot be read and returns the rest', async () => {
    const server = freshServer()
    const first = await open(server, 'userA')
    await first.put(change({ key: 'r1.c1' }))
    first.close()

    // The database exists now; add a record the outbox never wrote.
    const raw = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(outboxName(server, 'userA'))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
        const tx = raw.transaction('changes', 'readwrite')
        tx.objectStore('changes').put({
            sourceKey: SOURCE,
            key: 'r2.c1',
            value: 3,
        })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
    raw.close()

    const again = await open(server, 'userA')
    await again.put(change({ key: 'r3.c1' }))
    expect((await again.list()).map((r) => r.key)).toEqual(['r1.c1', 'r3.c1'])
    // A bad record in the way of a new change is replaced, not an error.
    await again.put(change({ key: 'r2.c1', base: '9' }))
    expect(await again.list()).toHaveLength(3)
})
