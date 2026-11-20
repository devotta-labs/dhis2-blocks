import {
    useOrgUnitContext,
    type OrgUnitActions,
    type OrgUnitState,
    type OrgUnitStatus,
} from './provider/context'

export type { OrgUnitStatus }

/** The current organisation unit and how to change it. */
export const useOrgUnit: () => Pick<OrgUnitState, 'orgUnit' | 'status'> &
    OrgUnitActions = () => {
    const { state, actions } = useOrgUnitContext()
    return { orgUnit: state.orgUnit, status: state.status, ...actions }
}
