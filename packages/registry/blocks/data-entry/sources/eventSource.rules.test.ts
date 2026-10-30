import inpatientEvents from './__tests__/fixtures/inpatient-events.json'
import inpatientProgram from './__tests__/fixtures/inpatient-program.json'
import meAdmin from './__tests__/fixtures/me-admin.json'
import rmnchEvents from './__tests__/fixtures/rmnch-person-events.json'
import rmnchProgram from './__tests__/fixtures/rmnch-program.json'
import systemInfo from './__tests__/fixtures/system-info.json'
import { eventSource } from './eventSource'
import type { DataEngine } from './types'

const INPATIENT = 'eBAyeGv0exc'
const INPATIENT_STAGE = 'Zj7UnCAulEk'
const RMNCH = 'WSGAb5XwJ3Y'
const PERSON = 'PE6abx7Zhn0'

type Request = Parameters<DataEngine['query']>[0]

/** DHIS2 answering from the fixtures; `ruleAnswer` is what it says to the question whether the program has rules. */
const engineFor = <P, E>(
    program: P,
    events: E,
    ruleAnswer: () => ReturnType<DataEngine['query']> = async () => ({
        rules: { programRules: [] },
    })
) => {
    const requests: Request[] = []
    // SAFETY: loading only calls `query`, which answers every request from the fixtures.
    const engine = {
        query: async (request: Request) => {
            requests.push(request)
            if (request.rules !== undefined) {
                return ruleAnswer()
            }
            // The form's query is the heavier one: it answers after the question about rules, unless that is still out.
            await new Promise((resolve) => setTimeout(resolve))
            return { program, events, me: meAdmin, systemInfo }
        },
    } as DataEngine
    return { engine, requests }
}

const inpatient = eventSource({
    programId: INPATIENT,
    orgUnitId: 'DiszpKrYNg8',
    today: '2026-10-26',
})

const person = eventSource({
    programId: RMNCH,
    orgUnitId: 'm7fBMpmVpSM',
    enrollmentId: PERSON,
    order: 'occurredAt:asc',
    today: '2026-10-26',
})

test('the form names the program, the stages shown and the people its rules run for', async () => {
    const events = await inpatient.load(
        engineFor(inpatientProgram, inpatientEvents).engine
    )
    expect(events.rules).toEqual({
        programId: INPATIENT,
        programStageIds: [INPATIENT_STAGE],
        tracker: false,
        enrollmentIds: [],
        hasRules: false,
    })

    const people = await person.load(
        engineFor(rmnchProgram, rmnchEvents).engine
    )
    expect(people.rules).toEqual({
        programId: RMNCH,
        programStageIds: [
            'WZbXY0S00lP',
            'edqlbukwRfQ',
            'PFDfvmGpsR3',
            'bbKtnxRZKEP',
        ],
        tracker: true,
        enrollmentIds: [PERSON],
        hasRules: false,
    })
})

const ruleIds =
    (...ids: string[]) =>
    async () => ({
        rules: { programRules: ids.map((id) => ({ id })) },
    })

test('the form says whether the program has rules, from one rule’s id asked for beside its own query', async () => {
    const withRules = engineFor(
        inpatientProgram,
        inpatientEvents,
        ruleIds('Fj2WZ8EGGGA')
    )
    const loading = inpatient.load(withRules.engine)
    // Both go out together, before either answers; the form's first.
    expect(withRules.requests).toHaveLength(2)
    expect(withRules.requests[0]).not.toHaveProperty('rules')
    expect(withRules.requests[1].rules).toEqual({
        resource: 'programRules',
        params: {
            filter: `program.id:eq:${INPATIENT}`,
            fields: 'id',
            pageSize: 1,
        },
    })
    expect((await loading).rules?.hasRules).toBe(true)

    const without = engineFor(inpatientProgram, inpatientEvents, ruleIds())
    expect((await inpatient.load(without.engine)).rules?.hasRules).toBe(false)
})

test('a question about rules that fails, or is not understood, never stops the form: it says there are none', async () => {
    const refused = engineFor(inpatientProgram, inpatientEvents, async () => {
        throw new Error('Bad gateway')
    })
    const form = await inpatient.load(refused.engine)
    expect(form.rules?.hasRules).toBe(false)
    expect(form.tables[0].rows).toHaveLength(inpatientEvents.events.length)

    const garbled = engineFor(inpatientProgram, inpatientEvents, async () => ({
        rules: { programRules: 'none' },
    }))
    expect((await inpatient.load(garbled.engine)).rules?.hasRules).toBe(false)
})

test('the form never waits for the question about rules: one still out when the form is ready says there are none', async () => {
    const out = engineFor(
        inpatientProgram,
        inpatientEvents,
        () => new Promise<never>(() => {})
    )
    const form = await inpatient.load(out.engine)
    expect(form.rules?.hasRules).toBe(false)
    expect(form.tables[0].rows).toHaveLength(inpatientEvents.events.length)
})
