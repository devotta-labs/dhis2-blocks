import { useMemo } from 'react'
import { useStableDataEngine } from '@/components/stable-data-engine'
import { createTimelineClient, type TimelineClient } from '../client'

// Kept apart from client.ts so node tests can import the client without
// loading the app runtime.

/** The timeline's client over the app-runtime data engine, one for the component's lifetime. */
export const useTimelineClient = (): TimelineClient => {
    const engine = useStableDataEngine()
    return useMemo(() => createTimelineClient(engine), [engine])
}
