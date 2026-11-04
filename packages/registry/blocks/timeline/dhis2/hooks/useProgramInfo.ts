import i18n from '@dhis2/d2-i18n'
import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { TimelineNotice } from '../../core/types'
import { toProgramInfo } from '../metadata'
import { fetchProgramTimelineMetadata } from '../queries'
import { summarize, unwrap } from '../queryState'
import { timelineKeys } from '../timelineKeys'
import type { ProgramInfo } from '../types'
import { useTimelineClient } from './useTimelineClient'

export interface ProgramInfoResult {
    programs: ReadonlyMap<string, ProgramInfo>
    /** Some program's metadata has not answered yet. */
    pending: boolean
    /** The programs whose metadata has not answered yet. */
    pendingIds: ReadonlySet<string>
    isFetching: boolean
    notices: TimelineNotice[]
}

const NO_PROGRAMS: ReadonlyMap<string, ProgramInfo> = new Map()

/**
 * Each program's stages, data elements and attributes, one request per
 * program. Metadata doesn't change during a session, so it is never
 * refetched behind the user's back. A program that can't be read leaves ids
 * on show and adds a notice.
 */
export const useProgramInfo = (
    ids: ReadonlyArray<string> | undefined
): ProgramInfoResult => {
    const client = useTimelineClient()
    const queries = useQueries({
        queries: (ids ?? []).map((program) => ({
            queryKey: timelineKeys.programMetadata(program),
            staleTime: Infinity,
            queryFn: async ({ signal }: { signal: AbortSignal }) =>
                toProgramInfo(
                    unwrap(
                        await fetchProgramTimelineMetadata(
                            client,
                            { program },
                            signal
                        )
                    )
                ),
        })),
        combine: summarize<ProgramInfo>,
    })
    // Rebuilt only when an answer changes, so entries keep their references.
    const programs = useMemo(() => {
        const found = queries.data.flatMap((info) =>
            info === undefined ? [] : [info]
        )
        return found.length === 0
            ? NO_PROGRAMS
            : new Map(found.map((info) => [info.id, info]))
    }, [queries.data])
    const pendingIds = useMemo(
        () =>
            new Set(
                (ids ?? []).filter(
                    (_, index) =>
                        (queries.statuses[index] ?? 'pending') === 'pending'
                )
            ),
        [ids, queries.statuses]
    )
    return {
        programs,
        pending: ids === undefined || pendingIds.size > 0,
        pendingIds,
        isFetching: queries.isFetching,
        notices: queries.statuses.flatMap((status, index) => {
            const program = ids?.[index]
            return status === 'error' && program !== undefined
                ? [
                      {
                          id: `metadata-failed:${program}`,
                          tone: 'warning' as const,
                          message: i18n.t(
                              "Details of program {{program}} couldn't load, so ids are shown.",
                              { program }
                          ),
                          retry: queries.retries[index],
                      },
                  ]
                : []
        }),
    }
}
