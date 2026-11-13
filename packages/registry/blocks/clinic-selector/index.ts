export { createClinicClient, type ClinicClient } from './api/client'
export type { Clinic } from './api/schemas'
export { ClinicSelector, type ClinicSelectorProps } from './ClinicSelector'
export { useClinic, type ClinicStatus } from './hooks'
export {
    ClinicProvider,
    type ClinicProviderProps,
} from './provider/ClinicProvider'
