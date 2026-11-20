import { useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import { createTimelineClient, type TimelineClient } from '../client'

/** The timeline's client over the app-runtime data engine, stable per engine. */
export const useTimelineClient = () => {
    const engine = useDataEngine()
    return useMemo<TimelineClient>(() => createTimelineClient(engine), [engine])
}
