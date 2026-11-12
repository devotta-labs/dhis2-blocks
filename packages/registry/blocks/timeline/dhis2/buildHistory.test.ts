import {
    buildHistory,
    hasFirstAnswers,
    orgUnitsToName,
    type Answer,
    type HistorySources,
    type ProgramAnswers,
} from './buildHistory'
import { toProgramInfo } from './metadata'
import {
    ChangeLogPageSchema,
    ProgramTimelineMetadataSchema,
    TrackedEntitySchema,
    TrackerEventSchema,
} from './schemas'

const answered = <T>(data: T): Answer<T> => ({
    data,
    pending: false,
    failed: false,
    refetch: () => undefined,
})

const pending = <T>(data?: T): Answer<T> => ({
    ...answered(data),
    pending: true,
})

const failed = <T>(refetch: () => void = () => undefined): Answer<T> => ({
    data: undefined,
    pending: false,
    failed: true,
    refetch,
})

const programInfo = (id: string, name: string) =>
    toProgramInfo(
        ProgramTimelineMetadataSchema.parse({
            id,
            displayName: name,
            programStages: [{ id: `${id}-stage`, displayName: 'Visit' }],
            programTrackedEntityAttributes: [
                {
                    trackedEntityAttribute: {
                        id: 'firstName',
                        displayName: 'First name',
                        valueType: 'TEXT',
                    },
                },
            ],
        })
    )

const eventsOf = (program: string, count = 1, capped = false) => ({
    events: Array.from({ length: count }, (_, index) =>
        TrackerEventSchema.parse({
            event: `${program}-event-${index}`,
            status: 'COMPLETED',
            program,
            programStage: `${program}-stage`,
            orgUnit: 'ou1',
            occurredAt: `2026-09-0${index + 1}T00:00:00.000`,
        })
    ),
    capped,
})

const changesOf = (createdAt: string, truncated = false) => ({
    rows: ChangeLogPageSchema.parse({
        changeLogs: [
            {
                createdAt,
                createdBy: { username: 'admin' },
                type: 'UPDATE',
                change: {
                    attributeValue: {
                        attribute: 'firstName',
                        previousValue: 'Ana',
                        currentValue: 'Anna',
                    },
                },
            },
        ],
    }).rows,
    truncated,
    unsupported: false,
})

const UNSUPPORTED = { rows: [], truncated: false, unsupported: true }

const entity = TrackedEntitySchema.parse({
    trackedEntity: 'te1',
    enrollments: [
        {
            enrollment: 'enr-a',
            program: 'a',
            status: 'ACTIVE',
            enrolledAt: '2026-08-01T00:00:00.000',
        },
        {
            enrollment: 'enr-b',
            program: 'b',
            status: 'ACTIVE',
            enrolledAt: '2026-08-02T00:00:00.000',
        },
    ],
})

const program = (
    id: string,
    overrides: Partial<ProgramAnswers> = {}
): ProgramAnswers => ({
    id,
    info: answered(programInfo(id, `Program ${id.toUpperCase()}`)),
    events: answered(eventsOf(id)),
    changes: answered(changesOf('2026-10-01T08:00:00.000')),
    ...overrides,
})

const sources = (overrides: Partial<HistorySources> = {}): HistorySources => ({
    trackedEntity: answered(entity),
    programs: [program('a'), program('b')],
    orgUnitNames: answered(new Map([['ou1', 'Ngelehun CHC']])),
    shown: false,
    timeField: 'occurredAt',
    cap: 500,
    today: '2026-10-22',
    ...overrides,
})

const kindsOf = (history: { entries: ReadonlyArray<{ id: string }> }) =>
    [...new Set(history.entries.map((entry) => entry.id.split(':')[0]))].sort()

const noticeIds = (history: { notices: ReadonlyArray<{ id: string }> }) =>
    history.notices.map((notice) => notice.id)

