import {
    useClinicContext,
    type ClinicActions,
    type ClinicState,
    type ClinicStatus,
} from './provider/context'

export type { ClinicStatus }

/** The current clinic and how to change it. */
export const useClinic = (): Pick<ClinicState, 'clinic' | 'status'> &
    ClinicActions => {
    const { state, actions } = useClinicContext()
    return { clinic: state.clinic, status: state.status, ...actions }
}
