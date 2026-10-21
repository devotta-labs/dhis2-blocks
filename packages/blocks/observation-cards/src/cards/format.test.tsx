// Runs in the browser project: format.ts takes toInstant from the hook entry,
// which loads the app-runtime, and that reads localStorage on import.
import {
    displayValue,
    formatNumber,
    isStale,
    isSupportedLatestType,
    isTrendType,
    legendFor,
    normaliseColor,
    optionFor,
    readableTextColor,
    relativeTime,
} from './format'
import type {
    ObservationLegend,
    ObservationPoint,
    ObservationSeries,
} from '../use-tracked-entity-observations'

const legends: ObservationLegend[] = [
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

describe('legendFor', () => {
    it('endValue belongs to the next legend', () => {
        expect(legendFor(legends, 6.9)?.name).toBe('Low')
        expect(legendFor(legends, 7)?.name).toBe('High')
        expect(legendFor(legends, 0)?.name).toBe('Low')
    })

    it('a gap or out-of-range value has no legend', () => {
        const gapped: ObservationLegend[] = [
            { name: 'A', color: '#111111', startValue: 0, endValue: 5 },
            { name: 'B', color: '#222222', startValue: 8, endValue: 10 },
        ]
        expect(legendFor(gapped, 6)).toBeUndefined()
        expect(legendFor(legends, 11)).toBeUndefined()
        expect(legendFor(legends, -1)).toBeUndefined()
        expect(legendFor(undefined, 5)).toBeUndefined()
    })
})

describe('optionFor', () => {
    it('finds a known option', () => {
        const options = [{ code: 'A', name: 'Alpha', color: '#abcdef' }]
        expect(optionFor(options, 'A')).toEqual(options[0])
    })

    it('unknown code shows the raw code with no colour', () => {
        const options = [{ code: 'A', name: 'Alpha', color: '#abcdef' }]
        expect(optionFor(options, 'Z')).toEqual({ code: 'Z', name: 'Z' })
        expect(optionFor(undefined, 'Z')).toEqual({ code: 'Z', name: 'Z' })
    })
})

describe('displayValue', () => {
    it("TRUE_ONLY 'false' reads No", () => {
        expect(displayValue(series('TRUE_ONLY'), point('false'))).toBe('No')
        expect(displayValue(series('TRUE_ONLY'), point('true'))).toBe('Yes')
    })

    it('BOOLEAN reads Yes or No', () => {
        expect(displayValue(series('BOOLEAN'), point('true'))).toBe('Yes')
        expect(displayValue(series('BOOLEAN'), point('false'))).toBe('No')
    })

    it('an option set shows the option name, or the raw code when unknown', () => {
        const withOptions = series('TEXT', {
            options: [{ code: 'M', name: 'Male' }],
        })
        expect(displayValue(withOptions, point('M'))).toBe('Male')
        expect(displayValue(withOptions, point('X'))).toBe('X')
    })

    it('numbers are rounded for display', () => {
        expect(
            displayValue(
                series('NUMBER'),
                point('1.4000000000000057', {
                    numericValue: 1.4000000000000057,
                })
            )
        ).toBe('1.4')
    })

    it('a non-numeric value in a numeric series is shown raw', () => {
        expect(displayValue(series('NUMBER'), point('abc'))).toBe('abc')
    })

    it('DATE uses the supplied formatter, else the date part', () => {
        const p = point('2026-03-12T00:00:00.000')
        expect(displayValue(series('DATE'), p)).toBe('2026-03-12')
        expect(displayValue(series('DATE'), p, () => '12/03/2026')).toBe(
            '12/03/2026'
        )
    })

    it('text is shown as received', () => {
        expect(displayValue(series('LONG_TEXT'), point('Some note'))).toBe(
            'Some note'
        )
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
    it('isTrendType: rejects TEXT', () => {
        expect(isTrendType('TEXT')).toBe(false)
        expect(isTrendType('NUMBER')).toBe(true)
        expect(isTrendType('PERCENTAGE')).toBe(true)
        expect(isTrendType('INTEGER_ZERO_OR_POSITIVE')).toBe(true)
    })

    it('isSupportedLatestType accepts trend, text, boolean and date types', () => {
        for (const type of [
            'NUMBER',
            'BOOLEAN',
            'TRUE_ONLY',
            'TEXT',
            'LONG_TEXT',
            'DATE',
        ]) {
            expect(isSupportedLatestType(type, false)).toBe(true)
        }
    })

    it('isSupportedLatestType accepts any value type with an option set', () => {
        expect(isSupportedLatestType('FILE_RESOURCE', false)).toBe(false)
        expect(isSupportedLatestType('FILE_RESOURCE', true)).toBe(true)
    })

    it('isSupportedLatestType rejects unsupported types', () => {
        expect(isSupportedLatestType('COORDINATE', false)).toBe(false)
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

describe('formatNumber', () => {
    it('rounds float noise to at most 2 decimals and drops trailing zeros', () => {
        expect(formatNumber(1.4000000000000057)).toBe('1.4')
        expect(formatNumber(71.456)).toBe('71.46')
        expect(formatNumber(70)).toBe('70')
        expect(formatNumber(-0.5)).toBe('-0.5')
    })

    it('never shows negative zero', () => {
        expect(formatNumber(-0.001)).toBe('0')
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

    it('counts years from a year on', () => {
        expect(relativeTime(at('2023-02-01T12:00:00.000'), now, 'en')).toBe(
            '3 years ago'
        )
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
