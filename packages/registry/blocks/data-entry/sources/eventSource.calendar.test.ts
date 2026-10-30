import inpatientEvents from './__tests__/fixtures/inpatient-events.json'
import inpatientProgram from './__tests__/fixtures/inpatient-program.json'
import meAdmin from './__tests__/fixtures/me-admin.json'
import { eventSource } from './eventSource'
import type { DataEngine } from './types'

type Request = Parameters<DataEngine['query']>[0]

// The first fixture event, moved to the 5th of the month the tests are set in.
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

const source = (today = '2026-10-26') =>
    eventSource({ programId: 'eBAyeGv0exc', orgUnitId: 'DiszpKrYNg8', today })

const load = (calendar: string, expiryDays?: number) =>
    source().load(engineFor(calendar, expiryDays).engine)

test('the expiry period starts on the first day of the server calendar’s own month', async () => {
    // Checked on 2026-10-25, one expiry day before today: 2026-10-05 is in that month on iso8601, and in the month
    // before on the Ethiopian calendar, whose month starts on the 11th.
    const iso = await load('iso8601')
    expect(iso.readOnlyRows.size).toBe(0)

    const ethiopian = await load('ethiopian')
    expect(ethiopian.readOnlyRows).toEqual(EXPIRED)
})

test('with no expiry days, an event of an earlier period stays writable, as DHIS2 never expires it', async () => {
    expect((await load('ethiopian', 0)).readOnlyRows.size).toBe(0)
})

test('an expiry the calendar library cannot work out leaves the form to load, and the server to refuse', async () => {
    // The library converts Nepali dates of 1970 to 2100 BS only.
    const form = await source('2300-01-01').load(engineFor('nepali').engine)
    expect(form.readOnlyRows.size).toBe(0)
})

test('a page builds its expiry in the calendar the load found, without asking again', async () => {
    const { engine, requests } = engineFor('ethiopian')
    const events = source()
    await events.load(engine)
    const page = await events.loadPage?.(engine, 2)
    expect(page?.readOnlyRows).toEqual(EXPIRED)
    const forms = requests.filter((request) => 'events' in request)
    expect(forms.map((request) => 'systemInfo' in request)).toEqual([
        true,
        false,
    ])
})

test('an unknown calendar is the Gregorian one', async () => {
    const form = await load('julian')
    expect(form.readOnlyRows.size).toBe(0)
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
