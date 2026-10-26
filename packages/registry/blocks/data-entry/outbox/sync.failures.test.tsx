import { FetchError } from '@dhis2/app-runtime'
import {
    SOURCE,
    answer,
    answering,
    begin,
    change,
    cleanUp,
    later,
    setup,
} from './__tests__/syncRig'

afterEach(cleanUp)

const networkDown = () => new TypeError('Failed to fetch')

test('retries network failures with growing delays', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change())
    let failures = 3
    const run = begin(outbox, lockName, async (_, records) => {
        if (failures-- > 0) {
            throw networkDown()
        }
        return records.map((record) => answer(record, 'saved'))
    })
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
    expect(run.sleeps).toEqual([1000, 2000, 4000])
    expect(run.statuses).toEqual([
        'sending',
        'retrying',
        'sending',
        'retrying',
        'sending',
        'retrying',
        'sending',
        'idle',
    ])
    expect(await outbox.list()).toEqual([])
})

test('caps the delay at a minute', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change())
    let failures = 8
    const run = begin(outbox, lockName, async (_, records) => {
        if (failures-- > 0) {
            throw networkDown()
        }
        return records.map((record) => answer(record, 'saved'))
    })
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
    expect(run.sleeps).toEqual([
        1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000,
    ])
})

test('starts again from a second after a success within the same loop', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change())
    const gate = Promise.withResolvers<void>()
    let calls = 0
    const run = begin(outbox, lockName, async (_, records) => {
        calls += 1
        if (calls <= 3 || calls === 5) {
            throw networkDown()
        }
        if (calls === 4) {
            await gate.promise
        }
        return records.map((record) => answer(record, 'saved'))
    })
    // The fourth call succeeds; a nudge while it is held keeps the loop going into a fifth round.
    await vi.waitFor(() => expect(calls).toBe(4))
    await outbox.put(change({ key: 'r2.c1' }))
    run.sync.nudge()
    gate.resolve()
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
    expect(run.sleeps).toEqual([1000, 2000, 4000, 1000])
    expect(await outbox.list()).toEqual([])
})

test('a source that must be retried does not hold back the sources after it', async () => {
    const { outbox, lockName } = await setup()
    await outbox.putMany([
        change({ sourceKey: 'dataset:d1' }),
        change({ sourceKey: SOURCE }),
    ])
    let down = true
    const sent: string[] = []
    const run = begin(outbox, lockName, async (sourceKey, records) => {
        sent.push(sourceKey)
        if (sourceKey === 'dataset:d1' && down) {
            down = false
            throw networkDown()
        }
        return records.map((record) => answer(record, 'saved'))
    })
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
    expect(sent).toEqual(['dataset:d1', SOURCE, 'dataset:d1'])
    expect(run.sleeps).toEqual([1000])
    expect(run.statuses).toEqual(['sending', 'retrying', 'sending', 'idle'])
    expect(run.outcomes).toMatchObject([
        { sourceKey: SOURCE, result: 'saved' },
        { sourceKey: 'dataset:d1', result: 'saved' },
    ])
    expect(await outbox.list()).toEqual([])
})

test('a session that has lapsed stops the round at once', async () => {
    const { outbox, lockName } = await setup()
    await outbox.putMany([
        change({ sourceKey: 'dataset:d1' }),
        change({ sourceKey: SOURCE }),
    ])
    const sent: string[] = []
    const run = begin(outbox, lockName, async (sourceKey) => {
        sent.push(sourceKey)
        throw fetchError('access', 'Unauthorized', { httpStatusCode: 401 })
    })
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('signIn'))
    await later(50)
    expect(sent).toEqual(['dataset:d1'])
})

const fetchError = (
    type: FetchError['type'],
    message: string,
    details: FetchError['details'] = {}
) => new FetchError({ type, message, details })

