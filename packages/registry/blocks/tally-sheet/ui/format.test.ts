import { describe, expect, it } from 'vitest'
import { countDraft, formatCount } from './format'

describe('countDraft', () => {
    it.each([
        ['42', '42'],
        ['a1-2 b', '12'],
        ['٤٢', '42'],
        ['۱۲۳', '123'],
        ['१०', '10'],
        ['𝟗𝟖', '98'],
        ['1234567', '123456'],
        ['', ''],
        ['-3.5', '35'],
    ])('keeps %j as %j', (typed, kept) => {
        expect(countDraft(typed)).toBe(kept)
    })
})

describe('formatCount', () => {
    it('groups a count in the language of the page', () => {
        expect(formatCount(1234)).toBe('1,234')
    })
})
