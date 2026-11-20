import type { DataEngine } from '@/components/spreadsheet'
import inpatientEvents from './test/fixtures/inpatient-events.json'
import inpatientProgram from './test/fixtures/inpatient-program.json'
import meAdmin from './test/fixtures/me-admin.json'
import systemInfo from './test/fixtures/system-info.json'
import { eventSource } from './eventSource'

type Request = Parameters<DataEngine['query']>[0]
type Options = Parameters<DataEngine['query']>[1]

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
                systemInfo,
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
    const [[loaded]] = first.requests
    expect({
        ...request,
        events: { ...request.events, params: loaded.events.params },
    }).toEqual(loaded)
    expect(page?.tables[0].rows.map(({ id }) => id)).toEqual(
        inpatientEvents.events.map(({ event }) => event)
    )
})
