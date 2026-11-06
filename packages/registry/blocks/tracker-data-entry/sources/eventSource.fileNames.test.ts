import type { DataEngine } from '@/components/spreadsheet'
import fileNames from './__tests__/fixtures/file-names.json'
import inpatientEvents from './__tests__/fixtures/inpatient-events.json'
import inpatientProgram from './__tests__/fixtures/inpatient-program.json'
import meAdmin from './__tests__/fixtures/me-admin.json'
import orgUnitNames from './__tests__/fixtures/org-unit-names.json'
import systemInfo from './__tests__/fixtures/system-info.json'
import { eventSource } from './eventSource'

type Request = Parameters<DataEngine['query']>[0]
type Options = Parameters<DataEngine['query']>[1]

// The inpatient stage's file and org unit data elements.
const DOCUMENTATION = 'ulD2zW0TIy2'
const PLACE_OF_INFECTION = 'S33cRBsnXPo'
const CHC = 'DiszpKrYNg8'
const [DOC, SUMMARY] = fileNames.map(({ id }) => id)

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

/** DHIS2 for the load: names are answered once `answer` lets them; the files in `refused` are refused. */
const engineFor = (
    answer: Promise<void>,
    refused: ReadonlySet<string> = new Set()
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
                    events,
                    me: meAdmin,
                    systemInfo,
                }
            }
            await answer
            if (request.file === undefined) {
                return { orgUnits: orgUnitNames }
            }
            const file = fileNames.find(({ id }) => id === request.file?.id)
            if (file === undefined || refused.has(file.id)) {
                throw new Error('Forbidden')
            }
            return { file }
        },
    } as DataEngine
    return { engine, requests }
}

test('the form loads the name of each stored file by its id, sent with the org unit names request', async () => {
    let answer = () => {}
    const { engine, requests } = engineFor(
        new Promise((resolve) => {
            answer = resolve
        })
    )
    const signal = new AbortController().signal
    const loading = inpatient.load(engine, signal)
    // Every names request is made before any answers.
    await expect.poll(() => requests.length).toBe(4)
    answer()
    const form = await loading
    expect(requests.filter(([request]) => request.file !== undefined)).toEqual(
        [DOC, SUMMARY].map((id) => [
            {
                file: {
                    resource: 'fileResources',
                    id,
                    params: { fields: 'id,name' },
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

test('a file whose name is refused is left without one, and the others keep theirs', async () => {
    const { engine } = engineFor(Promise.resolve(), new Set([DOC]))
    const form = await inpatient.load(engine)
    expect(form.fileNames).toEqual(
        new Map([[SUMMARY, 'Good health activity summary.doc']])
    )
    expect(form.tables[0].rows).toHaveLength(inpatientEvents.events.length)
})

test('file names that are all refused leave the files without names, and the form opens', async () => {
    const { engine } = engineFor(Promise.resolve(), new Set([DOC, SUMMARY]))
    const form = await inpatient.load(engine)
    expect(form.fileNames).toEqual(new Map())
    expect(form.orgUnitNames.get(CHC)).toBe('Ngelehun CHC')
    expect(form.tables[0].rows).toHaveLength(inpatientEvents.events.length)
})
