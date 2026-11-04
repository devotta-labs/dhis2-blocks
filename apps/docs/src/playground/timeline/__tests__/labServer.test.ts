import {
    ChangeLogPageSchema,
    EventsPageSchema,
    OrgUnitNamesSchema,
    ProgramTimelineMetadataSchema,
    TrackedEntitySchema,
} from '@/components/timeline/dhis2/schemas'
import { EVENT_FIELDS } from '@/components/timeline/dhis2/queries'
import { describe, expect, it } from 'vitest'
import {
    generateLabData,
    LAB_PERSON,
    LAB_PROGRAMS,
    ORG_UNITS,
} from '../labData'
import { answer, labNetwork, resourcesOf } from '../labServer'
import { DEFAULT_SETTINGS, PRESETS } from '../presets'

const TODAY = '2026-11-04'

const settingsOf = (name: string) => {
    const found = PRESETS.find((preset) => preset.name === name)
    if (!found) throw new Error(`No preset ${name}`)
    return found.settings
}

const serverFor = (settings = DEFAULT_SETTINGS) => {
    const data = generateLabData(settings, TODAY)
    return { data, respond: answer(settings, data) }
}

const [ANC, HYPERTENSION] = LAB_PROGRAMS.map(({ id }) => id)

/** The block's own events request: one program, `cap + 1` rows, newest first. */
const eventsOf = (
    respond: ReturnType<typeof answer>,
    program = ANC,
    { timeField = 'occurredAt', pageSize = 501 } = {}
) =>
    EventsPageSchema.parse(
        respond({
            resource: 'tracker/events',
            params: {
                trackedEntity: LAB_PERSON,
                program: program ?? '',
                fields: EVENT_FIELDS,
                order: `${timeField}:desc,event:asc`,
                page: 1,
                pageSize,
            },
        })
    )

const attributeChangesOf = (
    respond: ReturnType<typeof answer>,
    program: string,
    page = 1
) =>
    ChangeLogPageSchema.parse(
        respond({
            resource: `tracker/trackedEntities/${LAB_PERSON}/changeLogs`,
            params: { program, order: 'createdAt:desc', page, pageSize: 100 },
        })
    )

