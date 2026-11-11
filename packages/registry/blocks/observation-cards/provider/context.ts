import { createContext, useContext } from 'react'

/** The person and program every card inside the provider shows. */
export interface ObservationsSubject {
    trackedEntity: string
    program: string
}

export const ObservationsContext = createContext<ObservationsSubject | null>(
    null
)

export const useObservationsSubject = (): ObservationsSubject => {
    const subject = useContext(ObservationsContext)
    if (!subject) {
        throw new Error(
            'Observation cards and hooks must be rendered inside ObservationsProvider'
        )
    }
    return subject
}
