import type { AppUrlState } from './urlState'

// Every context change starts the list on the first page in the same URL
// update: the list remounts for a new context and reads its page from here.

export const getProgramState = (
    current: AppUrlState,
    programId: string | undefined
): AppUrlState =>
    programId
        ? { programId, orgUnitId: current.orgUnitId, page: 1, pageSize: 15 }
        : { orgUnitId: current.orgUnitId }

export const getOrganisationUnitState = (
    current: AppUrlState,
    orgUnitId: string | undefined
): AppUrlState => {
    const next = { ...current }
    delete next.orgUnitId
    return orgUnitId ? { ...next, orgUnitId, page: 1 } : { ...next, page: 1 }
}