describe('buildHistory', () => {
    it('shows events, milestones and changes of every program, with names', () => {
        const history = buildHistory(sources())

        expect(history).toMatchObject({ isPending: false, isError: false })
        expect(kindsOf(history)).toEqual(['change', 'event', 'milestone'])
        expect(history.notices).toEqual([])
        expect(
            history.entries.find((entry) => entry.id === 'event:a-event-0')
                ?.data
        ).toMatchObject({
            kind: 'event',
            program: { name: 'Program A' },
            orgUnitName: 'Ngelehun CHC',
        })
    })

    it("keeps a save two programs' changelogs share once", () => {
        const history = buildHistory(sources())

        expect(
            history.entries.filter((entry) => entry.id.startsWith('change:'))
        ).toHaveLength(1)
    })

    it.each([
        ['the enrollments', { trackedEntity: pending<typeof entity>() }],
        [
            "a program's events",
            { programs: [program('a'), program('b', { events: pending() })] },
        ],
        [
            "a program's metadata",
            { programs: [program('a'), program('b', { info: pending() })] },
        ],
        [
            'the org unit names',
            { orgUnitNames: pending<ReadonlyMap<string, string>>() },
        ],
    ])('shows nothing until %s have answered once', (_what, overrides) => {
        expect(buildHistory(sources(overrides))).toMatchObject({
            entries: [],
            isPending: true,
            isError: false,
        })
    })

    it("doesn't wait for the changes, and adds them when they arrive", () => {
        const waiting = buildHistory(
            sources({
                programs: [
                    program('a', { changes: pending() }),
                    program('b', { changes: pending() }),
                ],
            })
        )

        expect(waiting.isPending).toBe(false)
        expect(kindsOf(waiting)).toEqual(['event', 'milestone'])
        expect(kindsOf(buildHistory(sources()))).toContain('change')
    })

    it('never empties once shown: what has answered stays while the rest loads', () => {
        const history = buildHistory(
            sources({
                shown: true,
                trackedEntity: pending(entity),
                programs: [
                    program('a', { events: pending() }),
                    // Newly enrolled: nothing of it shows until its metadata has.
                    program('b', { info: pending() }),
                ],
                orgUnitNames: pending(new Map([['ou1', 'Ngelehun CHC']])),
            })
        )

        expect(history.isPending).toBe(false)
        expect(history.entries.map((entry) => entry.id).sort()).toEqual([
            'change:2026-10-01T08:00:00.000:admin',
            'milestone:enr-a:enrolled',
        ])
    })

    it('turns each failed part into a notice with its own retry, and shows the rest', () => {
        const retried: string[] = []
        const history = buildHistory(
            sources({
                programs: [
                    program('a', {
                        events: failed(() => retried.push('events')),
                        changes: failed(() => retried.push('changes')),
                    }),
                    program('b', { info: failed(() => retried.push('info')) }),
                ],
                orgUnitNames: failed(() => retried.push('names')),
            })
        )

        expect(history).toMatchObject({ isPending: false, isError: false })
        expect(history.notices).toMatchObject([
            {
                id: 'events-failed:a',
                tone: 'error',
                message: "Events in Program A couldn't load.",
            },
            {
                id: 'metadata-failed:b',
                tone: 'warning',
                message:
                    "Details of program b couldn't load, so ids are shown.",
            },
            { id: 'org-units-failed', tone: 'warning' },
            {
                id: 'changes-failed:a',
                tone: 'error',
                message: "Changes in Program A couldn't load.",
            },
        ])
        for (const notice of history.notices) {
            notice.retry?.()
        }
        expect(retried).toEqual(['events', 'info', 'names', 'changes'])
        // Program B shows by id, program A's milestone without its events.
        expect(history.entries.map((entry) => entry.id)).toEqual(
            expect.arrayContaining([
                'event:b-event-0',
                'milestone:enr-a:enrolled',
            ])
        )
    })

    it('says when events were capped, changes left out or changes unsupported', () => {
        const history = buildHistory(
            sources({
                cap: 2,
                programs: [
                    program('a', {
                        events: answered(eventsOf('a', 2, true)),
                        changes: answered(UNSUPPORTED),
                    }),
                    program('b', {
                        changes: answered(
                            changesOf('2026-10-01T08:00:00.000', true)
                        ),
                    }),
                ],
            })
        )

        expect(history.notices).toMatchObject([
            {
                id: 'events-capped:a',
                tone: 'info',
                message: 'Showing the most recent 2 events in Program A.',
            },
            { id: 'changes-unsupported', tone: 'info' },
            { id: 'changes-truncated:b', tone: 'info' },
        ])
        expect(history.notices.every((notice) => !notice.retry)).toBe(true)
    })

    it('is an error when the enrollments failed and say no programs', () => {
        const history = buildHistory(
            sources({ trackedEntity: failed(), programs: undefined })
        )

        expect(history).toMatchObject({
            entries: [],
            isPending: false,
            isError: true,
        })
        expect(noticeIds(history)).toEqual(['enrollments-failed'])
    })

    it('with given programs, is an error only when every program failed too', () => {
        const allFailed = buildHistory(
            sources({
                trackedEntity: failed(),
                programs: [
                    program('a', { events: failed() }),
                    program('b', { events: failed() }),
                ],
            })
        )
        const oneLoaded = buildHistory(
            sources({
                trackedEntity: failed(),
                programs: [program('a', { events: failed() }), program('b')],
            })
        )

        expect(allFailed).toMatchObject({ entries: [], isError: true })
        expect(oneLoaded.isError).toBe(false)
        expect(noticeIds(oneLoaded)).toEqual([
            'enrollments-failed',
            'events-failed:a',
        ])
        expect(kindsOf(oneLoaded)).toEqual(['change', 'event'])
    })

    it('is an empty history, not an error, for someone enrolled nowhere', () => {
        const history = buildHistory(
            sources({
                trackedEntity: answered({ ...entity, enrollments: [] }),
                programs: [],
                orgUnitNames: answered(new Map()),
            })
        )

        expect(history).toEqual({
            entries: [],
            isPending: false,
            isError: false,
            notices: [],
        })
    })
})

describe('hasFirstAnswers', () => {
    it("is true once every program's events and metadata answered or failed", () => {
        expect(hasFirstAnswers(undefined)).toBe(false)
        expect(hasFirstAnswers([])).toBe(true)
        expect(
            hasFirstAnswers([
                program('a', { events: failed(), changes: pending() }),
            ])
        ).toBe(true)
        expect(hasFirstAnswers([program('a', { info: pending() })])).toBe(false)
    })
})

describe('orgUnitsToName', () => {
    it('names the org units of the programs on show', () => {
        expect(orgUnitsToName(undefined)).toEqual([])
        expect(
            orgUnitsToName([program('a'), program('b', { info: pending() })])
        ).toEqual(['ou1'])
    })
})
