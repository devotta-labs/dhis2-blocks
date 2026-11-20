import { cellKey } from '@/components/spreadsheet'
import type { DataEngine } from '@/components/spreadsheet'
import inpatientEvents from './test/fixtures/inpatient-events.json'
import inpatientProgram from './test/fixtures/inpatient-program.json'
import meAdmin from './test/fixtures/me-admin.json'
import orgUnitNames from './test/fixtures/org-unit-names.json'
import systemInfo from './test/fixtures/system-info.json'
import { eventSource } from './eventSource'

type Request = Parameters<DataEngine['query']>[0]
type Options = Parameters<DataEngine['query']>[1]

const PLACE_OF_INFECTION = 'S33cRBsnXPo'
const CHC = 'DiszpKrYNg8'
const MCHP = 'FwKJ7gYEv8U'

const inpatient = eventSource({
    programId: 'eBAyeGv0exc',
    orgUnitId: CHC,
    today: '2026-10-26',
})

const withPlaces = (places: ReadonlyArray<string | undefined>) => ({
    ...inpatientEvents,
    events: inpatientEvents.events.map((event, at) => ({
        ...event,
        dataValues: [
            ...event.dataValues,
            ...(places[at] === undefined
                ? []
                : [{ dataElement: PLACE_OF_INFECTION, value: places[at] }]),
        ],
    })),
})

const manyPlaces = (count: number) => ({
    ...inpatientEvents,
    events: Array.from({ length: count }, (_, at) => ({
        ...inpatientEvents.events[0],
        event: `ev${String(at).padStart(9, '0')}`,
        dataValues: [{ dataElement: PLACE_OF_INFECTION, value: orgUnitId(at) }],
    })),
})
const orgUnitId = (at: number) => `ou${String(at).padStart(9, '0')}`

const idsOf = (request: Request) =>
    /id:in:\[([^\]]*)\]/.exec(JSON.stringify(request))?.[1].split(',') ?? []

const nameEach = async (request: Request) => ({
    orgUnits: {
        organisationUnits: idsOf(request).map((id) => ({
            id,
            displayName: `Name of ${id}`,
        })),
    },
})

const engineFor = <E>(
    events: E,
    names: (
        request: Request
    ) => ReturnType<DataEngine['query']> = async () => ({
        orgUnits: orgUnitNames,
    })
) => {
    const requests: Array<[Request, Options]> = []
    // SAFETY: loading only calls `query`, which answers every request from the fixtures.
    const engine = {
        query: async (request: Request, options: Options) => {
            if (request.rules !== undefined) {
                return { rules: { programRules: [] } }
            }
            requests.push([request, options])
            return request.orgUnits === undefined
                ? { program: inpatientProgram, events, me: meAdmin, systemInfo }
                : names(request)
        },
    } as DataEngine
    return { engine, requests }
}

test('the form loads names for stored org unit values in one request', async () => {
    const { engine, requests } = engineFor(
        withPlaces([CHC, MCHP, CHC, 'Ngelehun, Bo'])
    )
    const signal = new AbortController().signal
    const form = await inpatient.load(engine, signal)
    expect(requests).toHaveLength(2)
    expect(requests[1]).toEqual([
        {
            orgUnits: {
                resource: 'organisationUnits',
                params: {
                    filter: `id:in:[${CHC},${MCHP}]`,
                    fields: 'id,displayName',
                    paging: false,
                },
            },
        },
        { signal },
    ])
    expect(form.orgUnitNames).toEqual(
        new Map([
            [CHC, 'Ngelehun CHC'],
            [MCHP, 'Ngelehun MCHP'],
        ])
    )

    const plain = engineFor(inpatientEvents)
    expect((await inpatient.load(plain.engine)).orgUnitNames).toEqual(new Map())
    expect(plain.requests).toHaveLength(1)
})

test('more than 200 ids are asked for in several requests, sent together, whose names all land', async () => {
    let waiting = 0
    let most = 0
    const { engine, requests } = engineFor(manyPlaces(450), async (request) => {
        waiting += 1
        most = Math.max(most, waiting)
        await Promise.resolve()
        waiting -= 1
        return nameEach(request)
    })
    const form = await inpatient.load(engine)
    expect(requests.slice(1).map(([request]) => idsOf(request).length)).toEqual(
        [200, 200, 50]
    )
    expect(most).toBe(3)
    expect(form.orgUnitNames.size).toBe(450)
    expect(form.orgUnitNames.get(orgUnitId(0))).toBe(`Name of ${orgUnitId(0)}`)
    expect(form.orgUnitNames.get(orgUnitId(449))).toBe(
        `Name of ${orgUnitId(449)}`
    )
})

test('a names request that fails leaves its ids without names; an abort still stops the load', async () => {
    const { engine } = engineFor(manyPlaces(250), async (request) =>
        idsOf(request).includes(orgUnitId(200))
            ? Promise.reject(new Error('Bad request'))
            : nameEach(request)
    )
    const form = await inpatient.load(engine)
    expect(form.tables[0].rows).toHaveLength(250)
    expect(form.values.get(cellKey('ev000000249', PLACE_OF_INFECTION))).toBe(
        orgUnitId(249)
    )
    expect(form.orgUnitNames.size).toBe(200)
    expect(form.orgUnitNames.has(orgUnitId(200))).toBe(false)

    const controller = new AbortController()
    const aborting = engineFor(withPlaces([CHC]), async () => {
        controller.abort()
        return Promise.reject(new Error('The load was aborted'))
    })
    await expect(
        inpatient.load(aborting.engine, controller.signal)
    ).rejects.toThrow('The load was aborted')
})
