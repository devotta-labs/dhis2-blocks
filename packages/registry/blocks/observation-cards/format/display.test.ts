import type {
    ObservationLegendBand,
    ObservationPoint,
    ObservationSeries,
} from '../api/types'
import {
    categoryChangeLine,
    changeLine,
    elementShowsTrend,
    formatPointValue,
    isStale,
    isSupportedValueType,
    legendFor,
    normaliseColor,
    readableTextColor,
    relativeTime,
    showsTrend,
} from './display'

const legends: ObservationLegendBand[] = [
    { name: 'Low', color: '#ff0000', startValue: 0, endValue: 7 },
    { name: 'High', color: '#00ff00', startValue: 7, endValue: 11 },
]

const point = (
    value: string,
    overrides: Partial<ObservationPoint> = {}
): ObservationPoint => ({
    value,
    occurredAt: '2026-03-12T00:00:00.000',
    source: { eventId: 'ev1', programStageId: 's1', programStageName: 'Visit' },
    ...overrides,
})

const series = (
    valueType: string,
    overrides: Partial<ObservationSeries> = {}
): ObservationSeries => ({
    dataElementId: 'de1',
    label: 'Element',
    valueType,
    points: [],
    partial: false,
    ...overrides,
})

const decimals = (value: number) => String(value).split('.')[1]?.length ?? 0

const reading = (value: number, occurredAt: string) =>
    point(String(value), { numericValue: value, occurredAt })

/** A numeric series whose previous reading is on 1 March; its change is at the readings' precision, as buildSeries gives it. */
const trend = (
    from: number,
    to: number,
    overrides: Partial<ObservationSeries> = {}
): ObservationSeries => {
    const previous = reading(from, '2026-03-01T00:00:00.000')
    const latest = reading(to, '2026-03-05T00:00:00.000')
    return series('NUMBER', {
        points: [previous, latest],
        previous,
        latest,
        change: Number(
            (to - from).toFixed(Math.max(decimals(from), decimals(to)))
        ),
        ...overrides,
    })
}

const GREGORIAN = { calendar: 'gregorian', locale: 'en' } as const

describe('legendFor', () => {
    it('endValue belongs to the next legend', () => {
        expect(legendFor(legends, 6.9)?.name).toBe('Low')
        expect(legendFor(legends, 7)?.name).toBe('High')
        expect(legendFor(legends, 0)?.name).toBe('Low')
    })

    it('a gap or out-of-range value has no legend', () => {
        const gapped: ObservationLegendBand[] = [
            { name: 'A', color: '#111111', startValue: 0, endValue: 5 },
            { name: 'B', color: '#222222', startValue: 8, endValue: 10 },
        ]
        expect(legendFor(gapped, 6)).toBeUndefined()
        expect(legendFor(legends, 11.1)).toBeUndefined()
        expect(legendFor(legends, -1)).toBeUndefined()
        expect(legendFor(undefined, 5)).toBeUndefined()
    })

    it("the highest legend's endValue belongs to it", () => {
        expect(legendFor(legends, 11)?.name).toBe('High')
    })

    it('finds the highest legend whatever the order', () => {
        expect(legendFor([...legends].reverse(), 11)?.name).toBe('High')
    })

    it("an inner legend's endValue still belongs to the next one", () => {
        const gapped: ObservationLegendBand[] = [
            { name: 'A', color: '#111111', startValue: 0, endValue: 5 },
            { name: 'B', color: '#222222', startValue: 8, endValue: 10 },
        ]
        expect(legendFor(gapped, 5)).toBeUndefined()
        expect(legendFor(gapped, 10)?.name).toBe('B')
    })
})

