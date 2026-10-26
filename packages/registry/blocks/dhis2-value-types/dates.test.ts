import { parseDateFormat } from './dates'
import { parseTyped, typedText } from './valueTypes'

test('DD-MM-YYYY is typed and shown day first', () => {
    const s = { calendar: 'iso8601', dateFormat: 'DD-MM-YYYY' } as const
    expect(parseTyped({ valueType: 'DATE' }, '20-10-2026', s)).toEqual({
        ok: true,
        value: '2026-10-20',
    })
    expect(typedText({ valueType: 'DATE' }, '2026-10-20', s)).toBe('20-10-2026')
})

test('an Ethiopian date round-trips through its own calendar', () => {
    const s = { calendar: 'ethiopian', dateFormat: 'YYYY-MM-DD' } as const
    const shown = typedText({ valueType: 'DATE' }, '2026-10-20', s)
    expect(shown).not.toBe('2026-10-20')
    expect(parseTyped({ valueType: 'DATE' }, shown, s)).toEqual({
        ok: true,
        value: '2026-10-20',
    })
})

test('an Ethiopian date is the same day as its Gregorian one', () => {
    const s = { calendar: 'ethiopian', dateFormat: 'YYYY-MM-DD' } as const
    expect(typedText({ valueType: 'DATE' }, '2026-10-14', s)).toBe('2019-02-04')
    expect(parseTyped({ valueType: 'DATE' }, '2019-02-04', s)).toEqual({
        ok: true,
        value: '2026-10-14',
    })
})

test.each([
    'coptic',
    'ethiopian',
    'islamic',
    'nepali',
    'persian',
    'thai',
] as const)(
    '%s dates round-trip, and a day the calendar lacks is refused',
    (calendar) => {
        const s = { calendar, dateFormat: 'YYYY-MM-DD' } as const
        const field = { valueType: 'DATE' }
        for (const day of ['2026-10-20', '2024-02-29', '2027-01-01']) {
            expect(parseTyped(field, typedText(field, day, s), s)).toEqual({
                ok: true,
                value: day,
            })
        }
        const [year, month] = typedText(field, '2026-10-20', s).split('-')
        expect(parseTyped(field, `${year}-${month}-99`, s)).toMatchObject({
            ok: false,
            problem: { message: 'Enter a valid date' },
        })
    }
)

test('the epagomenal days of the Ethiopian year are real only when the year has them', () => {
    const s = { calendar: 'ethiopian', dateFormat: 'YYYY-MM-DD' } as const
    const field = { valueType: 'DATE' }
    // 2015 is a leap year (Pagume has 6 days), 2016 is not (5).
    expect(parseTyped(field, '2015-13-06', s)).toMatchObject({ ok: true })
    expect(parseTyped(field, '2016-13-06', s)).toMatchObject({ ok: false })
    expect(parseTyped(field, '2016-13-05', s)).toMatchObject({ ok: true })
    expect(parseTyped(field, '2016-14-01', s)).toMatchObject({ ok: false })
})

test.each([
    ['2026-1-5'],
    ['20-10-2026'],
    ['2026/10/20'],
    ['2026-10-20T00:00'],
    ['today'],
])('%s is not a date in YYYY-MM-DD', (text) =>
    expect(
        parseTyped({ valueType: 'DATE' }, text, {
            calendar: 'iso8601',
            dateFormat: 'YYYY-MM-DD',
        })
    ).toMatchObject({ ok: false })
)

test('a stored value that is not a date is shown as stored', () =>
    expect(
        typedText({ valueType: 'DATE' }, 'garbage', {
            calendar: 'ethiopian',
            dateFormat: 'DD-MM-YYYY',
        })
    ).toBe('garbage'))

test.each([
    ['dd-mm-yyyy', 'DD-MM-YYYY'],
    ['dd-MM-yyyy', 'DD-MM-YYYY'],
    ['yyyy-MM-dd', 'YYYY-MM-DD'],
    ['something else', 'YYYY-MM-DD'],
])('the system info date format %s is read as %s', (given, read) =>
    expect(parseDateFormat(given)).toBe(read)
)
