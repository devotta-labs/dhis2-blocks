import {
    useClinicContext,
    type ClinicContextValue,
    type ClinicStatus,
} from './provider/context'

export type { ClinicStatus }

/** The current clinic and how to change it. */
export const useClinic = (): Pick<
    ClinicContextValue,
    'clinic' | 'status' | 'retry' | 'setClinic'
> => {
    const { clinic, status, retry, setClinic } = useClinicContext()
    return { clinic, status, retry, setClinic }
}
