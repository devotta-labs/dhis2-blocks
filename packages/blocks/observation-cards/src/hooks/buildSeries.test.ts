import { buildSeries } from './buildSeries'
import type {
    DataElementMetadata,
    ObservationLegend,
    StageMetadata,
    TrackerEventRecord,
} from './types'

const DE = 'deWeight'

const dataElement = (
    overrides: Partial<DataElementMetadata> = {}
): DataElementMetadata => ({
    id: DE,
    displayName: 'Weight (kg)',
    valueType: 'NUMBER',
    ...overrides,
})

const stage = (overrides: Partial<StageMetadata> = {}): StageMetadata => ({
    id: 'stageA',
    displayName: 'Antenatal visit',
    canReadData: true,
    dataElementIds: [DE],
    ...overrides,
})

const event = (
    id: string,
    occurredAt: string | undefined,
    value: string | undefined,
    overrides: Partial<TrackerEventRecord> = {}
): TrackerEventRecord => ({
    event: id,
    programStage: 'stageA',
    status: 'COMPLETED',
    occurredAt,
    dataValues: value === undefined ? [] : [{ dataElement: DE, value }],
    ...overrides,
})

const build = (
    events: TrackerEventRecord[],
    options: {
        dataElement?: Partial<DataElementMetadata>
        stages?: StageMetadata[]
    } = {}
) =>
    buildSeries({
        dataElement: dataElement(options.dataElement),
        stages: options.stages ?? [stage()],
        events,
    })

const values = (series: ReturnType<typeof build>) =>
    series.points.map((p) => p.value)
const ids = (series: ReturnType<typeof build>) =>
    series.points.map((p) => p.source.eventId)

