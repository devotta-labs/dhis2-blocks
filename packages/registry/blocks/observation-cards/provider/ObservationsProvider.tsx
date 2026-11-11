import React, { useMemo, type ReactNode } from 'react'
import { ObservationsContext } from './context'

export interface ObservationsProviderProps {
    /** The person whose observations the cards show. */
    trackedEntity: string
    /** The program whose stages capture the cards' data elements. */
    program: string
    children?: ReactNode
}

/**
 * Says whose observations the cards inside show. The cards load the
 * program's metadata and the person's events themselves, and share the
 * requests. It renders only its children.
 */
export function ObservationsProvider({
    trackedEntity,
    program,
    children,
}: ObservationsProviderProps) {
    const subject = useMemo(
        () => ({ trackedEntity, program }),
        [trackedEntity, program]
    )
    return (
        <ObservationsContext.Provider value={subject}>
            {children}
        </ObservationsContext.Provider>
    )
}
