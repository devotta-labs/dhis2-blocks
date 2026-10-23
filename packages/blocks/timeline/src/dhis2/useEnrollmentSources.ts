import i18n from '@dhis2/d2-i18n'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Result } from 'better-result'
import { useMemo } from 'react'
import type {
    SourceError,
    SourcePage,
    TimelineEntry,
    TimelineSource,
} from '../core/types'
import { fetchTrackedEntityWithEnrollments } from './queries'
import type { Enrollment, Note, TrackedEntity } from './schemas'
import { timelineKeys } from './timelineKeys'
import { useQueryRevision } from './useQueryRevision'
import { useTimelineClient } from './useTimelineClient'

export type MilestoneKind = 'enrolled' | 'incident' | 'completed' | 'cancelled'

export interface MilestoneEntryData {
    kind: MilestoneKind
    enrollment: Enrollment
}

export interface NoteEntryData {
    note: Note
    /** The uid of the enrollment the note belongs to. */
    enrollment: string
}

export interface EnrollmentSourceOptions {
    trackedEntity: string
    program: string
}

const failed = (cause: unknown): SourceError => ({
    kind: 'failed',
    error: cause instanceof Error ? cause : new Error(String(cause)),
})

const milestonesOf = (
    enrollment: Enrollment
): Array<TimelineEntry<MilestoneEntryData>> => {
    const milestone = (kind: MilestoneKind, at: string | undefined) =>
        at
            ? [
                  {
                      id: `milestones:${enrollment.enrollment}:${kind}`,
                      at,
                      // Enrollment and incident dates are dates, stored at
                      // midnight; completed and cancelled are moments.
                      precision:
                          kind === 'enrolled' || kind === 'incident'
                              ? ('day' as const)
                              : ('instant' as const),
                      sourceKey: 'milestones',
                      data: { kind, enrollment },
                  },
              ]
            : []
    const { enrolledAt, occurredAt, status } = enrollment
    const closedAt = enrollment.completedAt ?? enrollment.updatedAt
    return [
        ...milestone('enrolled', enrolledAt),
        ...milestone(
            'incident',
            occurredAt && occurredAt !== enrolledAt ? occurredAt : undefined
        ),
        ...milestone(
            'completed',
            status === 'COMPLETED' ? closedAt : undefined
        ),
        ...milestone(
            'cancelled',
            status === 'CANCELLED' ? closedAt : undefined
        ),
    ]
}

const notesOf = (enrollment: Enrollment): Array<TimelineEntry<NoteEntryData>> =>
    enrollment.notes.flatMap((note) =>
        note.storedAt
            ? [
                  {
                      id: `notes:${note.note}`,
                      at: note.storedAt,
                      sourceKey: 'notes',
                      data: { note, enrollment: enrollment.enrollment },
                  },
              ]
            : []
    )

/**
 * One request for the tracked entity and its enrollments, shared by both
 * sources (same query key); `useQueryRevision` is the sources' `revision`,
 * and the query key their `subject`, so another record starts them afresh.
 */
const useEnrollmentSource = <TData>(
    { trackedEntity, program }: EnrollmentSourceOptions,
    key: string,
    label: string,
    entriesOf: (entity: TrackedEntity) => Array<TimelineEntry<TData>>
): TimelineSource<TData> => {
    const client = useTimelineClient()
    const queryClient = useQueryClient()

    const request = useMemo(
        () => ({
            queryKey: timelineKeys.trackedEntity(trackedEntity, program),
            retry: false,
            queryFn: async ({ signal }: { signal: AbortSignal }) => {
                const result = await fetchTrackedEntityWithEnrollments(
                    client,
                    { trackedEntity, program },
                    signal
                )
                if (Result.isError(result)) {
                    throw result.error
                }
                return result.value
            },
        }),
        [client, trackedEntity, program]
    )

    // Only invalidation refreshes this; focus, reconnect and remount do not.
    useQuery({
        ...request,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
    })
    // The first load, or the first failure, is not a change; invalidation is.
    const revision = useQueryRevision(request.queryKey)
    const subject = JSON.stringify(request.queryKey)

    return useMemo(
        (): TimelineSource<TData> => ({
            key,
            label,
            revision,
            subject,
            async fetchPage(): Promise<Result<SourcePage<TData>, SourceError>> {
                try {
                    // Shares the query's own request, so this call's signal
                    // is not used.
                    const entity = await queryClient.fetchQuery({
                        ...request,
                        staleTime: Infinity,
                    })
                    return Result.ok({ entries: entriesOf(entity) })
                } catch (cause) {
                    return Result.err(failed(cause))
                }
            },
        }),
        // `entriesOf` and `label` are module-level or constant per hook.
        [revision, subject, request, queryClient, key]
    )
}

/** Every enrollment's milestones, as the milestones source shows them. */
export const milestoneEntries = (entity: TrackedEntity) =>
    entity.enrollments.flatMap(milestonesOf)

const noteEntries = (entity: TrackedEntity) =>
    entity.enrollments.flatMap(notesOf)

/** Enrolled, incident, completed and cancelled dates of every enrollment. */
export const useEnrollmentMilestonesSource = (
    options: EnrollmentSourceOptions
): TimelineSource<MilestoneEntryData> =>
    useEnrollmentSource(
        options,
        'milestones',
        i18n.t('Milestones'),
        milestoneEntries
    )

/** The notes on every enrollment, at the time they were stored. */
export const useEnrollmentNotesSource = (
    options: EnrollmentSourceOptions
): TimelineSource<NoteEntryData> =>
    useEnrollmentSource(options, 'notes', i18n.t('Notes'), noteEntries)