describe('buildSeries', () => {
    it('orders points by occurredAt, then createdAt, then eventId', () => {
        const series = build([
            event('e5', '2026-03-12T00:00:00.000Z', '5', {
                createdAt: '2026-03-12T10:00:00.000Z',
            }),
            event('e4', '2026-03-12T00:00:00.000Z', '4', {
                createdAt: '2026-03-12T09:00:00.000Z',
            }),
            event('e3b', '2026-03-12T00:00:00.000Z', '3', {
                createdAt: '2026-03-12T08:00:00.000Z',
            }),
            event('e3a', '2026-03-12T00:00:00.000Z', '2', {
                createdAt: '2026-03-12T08:00:00.000Z',
            }),
            event('e1', '2026-03-10T00:00:00.000Z', '1'),
        ])

        expect(ids(series)).toEqual(['e1', 'e3a', 'e3b', 'e4', 'e5'])
    })

    it('reads the element from every stage that captures it', () => {
        const series = build(
            [
                event('e1', '2026-01-01T00:00:00.000Z', '60'),
                event('e2', '2026-02-01T00:00:00.000Z', '62', {
                    programStage: 'stageB',
                }),
            ],
            {
                stages: [
                    stage(),
                    stage({ id: 'stageB', displayName: 'Postnatal visit' }),
                ],
            }
        )

        expect(values(series)).toEqual(['60', '62'])
        expect(series.points.map((p) => p.source)).toEqual([
            {
                eventId: 'e1',
                programStageId: 'stageA',
                programStageName: 'Antenatal visit',
            },
            {
                eventId: 'e2',
                programStageId: 'stageB',
                programStageName: 'Postnatal visit',
            },
        ])
    })

    it('keeps only ACTIVE and COMPLETED events', () => {
        const series = build([
            event('active', '2026-01-01T00:00:00.000Z', '1', {
                status: 'ACTIVE',
            }),
            event('completed', '2026-01-02T00:00:00.000Z', '2'),
            event('schedule', '2026-01-03T00:00:00.000Z', '3', {
                status: 'SCHEDULE',
            }),
            event('skipped', '2026-01-04T00:00:00.000Z', '4', {
                status: 'SKIPPED',
            }),
            event('overdue', '2026-01-05T00:00:00.000Z', '5', {
                status: 'OVERDUE',
            }),
            event('undated', undefined, '6'),
        ])

        expect(ids(series)).toEqual(['active', 'completed'])
    })

    it('skips blank values for non-TRUE_ONLY types', () => {
        const series = build(
            [
                event('e1', '2026-01-01T00:00:00.000Z', 'Anaemia'),
                event('e2', '2026-01-02T00:00:00.000Z', ''),
                event('e3', '2026-01-03T00:00:00.000Z', '   '),
                event('e4', '2026-01-04T00:00:00.000Z', undefined),
            ],
            { dataElement: { valueType: 'TEXT' } }
        )

        expect(values(series)).toEqual(['Anaemia'])
    })

    describe('TRUE_ONLY', () => {
        const trueOnly = { dataElement: { valueType: 'TRUE_ONLY' } }

        it("a later capturing event without a tick is a 'false' point", () => {
            const series = build(
                [
                    event('v1', '2026-01-01T00:00:00.000Z', undefined),
                    event('v2', '2026-02-01T00:00:00.000Z', 'true'),
                    event('v3', '2026-03-01T00:00:00.000Z', undefined),
                    event('v4', '2026-04-01T00:00:00.000Z', undefined),
                ],
                trueOnly
            )

            expect(values(series)).toEqual(['false', 'true', 'false', 'false'])
            expect(series.latest?.value).toBe('false')
            expect(series.latest?.source.eventId).toBe('v4')
            expect(series.previous?.value).toBe('false')
        })

        it("never ticked reads 'false' at the latest capturing event", () => {
            const series = build(
                [
                    event('v1', '2026-01-01T00:00:00.000Z', undefined),
                    event('v2', '2026-02-01T00:00:00.000Z', undefined),
                ],
                trueOnly
            )

            expect(values(series)).toEqual(['false', 'false'])
            expect(series.latest?.value).toBe('false')
            expect(series.latest?.source.eventId).toBe('v2')
        })

        it("events from stages that don't capture the element add no points", () => {
            const series = build(
                [
                    event('v1', '2026-01-01T00:00:00.000Z', 'true'),
                    event('other', '2026-02-01T00:00:00.000Z', undefined, {
                        programStage: 'stageOther',
                    }),
                ],
                {
                    ...trueOnly,
                    stages: [
                        stage(),
                        stage({
                            id: 'stageOther',
                            displayName: 'Other',
                            dataElementIds: [],
                        }),
                    ],
                }
            )

            expect(ids(series)).toEqual(['v1'])
            expect(series.latest?.value).toBe('true')
        })

        it('ignores non-ACTIVE/COMPLETED and undated events when synthesising', () => {
            const series = build(
                [
                    event('v1', '2026-01-01T00:00:00.000Z', 'true'),
                    event('sched', '2026-02-01T00:00:00.000Z', undefined, {
                        status: 'SCHEDULE',
                    }),
                    event('undated', undefined, undefined),
                ],
                trueOnly
            )

            expect(ids(series)).toEqual(['v1'])
        })
    })

    it('parses decimals and leaves unparseable numeric values out', () => {
        const series = build([
            event('e1', '2026-01-01T00:00:00.000Z', '71.40'),
            event('e2', '2026-01-02T00:00:00.000Z', '6'),
            event('e3', '2026-01-03T00:00:00.000Z', 'abc'),
            event('e4', '2026-01-04T00:00:00.000Z', ''),
        ])

        expect(series.points.map((p) => p.numericValue)).toEqual([71.4, 6])
        expect(ids(series)).toEqual(['e1', 'e2'])
        expect(series.latest?.numericValue).toBe(6)
    })

    it('orders mixed date forms correctly', () => {
        const series = build([
            event('d4', '2026-03-15', '4'),
            event('d2', '2026-03-13T00:00:00.000', '2'),
            event('d3', '2026-03-14T00:00:00.000Z', '3'),
            event('d1', '2026-03-12', '1'),
            event('d5', '2026-03-16T01:00:00.000+01:00', '5'),
        ])

        expect(ids(series)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5'])
        expect(series.points[0]?.occurredAt).toBe('2026-03-12')
    })

    it('treats unzoned and date-only strings as UTC', () => {
        const series = build([
            event('zoned', '2026-03-12T00:00:00.000Z', '1'),
            event('unzoned', '2026-03-12T00:00:00.000', '2', {
                createdAt: '2026-03-12T00:00:00.000Z',
            }),
            event('dateOnly', '2026-03-12', '3', {
                createdAt: '2026-03-12T00:00:00.000Z',
            }),
        ])

        // Same instant, so order falls through to createdAt then eventId.
        expect(ids(series)).toEqual(['zoned', 'dateOnly', 'unzoned'])
    })

    it('sets latest, previous and change for numeric types', () => {
        const series = build([
            event('e2', '2026-02-01T00:00:00.000Z', '126'),
            event('e1', '2026-01-01T00:00:00.000Z', '120'),
        ])

        expect(series.latest?.numericValue).toBe(126)
        expect(series.previous?.numericValue).toBe(120)
        expect(series.change).toBe(6)
    })

    it('has no change for text types', () => {
        const series = build(
            [
                event('e1', '2026-01-01T00:00:00.000Z', 'Mild'),
                event('e2', '2026-02-01T00:00:00.000Z', 'Severe'),
            ],
            { dataElement: { valueType: 'TEXT' } }
        )

        expect(series.latest?.value).toBe('Severe')
        expect(series.previous?.value).toBe('Mild')
        expect(series.change).toBeUndefined()
    })

    it('has no change with a single point', () => {
        const series = build([event('e1', '2026-01-01T00:00:00.000Z', '120')])

        expect(series.latest?.numericValue).toBe(120)
        expect(series.previous).toBeUndefined()
        expect(series.change).toBeUndefined()
    })

    it('uses the first legend set, sorted by startValue', () => {
        const legend = (
            name: string,
            startValue: number,
            endValue: number
        ): ObservationLegend => ({ name, color: '#000', startValue, endValue })
        const series = build([], {
            dataElement: {
                legendSets: [
                    {
                        legends: [
                            legend('High', 100, 200),
                            legend('Low', 0, 50),
                            legend('Mid', 50, 100),
                        ],
                    },
                    { legends: [legend('Ignored', 0, 1000)] },
                ],
            },
        })

        expect(series.legends?.map((l) => l.name)).toEqual([
            'Low',
            'Mid',
            'High',
        ])
    })

    it('has no legends when the element has no legend set', () => {
        expect(build([]).legends).toBeUndefined()
    })

    it('maps option metadata to code, name and color', () => {
        const series = build([], {
            dataElement: {
                valueType: 'TEXT',
                optionSet: {
                    options: [
                        {
                            code: 'MILD',
                            name: 'Mild',
                            style: { color: '#0a0' },
                        },
                        { code: 'NONE', name: 'None' },
                    ],
                },
            },
        })

        expect(series.options).toStrictEqual([
            { code: 'MILD', name: 'Mild', color: '#0a0' },
            { code: 'NONE', name: 'None' },
        ])
    })

    it('is partial when a capturing stage is not data-readable', () => {
        const series = build([], {
            stages: [stage(), stage({ id: 'stageB', canReadData: false })],
        })

        expect(series.partial).toBe(true)
    })

    it('is not partial when only a non-capturing stage is unreadable', () => {
        const series = build([], {
            stages: [
                stage(),
                stage({
                    id: 'stageB',
                    canReadData: false,
                    dataElementIds: ['other'],
                }),
            ],
        })

        expect(series.partial).toBe(false)
    })

    it('label prefers displayFormName', () => {
        const series = build([], {
            dataElement: { displayFormName: 'Weight' },
        })

        expect(series.label).toBe('Weight')
    })

    it('label falls back to displayName', () => {
        expect(build([]).label).toBe('Weight (kg)')
    })

    it('no events gives an empty series with no latest', () => {
        const series = build([])

        expect(series).toMatchObject({
            dataElementId: DE,
            valueType: 'NUMBER',
            points: [],
            partial: false,
        })
        expect(series.latest).toBeUndefined()
        expect(series.previous).toBeUndefined()
        expect(series.change).toBeUndefined()
    })
})