describe('the timeline lab server', () => {
    it('answers the tracked entity with an enrollment per program, in the shape the block parses', () => {
        const { respond } = serverFor()
        const entity = TrackedEntitySchema.parse(
            respond({ resource: 'tracker/trackedEntities', id: LAB_PERSON })
        )
        expect(
            new Set(entity.enrollments.map(({ program }) => program))
        ).toEqual(new Set([ANC, HYPERTENSION]))
        // The long antenatal history is two pregnancies, the first one closed.
        expect(
            entity.enrollments
                .filter(({ program }) => program === ANC)
                .map(({ status }) => status)
        ).toEqual(['COMPLETED', 'ACTIVE'])
        expect(
            entity.enrollments.every(({ notes }) => notes.length === 1)
        ).toBe(true)
    })

    it('answers 404 for another tracked entity', () => {
        const { respond } = serverFor()
        expect(() =>
            respond({ resource: 'tracker/trackedEntities', id: 'someoneElse' })
        ).toThrow(
            expect.objectContaining({
                details: expect.objectContaining({ httpStatusCode: 404 }),
            })
        )
    })

    it('answers program metadata in the shape the block parses', () => {
        const { respond } = serverFor()
        const metadata = ProgramTimelineMetadataSchema.parse(
            respond({ resource: 'programs', id: ANC })
        )
        expect(metadata.displayName).toBe('Antenatal care')
        expect(metadata.programStages.length).toBe(3)
        expect(metadata.programTrackedEntityAttributes.length).toBeGreaterThan(
            0
        )
    })

    it("answers one program's events, newest first with undated ones first, as DHIS2 orders them", () => {
        const { respond } = serverFor()
        const events = eventsOf(respond)
        expect(events.every(({ program }) => program === ANC)).toBe(true)
        // Scheduled and skipped visits have no occurredAt, so they come first.
        const firstDated = events.findIndex(
            ({ occurredAt }) => occurredAt !== undefined
        )
        expect(
            events
                .slice(0, firstDated)
                .every(({ occurredAt }) => occurredAt === undefined)
        ).toBe(true)
        const dated = events
            .slice(firstDated)
            .map(({ occurredAt }) => occurredAt ?? '')
        expect(dated).toEqual([...dated].sort().reverse())
        expect(new Set(events.map(({ status }) => status))).toEqual(
            new Set(['SCHEDULE', 'SKIPPED', 'ACTIVE', 'COMPLETED'])
        )
    })

    it('honours the time field in the order', () => {
        const { respond } = serverFor()
        const byDue = eventsOf(respond, ANC, { timeField: 'scheduledAt' }).map(
            ({ scheduledAt }) => scheduledAt ?? ''
        )
        expect(byDue).toEqual([...byDue].sort().reverse())
    })

    it('sends one more than the cap for Over 500 events, so the block shows its cap notice', () => {
        const { respond } = serverFor(settingsOf('Over 500 events'))
        expect(eventsOf(respond, ANC)).toHaveLength(501)
        expect(eventsOf(respond, HYPERTENSION).length).toBeLessThan(501)
    })

    it('names every org unit the events use', () => {
        const { data, respond } = serverFor()
        const ids = [
            ...new Set(data.events.map(({ orgUnit }) => orgUnit)),
        ].sort()
        const names = OrgUnitNamesSchema.parse(
            respond({
                resource: 'organisationUnits',
                params: {
                    filter: `id:in:[${ids.join(',')}]`,
                    fields: 'id,displayName',
                    paging: false,
                },
            })
        )
        expect(names.map(({ id }) => id).sort()).toEqual(ids)
        expect(
            names.every(
                ({ id, displayName }) => ORG_UNITS.get(id) === displayName
            )
        ).toBe(true)
    })

    it("answers each program's attribute changes, the type's attributes in every one", () => {
        const { respond } = serverFor()
        const anc = attributeChangesOf(respond, ANC).rows
        const hypertension = attributeChangesOf(respond, HYPERTENSION).rows
        expect(anc.length).toBeGreaterThan(0)
        const firstName = (rows: typeof anc) =>
            rows.filter(({ change }) => change.id === 'labAttFirst')
        expect(firstName(anc)).toEqual(firstName(hypertension))
        expect(anc.map(({ createdAt }) => createdAt)).toEqual(
            anc
                .map(({ createdAt }) => createdAt)
                .sort()
                .reverse()
        )
    })

    it('pages a long attribute changelog by 100 rows', () => {
        const { respond } = serverFor(settingsOf('Over 500 changes'))
        const pages = [1, 2, 3, 4, 5, 6].map((page) =>
            attributeChangesOf(respond, HYPERTENSION, page)
        )
        expect(pages.map(({ received }) => received).slice(0, 5)).toEqual([
            100, 100, 100, 100, 100,
        ])
        expect(pages[5]?.received).toBeGreaterThan(0)
    })

    it("answers each event's changes, including the correction on edited ones", () => {
        const { data, respond } = serverFor()
        const edited = data.events.find(
            ({ createdAt, updatedAt, dataValues }) =>
                dataValues.length > 0 && createdAt !== updatedAt
        )
        expect(edited).toBeDefined()
        const page = ChangeLogPageSchema.parse(
            respond({
                resource: `tracker/events/${edited?.event}/changeLogs`,
                params: { order: 'createdAt:desc', page: 1, pageSize: 100 },
            })
        )
        expect(page.rows[0]?.type).toBe('UPDATE')
        expect(
            page.rows.some(({ change }) => change.kind === 'eventField')
        ).toBe(true)
    })

    it('answers 404 from every changelog when there is none', () => {
        const { data, respond } = serverFor(settingsOf('No changelog endpoint'))
        for (const resource of resourcesOf(data)
            .filter((each) => each.endsWith('/changeLogs'))
            .slice(0, 3)) {
            expect(() =>
                respond({ resource, params: { program: ANC ?? '' } })
            ).toThrow(
                expect.objectContaining({
                    details: expect.objectContaining({ httpStatusCode: 404 }),
                })
            )
        }
    })

    it('lists every changelog resource, so none is left without an answer', () => {
        const { data } = serverFor()
        const resources = new Set(resourcesOf(data))
        expect(
            resources.has(`tracker/trackedEntities/${LAB_PERSON}/changeLogs`)
        ).toBe(true)
        expect(
            data.events.every(({ event }) =>
                resources.has(`tracker/events/${event}/changeLogs`)
            )
        ).toBe(true)
    })

    it('fails only the broken part', () => {
        const failing = (name: string) => {
            const settings = settingsOf(name)
            const network = labNetwork(
                settings,
                generateLabData(settings, TODAY)
            )
            return Object.entries(network.endpoints)
                .filter(([, endpoint]) => endpoint?.behaviour === 'fails')
                .map(([resource]) => resource)
        }
        expect(failing('Two programs')).toEqual([])
        expect(failing('Program details fail')).toEqual(['programs'])
        expect(failing('Org unit names fail')).toEqual(['organisationUnits'])
        expect(
            failing('Changes fail').every((resource) =>
                resource.endsWith('/changeLogs')
            )
        ).toBe(true)
    })

    it('has no enrollments for No history', () => {
        const { respond } = serverFor(settingsOf('No history'))
        expect(
            TrackedEntitySchema.parse(
                respond({ resource: 'tracker/trackedEntities', id: LAB_PERSON })
            ).enrollments
        ).toEqual([])
    })

    it('sets the system calendar to the chosen one', () => {
        expect(
            generateLabData(
                { ...DEFAULT_SETTINGS, calendar: 'ethiopian' },
                TODAY
            ).systemInfo.calendar
        ).toBe('ethiopian')
    })

    it('generates the same data for the same settings', () => {
        expect(generateLabData(settingsOf('Two programs'), TODAY)).toEqual(
            generateLabData(settingsOf('Two programs'), TODAY)
        )
    })
})
