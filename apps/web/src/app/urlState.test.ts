import { parseAppUrlState, serializeAppUrlState } from './urlState'

describe('URL state privacy boundary', () => {
    it('serializes only context and pagination preferences', () => {
        expect(
            serializeAppUrlState({
                programId: 'IpHINAT79UW',
                orgUnitId: 'DiszpKrYNg8',
                page: 2,
                pageSize: 25,
            })
        ).toBe('programId=IpHINAT79UW&orgUnitId=DiszpKrYNg8&page=2&pageSize=25')
    })

    it('omits an absent organisation unit', () => {
        expect(
            serializeAppUrlState({
                programId: 'IpHINAT79UW',
                page: 1,
                pageSize: 15,
            })
        ).toBe('programId=IpHINAT79UW&page=1&pageSize=15')
    })

    it('ignores filter values and unknown keys from a tampered URL', () => {
        const parsed = parseAppUrlState(
            new URLSearchParams(
                'programId=IpHINAT79UW&filter=firstName%3ATest&token=secret'
            )
        )

        expect(parsed).toEqual({ programId: 'IpHINAT79UW' })
        expect(JSON.stringify(parsed)).not.toContain('Test')
        expect(JSON.stringify(parsed)).not.toContain('secret')
    })

    it('ignores a saved-list key left in an old URL', () => {
        expect(
            parseAppUrlState(
                new URLSearchParams(
                    'programId=IpHINAT79UW&selectedTemplateId=x&page=2'
                )
            )
        ).toEqual({ programId: 'IpHINAT79UW', page: 2 })
    })

    it('accepts only the patient list page sizes', () => {
        expect(
            parseAppUrlState(new URLSearchParams('pageSize=100')).pageSize
        ).toBe(100)
        expect(() =>
            parseAppUrlState(new URLSearchParams('pageSize=20'))
        ).toThrow()
    })

    it('fails fast when a known URL preference is malformed', () => {
        expect(() =>
            parseAppUrlState(
                new URLSearchParams('programId=IpHINAT79UW&page=-1')
            )
        ).toThrow()
    })

    it('fails fast for duplicate or blank known URL parameters', () => {
        expect(() =>
            parseAppUrlState(new URLSearchParams('programId=one&programId=two'))
        ).toThrow()
        expect(() =>
            parseAppUrlState(new URLSearchParams('orgUnitId='))
        ).toThrow()
    })
})
