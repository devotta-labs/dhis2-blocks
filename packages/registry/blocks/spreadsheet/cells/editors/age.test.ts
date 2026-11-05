import { ageFromBirth, birthFromAge } from './age'

const TODAY = '2026-10-27'

test('ageFromBirth counts whole years, months and days', () => {
    expect(ageFromBirth('2020-02-29', TODAY)).toEqual({
        years: 6,
        months: 7,
        days: 28,
    })
    // A birthday that has not come yet this year.
    expect(ageFromBirth('2020-12-25', TODAY)).toEqual({
        years: 5,
        months: 10,
        days: 2,
    })
    expect(ageFromBirth(TODAY, TODAY)).toEqual({
        years: 0,
        months: 0,
        days: 0,
    })
})

test('a birth day a shorter month lacks counts to that month’s last day', () => {
    // 31 January plus one month is the last day of February.
    expect(ageFromBirth('2020-01-31', '2020-03-01')).toEqual({
        years: 0,
        months: 1,
        days: 1,
    })
    expect(ageFromBirth('2020-01-31', '2020-02-29')).toEqual({
        years: 0,
        months: 1,
        days: 0,
    })
    expect(ageFromBirth('2020-01-31', '2020-02-28')).toEqual({
        years: 0,
        months: 0,
        days: 28,
    })
})

test('birthFromAge goes back from today', () => {
    expect(birthFromAge({ years: 6, months: 7, days: 28 }, TODAY)).toBe(
        '2020-02-29'
    )
    expect(birthFromAge({ years: 0, months: 0, days: 0 }, TODAY)).toBe(TODAY)
    expect(birthFromAge({ years: 0, months: 0, days: 400 }, TODAY)).toBe(
        '2025-09-22'
    )
})

test('an age no date of birth is on today has none', () => {
    // Born 28 February, one is one month and three days old on 31 March; born 1 March, 30 days.
    for (const days of [0, 1, 2]) {
        expect(
            birthFromAge({ years: 0, months: 1, days }, '2026-03-31')
        ).toBeUndefined()
    }
    expect(birthFromAge({ years: 0, months: 1, days: 3 }, '2026-03-31')).toBe(
        '2026-02-28'
    )
    // No one is born on 29 February 2023.
    expect(
        birthFromAge({ years: 1, months: 0, days: 0 }, '2024-02-29')
    ).toBeUndefined()
    expect(birthFromAge({ years: 4, months: 0, days: 0 }, '2024-02-29')).toBe(
        '2020-02-29'
    )
    expect(birthFromAge({ years: 1, months: 0, days: 0 }, '2025-02-28')).toBe(
        '2024-02-28'
    )
    // Born 28, 29, 30 or 31 January, one is one month old on 28 February.
    expect(birthFromAge({ years: 0, months: 1, days: 0 }, '2026-02-28')).toBe(
        '2026-01-28'
    )
})

test('an age and its date of birth give each other back', () => {
    for (const birth of ['2020-02-29', '2026-01-01', '2000-06-15']) {
        expect(birthFromAge(ageFromBirth(birth, TODAY), TODAY)).toBe(birth)
    }
})
