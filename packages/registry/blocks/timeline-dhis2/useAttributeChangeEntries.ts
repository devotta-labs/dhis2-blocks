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
import { fetchAttributeChangeLog, type ChangeLogResult } from './queries'
import { timelineKeys } from './timelineKeys'
import { changeEntries } from './toEntries'
import type { ChangeEntryData, HistoryResult } from './types'
import {
    programLabel,
    summarize,
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
            queryKey: timelineKeys.attributeChangeLog(
                trackedEntity,
                program,
                maxRows
            ),
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
        combine: summarize<ChangeLogResult>,
    })
    // A program's changes show once its metadata has answered, so they never
    // show attribute ids that labels are about to replace.
    const entries = useMemo(() => {
        const attributes = attributesOf(info.programs.values())
        const rows = changelogs.data.flatMap((data, index) => {
            const program = ids.ids?.[index]
            return program === undefined || info.pendingIds.has(program)
                ? []
                : (data?.rows ?? [])
        })
        return changeEntries(
            groupChangelogRows(rows, (field) =>
                field.kind === 'attribute'
                    ? attributes.get(field.id)
                    : undefined
            )
        )
    }, [ids.ids, changelogs.data, info.pendingIds, info.programs])

    const notFound = changelogs.errors.map(
        (error) => error !== null && isNotFound(error)
    )
    const unsupported = notFound.includes(true)
    // A 404 is an answer, not a failure.
    const changelogStatuses: TimelineStatus[] = changelogs.statuses.map(
        (status, index) => (notFound[index] ? 'success' : status)
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
        ...changelogStatuses.flatMap(
            (changesStatus, index): TimelineNotice[] => {
                const program = ids.ids?.[index] ?? ''
                const label = programLabel(info.programs, program)
                if (changesStatus === 'error') {
                    return [
                        {
                            id: `changes-failed:${program}`,
                            tone: 'error',
                            message: i18n.t(
                                "Changes in {{program}} couldn't load.",
                                { program: label }
                            ),
                            retry: changelogs.retries[index],
                        },
                    ]
                }
                return changelogs.data[index]?.truncated
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
            }
        ),
        ...info.notices,
    ]

    return {
        entries: status === 'pending' ? NO_ENTRIES : entries,
        status,
        notices,
        isFetching: ids.isFetching || info.isFetching || changelogs.isFetching,
        refetch: () => {
            ids.refetch()
            for (const retry of changelogs.retries) {
                retry()
            }
        },
    }
}
