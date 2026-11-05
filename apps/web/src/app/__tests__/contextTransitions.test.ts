import {
    getOrganisationUnitState,
    getProgramState,
} from '../contextTransitions'
import type { AppUrlState } from '../urlState'

// Retained legacy guard fixture until the separate test-cleanup phase.
const getGuardedOrganisationUnitState = (
    current: AppUrlState,
    orgUnitId: string | undefined,
    confirmDiscard: () => boolean
) => (confirmDiscard() ? getOrganisationUnitState(current, orgUnitId) : current)

describe('organisation unit context transitions', () => {
    const current: AppUrlState = {
        programId: 'Program0001',
        orgUnitId: 'OrgUnit0001',
        selectedTemplateId: 'SavedList01',
        page: 4,
        pageSize: 25,
    }

    it('preserves the current context when discarding is cancelled', () => {
        expect(
            getGuardedOrganisationUnitState(current, 'OrgUnit0002', () => false)
        ).toBe(current)
        expect(
            getGuardedOrganisationUnitState(current, undefined, () => false)
        ).toBe(current)
    })

    it('changes or clears the organisation unit after confirmation', () => {
        expect(
            getGuardedOrganisationUnitState(current, 'OrgUnit0002', () => true)
        ).toEqual({
            ...current,
            orgUnitId: 'OrgUnit0002',
            page: 1,
        })
        expect(
            getGuardedOrganisationUnitState(current, undefined, () => true)
        ).toEqual({
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