describe('formatPointValue', () => {
    it('an unticked TRUE_ONLY box reads Not recorded, never No', () => {
        expect(
            formatPointValue(series('TRUE_ONLY'), point('false'), GREGORIAN)
        ).toBe('Not recorded')
        expect(
            formatPointValue(series('TRUE_ONLY'), point('true'), GREGORIAN)
        ).toBe('Yes')
    })

    it('BOOLEAN reads Yes or No', () => {
        expect(
            formatPointValue(series('BOOLEAN'), point('true'), GREGORIAN)
        ).toBe('Yes')
        expect(
            formatPointValue(series('BOOLEAN'), point('false'), GREGORIAN)
        ).toBe('No')
    })

    it('an option set shows the option name, or the raw code when unknown', () => {
        const withOptions = series('TEXT', {
            options: [{ code: 'M', name: 'Male' }],
        })
        expect(formatPointValue(withOptions, point('M'), GREGORIAN)).toBe(
            'Male'
        )
        expect(formatPointValue(withOptions, point('X'), GREGORIAN)).toBe('X')
    })

    it('a number shows as it was recorded', () => {
        expect(
            formatPointValue(
                series('NUMBER'),
                point('71.456', { numericValue: 71.456 }),
                GREGORIAN
            )
        ).toBe('71.456')
    })

    it('DATE shows in the system calendar', () => {
        const p = point('2026-03-03')
        expect(formatPointValue(series('DATE'), p, GREGORIAN)).toBe(
            'Mar 3, 2026'
        )
        expect(
            formatPointValue(series('DATE'), p, { calendar: 'ethiopian' })
        ).toBe('2018-06-24')
    })

    it('text is shown as received', () => {
        expect(
            formatPointValue(series('LONG_TEXT'), point('Some note'), GREGORIAN)
        ).toBe('Some note')
    })
})

describe('changeLine', () => {
    it('is nothing without an earlier reading', () => {
        const latest = reading(10, '2026-03-05T00:00:00.000')
        expect(
            changeLine(
                series('NUMBER', { points: [latest], latest }),
                undefined,
                GREGORIAN
            )
        ).toBeUndefined()
    })

    it('a rise names the size, unit and the earlier date', () => {
        expect(changeLine(trend(10, 16), 'g/dL', GREGORIAN)).toEqual({
            direction: 'up',
            text: '6 g/dL since Mar 1, 2026',
        })
    })

    it('a fall shows the absolute value', () => {
        expect(changeLine(trend(12.5, 10), undefined, GREGORIAN)).toEqual({
            direction: 'down',
            text: '2.5 since Mar 1, 2026',
        })
    })

    it("shows the change at the readings' precision", () => {
        expect(changeLine(trend(10, 11.4), undefined, GREGORIAN)?.text).toBe(
            '1.4 since Mar 1, 2026'
        )
        expect(changeLine(trend(70, 71.456), undefined, GREGORIAN)?.text).toBe(
            '1.456 since Mar 1, 2026'
        )
    })

    it('a small change is never read as no change', () => {
        expect(changeLine(trend(0.501, 0.504), undefined, GREGORIAN)).toEqual({
            direction: 'up',
            text: '0.003 since Mar 1, 2026',
        })
    })

    it('only an exact zero says no change, with no direction', () => {
        expect(changeLine(trend(10, 10), 'kg', GREGORIAN)).toEqual({
            text: 'No change since Mar 1, 2026',
        })
    })

    it('a PERCENTAGE change reads like its values, with the %', () => {
        expect(
            changeLine(
                trend(40, 42.5, { valueType: 'PERCENTAGE' }),
                undefined,
                GREGORIAN
            )?.text
        ).toBe('2.5% since Mar 1, 2026')
    })

    it('names a legend move', () => {
        const bands: ObservationLegendBand[] = [
            { name: 'Low', color: '#ff0000', startValue: 0, endValue: 11 },
            { name: 'Normal', color: '#00ff00', startValue: 11, endValue: 16 },
        ]
        expect(
            changeLine(trend(10.8, 12, { legends: bands }), 'g/dL', GREGORIAN)
        ).toEqual({
            direction: 'up',
            text: '1.2 g/dL since Mar 1, 2026, now Normal (was Low)',
        })
        expect(
            changeLine(trend(12, 13, { legends: bands }), 'g/dL', GREGORIAN)
                ?.text
        ).toBe('1 g/dL since Mar 1, 2026')
    })

    it('writes the earlier date in the system calendar', () => {
        expect(
            changeLine(trend(10, 12), undefined, { calendar: 'ethiopian' })
                ?.text
        ).toBe('2 since 2018-06-22')
    })
})

