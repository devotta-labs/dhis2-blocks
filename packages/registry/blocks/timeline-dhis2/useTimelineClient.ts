import { useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import { createTimelineClient, type TimelineClient } from './client'

// Kept apart from client.ts so node tests can import the client without
// loading the app runtime.

/** The timeline's client over the app-runtime data engine, stable per engine. */
export const useTimelineClient = (): TimelineClient => {
    const engine = useDataEngine()
    return useMemo(() => createTimelineClient(engine), [engine])
}
