import { isWithinAssigned } from './scope'

const assigned = (path: string) => ({ id: 'x', displayName: 'X', path })

describe('isWithinAssigned', () => {
    it('accepts a descendant', () => {
        expect(isWithinAssigned('/A/B', [assigned('/A')])).toBe(true)
    })

    it('accepts the assigned unit itself', () => {
        expect(isWithinAssigned('/A/B', [assigned('/A/B')])).toBe(true)
    })

    it('rejects a sibling that shares a prefix', () => {
        expect(isWithinAssigned('/AB/C', [assigned('/A')])).toBe(false)
    })

    it('rejects everything when nothing is assigned', () => {
        expect(isWithinAssigned('/A', [])).toBe(false)
    })
})