describe('isStale', () => {
    const now = new Date('2026-09-10T00:00:00.000Z')

    it('undefined threshold is never stale', () => {
        expect(
            isStale(point('1', { occurredAt: '2000-01-01' }), undefined, now)
        ).toBe(false)
    })

    it('181 days old with threshold 180 is stale', () => {
        // 2026-03-13 to 2026-09-10 is 181 days.
        expect(
            isStale(
                point('1', { occurredAt: '2026-03-13T00:00:00.000' }),
                180,
                now
            )
        ).toBe(true)
    })

    it('exactly the threshold is not stale', () => {
        expect(
            isStale(
                point('1', { occurredAt: '2026-03-14T00:00:00.000' }),
                180,
                now
            )
        ).toBe(false)
    })

    it('an unparseable date is not stale', () => {
        expect(isStale(point('1', { occurredAt: 'nope' }), 180, now)).toBe(
            false
        )
    })
})

describe('value type support', () => {
    it('showsTrend: numeric types without an option set', () => {
        expect(showsTrend(series('TEXT'))).toBe(false)
        expect(showsTrend(series('NUMBER'))).toBe(true)
        expect(showsTrend(series('PERCENTAGE'))).toBe(true)
        expect(showsTrend(series('INTEGER_ZERO_OR_POSITIVE'))).toBe(true)
        expect(showsTrend(series('UNIT_INTERVAL'))).toBe(true)
        expect(
            showsTrend(
                series('INTEGER', { options: [{ code: '1', name: 'One' }] })
            )
        ).toBe(false)
    })

    it('elementShowsTrend follows the same rule from metadata', () => {
        const element = { id: 'de1', displayName: 'Element' }
        expect(elementShowsTrend({ ...element, valueType: 'NUMBER' })).toBe(
            true
        )
        expect(elementShowsTrend({ ...element, valueType: 'TEXT' })).toBe(false)
        expect(
            elementShowsTrend({
                ...element,
                valueType: 'INTEGER',
                optionSet: { options: [{ code: '1', name: 'One' }] },
            })
        ).toBe(false)
    })

    it('isSupportedValueType accepts numeric, text, boolean and date types', () => {
        for (const type of [
            'NUMBER',
            'BOOLEAN',
            'TRUE_ONLY',
            'TEXT',
            'LONG_TEXT',
            'DATE',
        ]) {
            expect(isSupportedValueType(series(type))).toBe(true)
        }
    })

    it('isSupportedValueType accepts any value type with an option set', () => {
        expect(isSupportedValueType(series('FILE_RESOURCE'))).toBe(false)
        expect(
            isSupportedValueType(
                series('FILE_RESOURCE', { options: [{ code: 'A', name: 'A' }] })
            )
        ).toBe(true)
    })

    it('isSupportedValueType rejects unsupported types', () => {
        expect(isSupportedValueType(series('COORDINATE'))).toBe(false)
    })
})

describe('normaliseColor', () => {
    it('prefixes bare hex values', () => {
        expect(normaliseColor('ffef78')).toBe('#ffef78')
        expect(normaliseColor('fe0')).toBe('#fe0')
        expect(normaliseColor('ffef78cc')).toBe('#ffef78cc')
    })

    it('leaves prefixed hex and other CSS colours alone', () => {
        expect(normaliseColor('#ffef78')).toBe('#ffef78')
        expect(normaliseColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)')
        expect(normaliseColor('tomato')).toBe('tomato')
    })

    it('gives undefined for empty input', () => {
        expect(normaliseColor(undefined)).toBeUndefined()
        expect(normaliseColor('')).toBeUndefined()
        expect(normaliseColor('   ')).toBeUndefined()
    })
})

describe('readableTextColor', () => {
    it('picks dark text on light colours and light text on dark colours', () => {
        expect(readableTextColor('#ffef78')).toBe('#000000')
        expect(readableTextColor('ffffff')).toBe('#000000')
        expect(readableTextColor('#003366')).toBe('#ffffff')
        expect(readableTextColor('#000')).toBe('#ffffff')
    })

    it('has no opinion on colours it cannot read', () => {
        expect(readableTextColor('tomato')).toBeUndefined()
    })
})

