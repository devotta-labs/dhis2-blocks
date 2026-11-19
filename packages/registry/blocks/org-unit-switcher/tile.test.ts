import { TILE_CLASSES, tileClass, tileInitial } from './tile'

describe('tile', () => {
    it('takes the first letter, upper-cased', () => {
        expect(tileInitial('ocean beach')).toBe('O')
    })

    it('takes a whole code point', () => {
        expect(tileInitial('𝒜rea clinic')).toBe('𝒜')
    })

    it('shows a question mark for an empty name', () => {
        expect(tileInitial('')).toBe('?')
    })

    it('picks the same class for the same id, from the list', () => {
        const first = tileClass('DiszpKrYNg8')
        expect(tileClass('DiszpKrYNg8')).toBe(first)
        expect(TILE_CLASSES).toContain(first)
    })
})
