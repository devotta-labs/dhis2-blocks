import inpatientEvents from './__tests__/fixtures/inpatient-events.json'
import inpatientProgram from './__tests__/fixtures/inpatient-program.json'
import meAdmin from './__tests__/fixtures/me-admin.json'
import { eventSource } from './eventSource'
import type { DataEngine } from './types'

type Request = Parameters<DataEngine['query']>[0]

// The first fixture event, moved into the month before the tests' today.
const events = {
    ...inpatientEvents,
    events: inpatientEvents.events.map((event, at) =>
        at === 0 ? { ...event, occurredAt: '2026-10-05T00:00:00.000' } : event
    ),
}
// A user with no authority to edit expired events.
const me = { ...meAdmin, authorities: [] }

const EXPIRED = new Map([['NGxc7JpmqqD', 'This event is in an expired period']])

/** A server on `calendar` that answers every request from the fixtures, and the calendar only when asked. */
const engineFor = (calendar: string, expiryDays = 1) => {
    const requests: Request[] = []
    const program = {
        ...inpatientProgram,
        expiryPeriodType: 'Monthly',
        expiryDays,
    }
    // SAFETY: loading only calls `query`, which answers every request from the fixtures.
    const engine = {
        query: async (request: Request) => {
            requests.push(request)
            const asked = 'systemInfo' in request
            return {
                program,
                events,
                me,
                ...(asked && { systemInfo: { calendar } }),
            }
        },
    } as DataEngine
    return { engine, requests }
}

const source = (today = '2026-11-02') =>
    eventSource({ programId: 'eBAyeGv0exc', orgUnitId: 'DiszpKrYNg8', today })

const load = (calendar: string, expiryDays?: number) =>
    source().load(engineFor(calendar, expiryDays).engine)

test('a Gregorian server expires an event of an earlier period; another calendar leaves it to the server', async () => {
    expect((await load('iso8601')).readOnlyRows).toEqual(EXPIRED)
    expect((await load('ethiopian')).readOnlyRows.size).toBe(0)
})

test('with no expiry days, an event of an earlier period stays writable, as DHIS2 never expires it', async () => {
    expect((await load('iso8601', 0)).readOnlyRows.size).toBe(0)
})

test('a page builds its expiry in the calendar the load found, without asking again', async () => {
    // Gregorian, the calendar it would assume, would expire the event.
    const { engine, requests } = engineFor('ethiopian')
    const events = source()
    await events.load(engine)
    const page = await events.loadPage?.(engine, 2)
    expect(page?.readOnlyRows.size).toBe(0)
    const forms = requests.filter((request) => 'events' in request)
    expect(forms.map((request) => 'systemInfo' in request)).toEqual([
        true,
        false,
    ])
})

test('an unknown calendar is the Gregorian one', async () => {
    expect((await load('julian')).readOnlyRows).toEqual(EXPIRED)
})

test('the calendar is asked for in the form’s own query', async () => {
    const { engine, requests } = engineFor('iso8601')
    await eventSource({
        programId: 'eBAyeGv0exc',
        orgUnitId: 'DiszpKrYNg8',
    }).load(engine)
    expect(requests[0].systemInfo).toEqual({
        resource: 'system/info',
        params: { fields: 'calendar' },
    })
})
