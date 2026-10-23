import i18n from '@dhis2/d2-i18n'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Result } from 'better-result'
import { useMemo } from 'react'
import { z } from 'zod'
import type {
    SourceError,
    SourcePage,
    TimelineEntry,
    TimelineSource,
} from '../core/types'
import {
    changelogError,
    groupChangelogRows,
    splitTrailingSave,
    type ChangeGroup,
} from './changelog'
import { fetchAttributeChangeLogPage } from './queries'
import type { ChangeLogPage, ChangeLogRow } from './schemas'
import { timelineKeys } from './timelineKeys'
import { useQueryRevision } from './useQueryRevision'
import { useTimelineClient } from './useTimelineClient'

export interface TrackedEntityAttributeChangelogSourceOptions {
    trackedEntity: string
    program: string
    pageSize?: number
}

/**
 * The next page, and the rows of the save that may continue on it: they were
 * held back from the last page and are shown with the rest of their save.
 */
const CursorSchema = z.object({
    page: z.number().int().min(2),
    carry: z.array(z.custom<ChangeLogRow>()),
})

const unwrap = <T>(result: Result<T, Error>): T => {
    if (Result.isError(result)) {
        throw result.error
    }
    return result.value
}

const entriesOf = (rows: ChangeLogRow[]): Array<TimelineEntry<ChangeGroup>> =>
    groupChangelogRows(rows).map((group) => ({
        id: `changes:${group.id}`,
        at: group.createdAt,
        precision: 'instant',
        sourceKey: 'changes',
        data: group,
    }))

/**
 * One page of saves. A full page holds back every row at its oldest
 * `createdAt` (that save may continue on the next page) and claims complete
 * only down to the last save it shows.
 */
const toPage = (
    rows: ChangeLogRow[],
    hasMore: boolean,
    page: number
): SourcePage<ChangeGroup> => {
    if (!hasMore) {
        return { entries: entriesOf(rows) }
    }
    const { emitted, carry } = splitTrailingSave(rows)
    const result: SourcePage<ChangeGroup> = {
        entries: entriesOf(emitted),
        nextCursor: { page: page + 1, carry },
    }
    // The oldest save shown; none shown (one save filled the page) claims nothing.
    const oldestShown = emitted.reduce<string | undefined>(
        (min, row) =>
            min === undefined || row.createdAt < min ? row.createdAt : min,
        undefined
    )
    if (oldestShown !== undefined) {
        result.completeUntil = oldestShown
    }
    return result
}

/**
 * Attribute value changes of one tracked entity in one program, one entry
 * per save (`changes:<createdAt>:<username>`), newest first. The first page
 * is cached under `timelineKeys.attributeChangeLog`, so invalidating
 * `timelineKeys.root` restarts the source. A 404 is `unsupported`.
 */
export const useTrackedEntityAttributeChangelogSource = ({
    trackedEntity,
    program,
    pageSize = 50,
}: TrackedEntityAttributeChangelogSourceOptions): TimelineSource<ChangeGroup> => {
    const client = useTimelineClient()
    const queryClient = useQueryClient()

    const firstPage = useMemo(
        () => ({
            queryKey: [
                ...timelineKeys.attributeChangeLog(trackedEntity, program),
                { pageSize },
            ],
            retry: false,
            // Only invalidation refreshes the first page: a refetch restarts
            // the source and drops the pages loaded so far.
            staleTime: Infinity,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchOnMount: false,
            queryFn: async ({
                signal,
            }: {
                signal: AbortSignal
            }): Promise<ChangeLogPage> =>
                unwrap(
                    await fetchAttributeChangeLogPage(
                        client,
                        { trackedEntity, program, page: 1, pageSize },
                        signal
                    )
                ),
        }),
        [client, trackedEntity, program, pageSize]
    )

    // Observed so invalidation refetches it; the revision moves only when its
    // data is updated after its first load. Another tracked entity or program
    // is a new subject, which starts the source afresh.
    useQuery(firstPage)
    const revision = useQueryRevision(firstPage.queryKey)
    const subject = JSON.stringify(firstPage.queryKey)

    return useMemo(
        (): TimelineSource<ChangeGroup> => ({
            key: 'changes',
            label: i18n.t('Changes'),
            revision,
            subject,
            async fetchPage(
                cursor,
                signal
            ): Promise<Result<SourcePage<ChangeGroup>, SourceError>> {
                try {
                    if (cursor === undefined) {
                        const { rows, hasMore } = await queryClient.fetchQuery({
                            ...firstPage,
                            staleTime: Infinity,
                        })
                        return Result.ok(toPage(rows, hasMore, 1))
                    }
                    const { page, carry } = CursorSchema.parse(cursor)
                    const { rows, hasMore } = unwrap(
                        await fetchAttributeChangeLogPage(
                            client,
                            { trackedEntity, program, page, pageSize },
                            signal
                        )
                    )
                    // Rows newer than the held-back save were shown already;
                    // they reappear when new changes shift the offset pages.
                    const boundary = carry[0]?.createdAt
                    const fresh =
                        boundary === undefined
                            ? rows
                            : rows.filter((row) => row.createdAt <= boundary)
                    return Result.ok(
                        toPage([...carry, ...fresh], hasMore, page)
                    )
                } catch (cause) {
                    return Result.err(changelogError(cause))
                }
            },
        }),
        [
            revision,
            subject,
            firstPage,
            queryClient,
            client,
            trackedEntity,
            program,
            pageSize,
        ]
    )
}
