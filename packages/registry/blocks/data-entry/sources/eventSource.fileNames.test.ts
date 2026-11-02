import fileNames from './__tests__/fixtures/file-names.json'
import inpatientEvents from './__tests__/fixtures/inpatient-events.json'
import inpatientProgram from './__tests__/fixtures/inpatient-program.json'
import meAdmin from './__tests__/fixtures/me-admin.json'
import orgUnitNames from './__tests__/fixtures/org-unit-names.json'
import systemInfo from './__tests__/fixtures/system-info.json'
import { eventSource } from './eventSource'
import type { DataEngine } from './types'

type Request = Parameters<DataEngine['query']>[0]
type Options = Parameters<DataEngine['query']>[1]

// The inpatient stage's file and org unit data elements.
const DOCUMENTATION = 'ulD2zW0TIy2'
const PLACE_OF_INFECTION = 'S33cRBsnXPo'
const CHC = 'DiszpKrYNg8'
const [DOC, SUMMARY] = fileNames.fileResources.map(({ id }) => id)

const inpatient = eventSource({
    programId: 'eBAyeGv0exc',
    orgUnitId: CHC,
    today: '2026-10-26',
})

/** The inpatient events: the first holds a file and an org unit, the second another file, the third a value that is no id. */
const events = {
    ...inpatientEvents,
    events: inpatientEvents.events.map((event, at) => ({
        ...event,
        dataValues: [
            ...event.dataValues,
            ...([
                [
                    { dataElement: DOCUMENTATION, value: DOC },
                    { dataElement: PLACE_OF_INFECTION, value: CHC },
                ],
                [{ dataElement: DOCUMENTATION, value: SUMMARY }],
                [{ dataElement: DOCUMENTATION, value: 'scan.pdf' }],
            ].at(at) ?? []),
        ],
    })),
}

/** DHIS2 for the load: file metadata is readable by id, not through the privileged collection endpoint. */
const engineFor = (
    answer: Promise<void>,
    refuseFiles: boolean | string = false,
    loadedEvents = events
) => {
    const requests: Array<[Request, Options]> = []
    // SAFETY: loading only calls `query`, which answers every request from the fixtures.
    const engine = {
        query: async (request: Request, options: Options) => {
            // Whether the program has rules is not what these tests count.
            if (request.rules !== undefined) {
                return { rules: { programRules: [] } }
            }
            requests.push([request, options])
            if (request.program !== undefined) {
                return {
                    program: inpatientProgram,
                    events: loadedEvents,
                    me: meAdmin,
                    systemInfo,
                }
            }
            await answer
            if (request.file !== undefined) {
                if (refuseFiles === true || request.file.id === refuseFiles) {
                    throw new Error('Forbidden')
                }
                return {
                    file: fileNames.fileResources.find(
                        ({ id }) => id === request.file.id
                    ) ?? { name: `File ${request.file.id}` },
                }
            }
            return { orgUnits: orgUnitNames }
        },
    } as DataEngine
    return { engine, requests }
}

test('the form reads each stored file by id alongside the org unit names request', async () => {
    let answer = () => {}
    const { engine, requests } = engineFor(
        new Promise((resolve) => {
            answer = resolve
        })
    )
    const signal = new AbortController().signal
    const loading = inpatient.load(engine, signal)
    // Both files and the org units are requested before any names answer.
    await expect.poll(() => requests.length).toBe(4)
    answer()
    const form = await loading
    expect(requests.filter(([request]) => request.file !== undefined)).toEqual(
        [DOC, SUMMARY].map((id) => [
            {
                file: {
                    resource: 'fileResources',
                    id,
                    params: { fields: 'name' },
                },
            },
            { signal },
        ])
    )
    expect(form.fileNames).toEqual(
        new Map([
            [DOC, 'doc.pdf'],
            [SUMMARY, 'Good health activity summary.doc'],
        ])
    )
    expect(form.orgUnitNames.get(CHC)).toBe('Ngelehun CHC')
})

test('a refused file lookup does not discard another file name', async () => {
    const { engine } = engineFor(Promise.resolve(), DOC)
    const form = await inpatient.load(engine)
    expect(form.fileNames).toEqual(
        new Map([[SUMMARY, 'Good health activity summary.doc']])
    )
})

test('file lookups are deduplicated and at most eight run together', async () => {
    const ids = Array.from(
        { length: 20 },
        (_, at) => `fl${String(at).padStart(9, '0')}`
    )
    const many = {
        ...events,
        events: [...ids, ids[0]].map((id, at) => ({
            ...events.events[0],
            event: `ev${String(at).padStart(9, '0')}`,
            dataValues: [{ dataElement: DOCUMENTATION, value: id }],
        })),
    }
    let answer = () => {}
    const { engine, requests } = engineFor(
        new Promise((resolve) => {
            answer = resolve
        }),
        false,
        many
    )
    const loading = inpatient.load(engine)
    await expect
        .poll(() => requests.filter(([request]) => request.file).length)
        .toBe(8)
    answer()
    const form = await loading
    expect(requests.filter(([request]) => request.file)).toHaveLength(20)
    expect(form.fileNames.size).toBe(20)
    expect(form.fileNames.get(ids[19])).toBe(`File ${ids[19]}`)
})

test('a file names request that fails leaves those files without names, and the form opens', async () => {
    const { engine } = engineFor(Promise.resolve(), true)
    const form = await inpatient.load(engine)
    expect(form.fileNames).toEqual(new Map())
    expect(form.orgUnitNames.get(CHC)).toBe('Ngelehun CHC')
    expect(form.tables[0].rows).toHaveLength(inpatientEvents.events.length)
})