test.each([
    ['a JSON body that says 401', 'Session expired', { httpStatusCode: 401 }],
    ['no JSON message', 'Unauthorized', {}],
    [
        'a JSON body without a status code',
        'Unauthorized',
        { httpStatus: 'Unauthorized' },
    ],
])(
    'pauses with signIn on a 401 with %s and tries again on the next nudge',
    async (_, message, details) => {
        const { outbox, lockName } = await setup()
        await outbox.put(change())
        let expired = true
        let calls = 0
        const run = begin(outbox, lockName, async (_, records) => {
            calls += 1
            if (expired) {
                throw fetchError('access', message, details)
            }
            return records.map((record) => answer(record, 'saved'))
        })
        await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('signIn'))
        await later(50)
        expect(calls).toBe(1)
        expect(run.sleeps).toEqual([])
        expect(await outbox.list()).toMatchObject([{ state: 'queued' }])

        expired = false
        run.sync.nudge()
        await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
        expect(await outbox.list()).toEqual([])
    }
)

test.each([
    [
        'a 403 with a JSON message',
        'access',
        'Access denied',
        { httpStatusCode: 403, message: 'Access denied' },
        'Access denied',
    ],
    [
        'a 403 whose body names the reason',
        'access',
        'Forbidden',
        { httpStatusCode: 403, message: 'No write access to this data set' },
        'No write access to this data set',
    ],
    [
        'a 409 with a JSON message',
        'access',
        'Period closed',
        { httpStatusCode: 409, message: 'Period closed' },
        'Period closed',
    ],
    ['a 403 with no JSON message', 'access', 'Forbidden', {}, 'Forbidden'],
    [
        'a 403 whose message says Unauthorized',
        'access',
        'Unauthorized',
        { httpStatusCode: 403 },
        'Unauthorized',
    ],
    [
        'a 400 with a JSON message',
        'unknown',
        'An unknown error occurred - Bad Request (400)',
        { httpStatusCode: 400, message: 'Value is not a number' },
        'Value is not a number',
    ],
    [
        'a 404 with no message in the body',
        'unknown',
        'An unknown error occurred - Not Found (404)',
        { httpStatusCode: 404 },
        'An unknown error occurred - Not Found (404)',
    ],
] as const)(
    'marks the records of a source failed on %s and still sends the others',
    async (_, type, message, details, reason) => {
        const { outbox, lockName } = await setup()
        await outbox.putMany([
            change({ sourceKey: 'dataset:d1', key: 'r1.c1', value: '1' }),
            change({ sourceKey: 'dataset:d1', key: 'r2.c1', value: '2' }),
            change({ sourceKey: SOURCE, key: 'r1.c1', value: '3' }),
        ])
        const sent: string[] = []
        const run = begin(outbox, lockName, async (sourceKey, records) => {
            sent.push(sourceKey)
            if (sourceKey === 'dataset:d1') {
                throw fetchError(type, message, details)
            }
            return records.map((record) => answer(record, 'saved'))
        })
        await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
        expect(sent).toEqual(['dataset:d1', SOURCE])
        expect(run.sleeps).toEqual([])
        expect(run.statuses).toEqual(['sending', 'idle'])
        expect(run.outcomes).toMatchObject([
            {
                sourceKey: 'dataset:d1',
                key: 'r1.c1',
                result: 'failed',
                reason,
                value: '1',
                at: 1,
            },
            {
                sourceKey: 'dataset:d1',
                key: 'r2.c1',
                result: 'failed',
                reason,
                value: '2',
                at: 1,
            },
            { sourceKey: SOURCE, key: 'r1.c1', result: 'saved', value: '3' },
        ])
        expect(await outbox.list()).toMatchObject([
            { sourceKey: 'dataset:d1', key: 'r1.c1', state: 'failed', reason },
            { sourceKey: 'dataset:d1', key: 'r2.c1', state: 'failed', reason },
        ])
    }
)

test('a refusal leaves a newer change to the same cell queued', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change({ value: '5', at: 1 }))
    const run = begin(outbox, lockName, async () => {
        await outbox.put(change({ value: '6', at: 2 }))
        throw fetchError('access', 'Locked', { httpStatusCode: 409 })
    })
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
    expect(await outbox.list()).toMatchObject([{ value: '6', state: 'queued' }])
})

