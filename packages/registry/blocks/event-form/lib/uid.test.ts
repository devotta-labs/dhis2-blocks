import { generateUid } from './uid'

describe('generateUid', () => {
    it('makes a DHIS2 id: a letter, then ten letters or digits', () => {
        for (let draw = 0; draw < 100; draw += 1) {
            expect(generateUid()).toMatch(/^[A-Za-z][A-Za-z0-9]{10}$/)
        }
    })

    it('makes a new one each time', () => {
        expect(generateUid()).not.toBe(generateUid())
    })
})
