import { getGuardedOrganisationUnitState } from '../contextTransitions'
import type { AppUrlState } from '../urlState'

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
})
