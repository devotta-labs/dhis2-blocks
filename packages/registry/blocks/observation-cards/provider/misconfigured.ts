import { useEffect } from 'react'
import type { ProgramMetadata } from '../api/types'
import { isProduction } from './env'

/** The setup message for a data element no stage of the program captures. */
export const describeMisconfigured = (
    dataElement: string,
    program: string,
    metadata: ProgramMetadata
) => {
    const captured = [...metadata.dataElements.values()]
        .map(({ id, displayName }) => `${id} (${displayName})`)
        .join(', ')
    return `Data element ${dataElement} is not captured by any stage of program ${program}. Captured data elements: ${captured || 'none'}`
}

/**
 * Production shows end users a short message in place of the setup details,
 * so the full message goes to the console there.
 */
export const useSetupErrorLog = (message: string) => {
    useEffect(() => {
        if (isProduction()) {
            console.error(message)
        }
    }, [message])
}
