import { useDataEngine } from '@dhis2/app-runtime'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { toProgramInfo } from '../metadata'
import {
    fetchProgramTimelineMetadata,
    shouldRetryRequest,
    type DataEngine,
} from '../queries'
import { timelineKeys } from '../timelineKeys'
import type { ProgramInfo } from '../types'

/**
 * Metadata doesn't change during a session, so it is never refetched behind
 * the user's back.
 */
export const programInfoQuery = (engine: DataEngine, program: string) => ({
    queryKey: timelineKeys.programMetadata(program),
    staleTime: Infinity,
    retry: shouldRetryRequest,
    queryFn: async ({ signal }: { signal: AbortSignal }) =>
        toProgramInfo(
            await fetchProgramTimelineMetadata(engine, { program }, signal)
        ),
})

/** One program's stages, data elements and attributes, keyed by id. */
export const useProgramInfo = (program: string): UseQueryResult<ProgramInfo> =>
    useQuery(programInfoQuery(useDataEngine(), program))
