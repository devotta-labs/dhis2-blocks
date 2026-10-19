import { generateUid } from './uid'

describe('generateUid', () => {
    it('makes 1000 unique DHIS2 uids', () => {
        const ids = Array.from({ length: 1000 }, generateUid)
        for (const id of ids) {
            expect(id).toMatch(/^[A-Za-z][A-Za-z0-9]{10}$/)
        }
        expect(new Set(ids).size).toBe(1000)
    })
})