describe('relativeTime', () => {
    const now = new Date('2026-03-12T12:00:00.000Z')
    const at = (occurredAt: string) => point('1', { occurredAt })

    it('says today for a reading earlier the same day', () => {
        expect(relativeTime(at('2026-03-12T08:00:00.000'), now, 'en')).toBe(
            'today'
        )
    })

    it('counts days under a month', () => {
        expect(relativeTime(at('2026-03-09T12:00:00.000'), now, 'en')).toBe(
            '3 days ago'
        )
        expect(relativeTime(at('2026-03-11T12:00:00.000'), now, 'en')).toBe(
            '1 day ago'
        )
    })

    it('counts months under a year', () => {
        expect(relativeTime(at('2025-10-10T12:00:00.000'), now, 'en')).toBe(
            '5 months ago'
        )
    })

    it('rounds to the nearest month or year, so an old reading never looks newer', () => {
        // 59 days and 729 days before 12 March 2026.
        expect(relativeTime(at('2026-01-12T12:00:00.000'), now, 'en')).toBe(
            '2 months ago'
        )
        expect(relativeTime(at('2024-03-13T12:00:00.000'), now, 'en')).toBe(
            '2 years ago'
        )
    })

    it('counts years from a year on', () => {
        expect(relativeTime(at('2023-02-01T12:00:00.000'), now, 'en')).toBe(
            '3 years ago'
        )
    })

    it("counts calendar days, so last night's reading is a day ago", () => {
        const morning = new Date(2026, 2, 12, 9, 0)
        expect(relativeTime(at('2026-03-11T18:00:00.000'), morning, 'en')).toBe(
            '1 day ago'
        )
        expect(relativeTime(at('2026-03-12T00:30:00.000'), morning, 'en')).toBe(
            'today'
        )
    })

    it('counts a date-only reading by its date', () => {
        const evening = new Date(2026, 2, 12, 23, 30)
        expect(relativeTime(at('2026-03-10'), evening, 'en')).toBe('2 days ago')
    })

    it('reads a future date forwards', () => {
        expect(relativeTime(at('2026-03-14T12:00:00.000'), now, 'en')).toBe(
            'in 2 days'
        )
    })

    it('follows the locale', () => {
        expect(relativeTime(at('2026-03-09T12:00:00.000'), now, 'fr')).toBe(
            'il y a 3 jours'
        )
    })
})

describe('categoryChangeLine', () => {
    const at = (value: string, day: string) =>
        point(value, { occurredAt: `2026-03-${day}T00:00:00.000` })
    const yesNo = (...points: ObservationPoint[]) =>
        series('BOOLEAN', { points, latest: points.at(-1) })

    it('names the earlier value and the day the latest one was first recorded', () => {
        expect(
            categoryChangeLine(
                yesNo(at('false', '01'), at('true', '03'), at('true', '05')),
                GREGORIAN
            )
        ).toEqual({ text: 'Changed from No on Mar 3, 2026' })
    })

    it('says since when the value has held, when it never changed', () => {
        expect(
            categoryChangeLine(
                yesNo(at('true', '01'), at('true', '05')),
                GREGORIAN
            )?.text
        ).toBe('No change since Mar 1, 2026')
    })

    it('uses option names', () => {
        const points = [at('S', '01'), at('N', '04')]
        expect(
            categoryChangeLine(
                series('TEXT', {
                    points,
                    latest: points.at(-1),
                    options: [
                        { code: 'S', name: 'Smoker' },
                        { code: 'N', name: 'Non-smoker' },
                    ],
                }),
                GREGORIAN
            )?.text
        ).toBe('Changed from Smoker on Mar 4, 2026')
    })

    it('says when a TRUE_ONLY box was last recorded Yes, never what it changed from', () => {
        const ticks = (...points: ObservationPoint[]) =>
            series('TRUE_ONLY', { points, latest: points.at(-1) })
        expect(
            categoryChangeLine(
                ticks(at('true', '01'), at('true', '03'), at('false', '05')),
                GREGORIAN
            )?.text
        ).toBe('Last recorded Yes on Mar 3, 2026')
        expect(
            categoryChangeLine(
                ticks(at('false', '01'), at('true', '03'), at('true', '05')),
                GREGORIAN
            )?.text
        ).toBe('Yes since Mar 3, 2026')
        expect(
            categoryChangeLine(
                ticks(at('false', '01'), at('false', '05')),
                GREGORIAN
            )
        ).toBe(undefined)
    })

    it('says nothing for one reading or for free text', () => {
        expect(categoryChangeLine(yesNo(at('true', '01')), GREGORIAN)).toBe(
            undefined
        )
        const points = [at('First', '01'), at('Second', '02')]
        expect(
            categoryChangeLine(
                series('TEXT', { points, latest: points.at(-1) }),
                GREGORIAN
            )
        ).toBe(undefined)
    })
})
