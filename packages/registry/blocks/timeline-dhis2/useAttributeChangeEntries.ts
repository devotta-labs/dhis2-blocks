import i18n from '@dhis2/d2-i18n'
import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import type {
    TimelineNotice,
    TimelineStatus,
} from '@/components/timeline/core/types'
import { groupChangelogRows, isNotFound } from './changelog'
import { combineStatus, NO_ENTRIES } from './history'
import { attributesOf } from './metadata'
import { fetchAttributeChangeLog } from './queries'
import { timelineKeys } from './timelineKeys'
import { changeEntries } from './toEntries'
import type { ChangeEntryData, HistoryResult } from './types'
import {
    programLabel,
    refetchOf,
    statusOf,
    unwrap,
    useProgramIds,
    useProgramInfo,
    useSettledOnce,
} from './useHistoryQueries'
import { useTimelineClient } from './useTimelineClient'

export interface AttributeChangeEntriesOptions {
    trackedEntity: string
    /** Defaults to every program the tracked entity is enrolled in. */
    programs?: ReadonlyArray<string>
    /** Most changelog rows read per program; past it a notice says so. */
    maxRows?: number
}

/** A 404 is an answer: the server has no changelog endpoint. */
const retryUnlessNotFound = (failures: number, error: Error) =>
    !isNotFound(error) && failures < 3

/**
 * Attribute value changes, one entry per save, newest first. Without
 * `program` the server only returns the type's attributes, so this asks once
 * per program and keeps each shared row once. Rows exist only where change
 * logging is enabled on the server. A 404 means the server has no changelog,
 * which is a notice, not a failure.
 */
export const useAttributeChangeEntries = ({
    trackedEntity,
    programs,
    maxRows = 500,
}: AttributeChangeEntriesOptions): HistoryResult<ChangeEntryData> => {
    const client = useTimelineClient()
    const ids = useProgramIds({ trackedEntity, programs })
    const info = useProgramInfo(ids.ids)
    const changelogs = useQueries({
        queries: (ids.ids ?? []).map((program) => ({
            queryKey: timelineKeys.attributeChangeLog(trackedEntity, program),
            retry: retryUnlessNotFound,
            queryFn: async ({ signal }: { signal: AbortSignal }) =>
                unwrap(
                    await fetchAttributeChangeLog(
                        client,
                        { trackedEntity, program, maxRows },
                        signal
                    )
                ),
        })),
    })
    const answered = changelogs.map((query) => query.dataUpdatedAt).join()
    // A program's changes show once its metadata has answered, so they never
    // show attribute ids that labels are about to replace.
    const waiting = [...info.pendingIds].join()
    const entries = useMemo(() => {
        const attributes = attributesOf(info.programs.values())
        const rows = changelogs.flatMap((query, index) => {
            const program = ids.ids?.[index]
            return program === undefined || info.pendingIds.has(program)
                ? []
                : (query.data?.rows ?? [])
        })
        return changeEntries(
            groupChangelogRows(rows, (field) =>
                field.kind === 'attribute'
                    ? attributes.get(field.id)
                    : undefined
            )
        )
        // `answered` and `waiting` change whenever the queries' data does.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [ids.ids, answered, waiting, info.programs])

    const unsupported = changelogs.some(
        (query) => query.error !== null && isNotFound(query.error)
    )
    const failed = changelogs.filter(
        (query) =>
            statusOf(query) === 'error' &&
            !(query.error !== null && isNotFound(query.error))
    )
    const changelogStatuses: TimelineStatus[] = changelogs.map((query) =>
        query.error !== null && isNotFound(query.error)
            ? 'success'
            : statusOf(query)
    )
    const firstStatus: TimelineStatus =
        ids.status !== 'success'
            ? ids.status
            : combineStatus([
                  ...changelogStatuses,
                  ...(info.pending ? ['pending' as const] : []),
              ])
    const shown = useSettledOnce(
        firstStatus !== 'pending',
        [trackedEntity, programs?.join(), maxRows].join('|')
    )
    // Once shown, later loading never empties the history again.
    const status: TimelineStatus =
        firstStatus === 'pending' && shown ? 'success' : firstStatus

    const notices: TimelineNotice[] = [
        ...ids.notices,
        ...(unsupported
            ? [
                  {
                      id: 'changes-unsupported',
                      tone: 'info' as const,
                      message: i18n.t(
                          "Changes aren't available on this DHIS2 version."
                      ),
                  },
              ]
            : []),
        ...changelogs.flatMap((query, index): TimelineNotice[] => {
            const program = ids.ids?.[index] ?? ''
            const label = programLabel(info.programs, program)
            if (failed.includes(query)) {
                return [
                    {
                        id: `changes-failed:${program}`,
                        tone: 'error',
                        message: i18n.t(
                            "Changes in {{program}} couldn't load.",
                            { program: label }
                        ),
                        retry: refetchOf(query),
                    },
                ]
            }
            return query.data?.truncated
                ? [
                      {
                          id: `changes-truncated:${program}`,
                          tone: 'info',
                          message: i18n.t(
                              "Older changes in {{program}} aren't shown.",
                              { program: label }
                          ),
                      },
                  ]
                : []
        }),
        ...info.notices,
    ]

    return {
        entries: status === 'pending' ? NO_ENTRIES : entries,
        status,
        notices,
        isFetching:
            ids.isFetching ||
            info.isFetching ||
            changelogs.some((query) => query.isFetching),
        refetch: () => {
            ids.refetch()
            for (const query of changelogs) {
                refetchOf(query)()
            }
        },
    }
}