test.each([
    ['a network failure', 'network', {}],
    [
        'a network failure whose details name a client error',
        'network',
        { httpStatusCode: 404 },
    ],
    ['a 500', 'unknown', { httpStatusCode: 500, message: 'Server error' }],
    ['a request timeout (408)', 'unknown', { httpStatusCode: 408 }],
    ['too many requests (429)', 'unknown', { httpStatusCode: 429 }],
    ['an unknown error with no status code', 'unknown', {}],
] as const)('retries %s with back-off', async (_, type, details) => {
    const { outbox, lockName } = await setup()
    await outbox.put(change())
    let failures = 1
    const run = begin(outbox, lockName, async (_, records) => {
        if (failures-- > 0) {
            throw fetchError(type, 'It failed', details)
        }
        return records.map((record) => answer(record, 'saved'))
    })
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
    expect(run.sleeps).toEqual([1000])
    expect(await outbox.list()).toEqual([])
})

test('waits while offline and sends when the connection returns', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change())
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { save, calls } = answering('saved')
    const run = begin(outbox, lockName, save)
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('offline'))
    await later(50)
    expect(calls).toEqual([])

    online.mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
    expect(calls).toHaveLength(1)
    expect(await outbox.list()).toEqual([])

    online.mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    expect(run.statuses.at(-1)).toBe('offline')
})

test('reports offline, not idle, when the connection dropped during the round', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change())
    const gate = Promise.withResolvers<void>()
    let entered = false
    const run = begin(outbox, lockName, async (_, records) => {
        entered = true
        await gate.promise
        return records.map((record) => answer(record, 'saved'))
    })
    await vi.waitFor(() => expect(entered).toBe(true))
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    gate.resolve()
    await vi.waitFor(() => expect(run.outcomes).toHaveLength(1))
    await later(50)
    expect(run.statuses).toEqual(['sending', 'offline'])

    online.mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(run.statuses.at(-1)).toBe('idle'))
})

test('stop leaves the queue for the lock and ignores later nudges and connection events', async () => {
    const { outbox, lockName } = await setup()
    await outbox.put(change())
    const holder = Promise.withResolvers<void>()
    const held = navigator.locks.request(lockName, () => holder.promise)
    const { save, calls } = answering('saved')
    const run = begin(outbox, lockName, save)
    run.sync.stop()
    run.sync.nudge()
    window.dispatchEvent(new Event('online'))
    const { pending } = await navigator.locks.query()
    expect(pending?.filter((lock) => lock.name === lockName)).toEqual([])
    holder.resolve()
    await held
    await later(50)
    expect(calls).toEqual([])
    expect(await outbox.list()).toHaveLength(1)
})

test('stop lets the source in flight record what the server took and sends no other', async () => {
    const { outbox, lockName } = await setup()
    await outbox.putMany([
        change({ sourceKey: 'dataset:d1' }),
        change({ sourceKey: SOURCE }),
    ])
    const gate = Promise.withResolvers<void>()
    const sent: string[] = []
    const run = begin(outbox, lockName, async (sourceKey, records) => {
        sent.push(sourceKey)
        await gate.promise
        return records.map((record) => answer(record, 'saved'))
    })
    await vi.waitFor(() => expect(sent).toEqual(['dataset:d1']))
    run.sync.stop()
    gate.resolve()
    await vi.waitFor(() => expect(run.outcomes).toHaveLength(1))
    await later(50)
    expect(sent).toEqual(['dataset:d1'])
    expect(await outbox.list()).toMatchObject([{ sourceKey: SOURCE }])
    expect(run.statuses).toEqual(['sending'])
})

test('stop removes the connection listeners it added', async () => {
    const { outbox, lockName } = await setup()
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const run = begin(outbox, lockName, answering('saved').save)
    run.sync.stop()
    const added = add.mock.calls.filter(
        ([type]) => type === 'online' || type === 'offline'
    )
    expect(added.map(([type]) => type).sort()).toEqual(['offline', 'online'])
    for (const [type, listener] of added) {
        expect(remove).toHaveBeenCalledWith(type, listener)
    }
})
