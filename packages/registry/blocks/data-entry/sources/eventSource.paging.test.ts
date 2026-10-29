import inpatientEvents from './__tests__/fixtures/inpatient-events.json'
import inpatientProgram from './__tests__/fixtures/inpatient-program.json'
import meAdmin from './__tests__/fixtures/me-admin.json'
import { eventSource } from './eventSource'
import type { DataEngine } from './types'

type Request = Parameters<DataEngine['query']>[0]
type Options = Parameters<DataEngine['query']>[1]

// The fixture holds five events.
const engineFor = () => {
    const requests: Array<[Request, Options]> = []
    // SAFETY: loading only calls `query`, which answers every request from the fixtures.
    const engine = {
        query: async (request: Request, options: Options) => {
            requests.push([request, options])
            return {
                program: inpatientProgram,
                events: inpatientEvents,
                me: meAdmin,
            }
        },
    } as DataEngine
    return { engine, requests }
}

const inpatient = (pageSize: number) =>
    eventSource({
        programId: 'eBAyeGv0exc',
        orgUnitId: 'DiszpKrYNg8',
        today: '2026-10-26',
        pageSize,
    })

test('hasMore is true when a page comes back full and false when it comes back short', async () => {
    expect((await inpatient(5).load(engineFor().engine)).hasMore).toBe(true)
    expect((await inpatient(6).load(engineFor().engine)).hasMore).toBe(false)
    expect(
        (await inpatient(5).loadPage?.(engineFor().engine, 2))?.hasMore
    ).toBe(true)
    expect(
        (await inpatient(6).loadPage?.(engineFor().engine, 2))?.hasMore
    ).toBe(false)
})

test('loadPage asks for the next page in the same order and size', async () => {
    const first = engineFor()
    await inpatient(50).load(first.engine)
    const next = engineFor()
    const signal = new AbortController().signal
    const page = await inpatient(50).loadPage?.(next.engine, 2, signal)

    // A page asks only for its own events: whether the program has rules is the first load's question.
    expect(next.requests).toHaveLength(1)
    const [[request, options]] = next.requests
    expect(request.events.params).toEqual({
        program: 'eBAyeGv0exc',
        orgUnit: 'DiszpKrYNg8',
        orgUnitMode: 'SELECTED',
        pageSize: 50,
        page: 2,
        order: 'occurredAt:desc',
        fields: expect.stringContaining('dataValues'),
    })
    expect(options).toEqual({ signal })
    // The rest of the query is the load's.
    const [[loaded]] = first.requests
    expect({
        ...request,
        events: { ...request.events, params: loaded.events.params },
    }).toEqual(loaded)
    expect(page?.tables[0].rows.map(({ id }) => id)).toEqual(
        inpatientEvents.events.map(({ event }) => event)
    )
})
