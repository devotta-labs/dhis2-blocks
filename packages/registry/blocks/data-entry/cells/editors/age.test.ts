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
    // A month that does not reach back as far as the day ends on its last day.
    expect(birthFromAge({ years: 0, months: 1, days: 0 }, '2026-03-31')).toBe(
        '2026-02-28'
    )
    expect(birthFromAge({ years: 1, months: 0, days: 0 }, '2024-02-29')).toBe(
        '2023-02-28'
    )
})

test('an age and its date of birth give each other back', () => {
    for (const birth of ['2020-02-29', '2026-01-01', '2000-06-15']) {
        expect(birthFromAge(ageFromBirth(birth, TODAY), TODAY)).toBe(birth)
    }
})
