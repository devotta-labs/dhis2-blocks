import {
    getOrganisationUnitState,
    getProgramState,
} from '../contextTransitions'
import type { AppUrlState } from '../urlState'

describe('context transitions', () => {
    const current: AppUrlState = {
        programId: 'Program0001',
        orgUnitId: 'OrgUnit0001',
        page: 4,
        pageSize: 25,
    }

    it('changes or clears the organisation unit on the first page', () => {
        expect(getOrganisationUnitState(current, 'OrgUnit0002')).toEqual({
            ...current,
            orgUnitId: 'OrgUnit0002',
            page: 1,
        })
        expect(getOrganisationUnitState(current, undefined)).toEqual({
            programId: 'Program0001',
            page: 1,
            pageSize: 25,
        })
    })

    it('changes or clears the program on the first page', () => {
        expect(getProgramState(current, 'Program0002')).toEqual({
            programId: 'Program0002',
            orgUnitId: 'OrgUnit0001',
            page: 1,
            pageSize: 15,
        })
        expect(getProgramState(current, undefined)).toEqual({
            orgUnitId: 'OrgUnit0001',
        })
        expect(getProgramState(current, '')).toEqual({
            orgUnitId: 'OrgUnit0001',
        })
    })

    it('never carries the old page into a new context', () => {
        const transitions = [
            getProgramState(current, 'Program0002'),
            getProgramState(current, undefined),
            getOrganisationUnitState(current, 'OrgUnit0002'),
            getOrganisationUnitState(current, undefined),
        ]
        for (const next of transitions) {
            expect([1, undefined]).toContain(next.page)
        }
    })
})
