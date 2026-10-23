import {
    orgUnitPathsRequest,
    personRequest,
    programsRequest,
    relationshipsRequest,
    relationshipTypesRequest,
} from '../requests'

describe('request builders', () => {
    it('asks for the person without a program', () => {
        const request = personRequest('TrE2eTei001')

        expect(request.resource).toBe('tracker/trackedEntities')
        expect(request.id).toBe('TrE2eTei001')
        expect(request.params).not.toHaveProperty('program')
    })

    it('sorts the ids in the filter, so the same set asks the same thing', () => {
        expect(programsRequest(['b', 'c', 'a']).params).toMatchObject({
            filter: 'id:in:[a,b,c]',
            paging: false,
        })
        expect(relationshipTypesRequest(['y', 'x']).params).toMatchObject({
            filter: 'id:in:[x,y]',
            paging: false,
        })
        expect(orgUnitPathsRequest(['q', 'p']).params).toMatchObject({
            filter: 'id:in:[p,q]',
            paging: false,
        })
    })

    it('does not reorder the caller ids', () => {
        const ids = ['b', 'a']

        programsRequest(ids)

        expect(ids).toEqual(['b', 'a'])
    })

    it('asks for every relationship of the person', () => {
        expect(relationshipsRequest('TrE2eTei001').params).toMatchObject({
            trackedEntity: 'TrE2eTei001',
            paging: false,
        })
    })
})
