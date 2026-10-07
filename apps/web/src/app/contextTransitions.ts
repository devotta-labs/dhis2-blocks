import type { AppUrlState } from './urlState'

export const getGuardedOrganisationUnitState = (
    current: AppUrlState,
    orgUnitId: string | undefined,
    confirmDiscard: () => boolean
): AppUrlState => {
    if (!confirmDiscard()) {
        return current
    }

    const next = { ...current }
    delete next.orgUnitId

    return orgUnitId ? { ...next, orgUnitId, page: 1 } : { ...next, page: 1 }
}
