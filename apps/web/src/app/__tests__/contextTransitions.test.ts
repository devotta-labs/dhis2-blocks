import {
    getOrganisationUnitState,
    getProgramState,
} from '../contextTransitions'
import type { AppUrlState } from '../urlState'

describe('organisation unit context transitions', () => {
    const current: AppUrlState = {
        programId: 'Program0001',
        orgUnitId: 'OrgUnit0001',
        selectedTemplateId: 'SavedList01',
        page: 4,
        pageSize: 25,
    }

    it('changes or clears the organisation unit while preserving the program and view', () => {
        expect(getOrganisationUnitState(current, 'OrgUnit0002')).toEqual({
            ...current,
            orgUnitId: 'OrgUnit0002',
            page: 1,
        })
        expect(getOrganisationUnitState(current, undefined)).toEqual({
            programId: 'Program0001',
            selectedTemplateId: 'SavedList01',
            page: 1,
            pageSize: 25,
        })
    })

    it('resets view and paging on program changes but preserves the OU', () => {
        expect(getProgramState(current, 'Program0002')).toEqual({
            programId: 'Program0002',
            orgUnitId: current.orgUnitId,
            page: 1,
            pageSize: 15,
        })
        expect(getProgramState(current, '')).toEqual({
            orgUnitId: current.orgUnitId,
        })
    })
})
