import type { AppUrlState } from './urlState'

export const getOrganisationUnitState = (
    current: AppUrlState,
    orgUnitId: string | undefined
): AppUrlState => {
    const next = { ...current }
    delete next.orgUnitId
    return orgUnitId ? { ...next, orgUnitId, page: 1 } : { ...next, page: 1 }
}

export const getProgramState = (
    current: AppUrlState,
    programId: string
): AppUrlState =>
    programId
        ? { programId, orgUnitId: current.orgUnitId, page: 1, pageSize: 15 }
        : { orgUnitId: current.orgUnitId }
