import { describe, expect, it } from 'vitest'
import { answer, type LabRequest } from '../labServer'

// The block parses these shapes with its own schemas, which are not exported or need a browser to import.
const search = (resource: string, query: string) =>
    answer(new Map())({ resource, params: { query } }, 'read')

describe('the value input lab server', () => {
    it('finds org units by name, with their path from the top, as DHIS2 sends them', () => {
        expect(search('organisationUnits', 'ngelehun')).toEqual({
            pager: { page: 1, pageCount: 1, total: 1 },
            organisationUnits: [
                {
                    id: 'DiszpKrYNg8',
                    displayName: 'Ngelehun CHC',
                    ancestors: [
                        { displayName: 'Sierra Leone' },
                        { displayName: 'Bo' },
                        { displayName: 'Badjia' },
                    ],
                },
            ],
        })
        expect(search('organisationUnits', 'zzz')).toMatchObject({
            pager: { total: 0 },
            organisationUnits: [],
        })
    })

    it('finds users by name or username, as the lookup sends them', () => {
        expect(search('userLookup', 'kamara')).toEqual({
            users: [
                { username: 'fatmata.kamara', displayName: 'Fatmata Kamara' },
            ],
        })
        expect(search('userLookup', 'ADMIN')).toEqual({
            users: [{ username: 'admin', displayName: 'John Traore' }],
        })
    })

    it('keeps each upload under a new id, answering its id and name as DHIS2 does', () => {
        const uploads = new Map<string, string>()
        const respond = answer(uploads)
        const upload = (name: string): LabRequest => ({
            resource: 'fileResources',
            data: { file: new File(['a'], name) },
        })
        expect(respond(upload('letter.pdf'), 'create')).toMatchObject({
            response: {
                fileResource: { id: 'labUpload01', name: 'letter.pdf' },
            },
        })
        respond(upload('photo.png'), 'create')
        expect(uploads).toEqual(
            new Map([
                ['labUpload01', 'letter.pdf'],
                ['labUpload02', 'photo.png'],
            ])
        )
    })

    it('refuses an upload without a file, and a resource it does not serve', () => {
        const respond = answer(new Map())
        expect(() => respond({ resource: 'fileResources' }, 'create')).toThrow()
        expect(() => respond({ resource: 'dataStore' }, 'read')).toThrow(
            'does not serve dataStore'
        )
    })
})
