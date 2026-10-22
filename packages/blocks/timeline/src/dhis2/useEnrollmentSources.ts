import i18n from '@dhis2/d2-i18n'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Result } from 'better-result'
import { useMemo, useRef } from 'react'
import type {
    SourceError,
    SourcePage,
    TimelineEntry,
    TimelineSource,
} from '../core/types'
import { fetchTrackedEntityWithEnrollments } from './queries'
import type { Enrollment, Note, TrackedEntity } from './schemas'
import { timelineKeys } from './timelineKeys'
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

const dayOf = (stored: string) => stored.slice(0, 10)

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
            occurredAt &&
                (!enrolledAt || dayOf(occurredAt) !== dayOf(enrolledAt))
                ? occurredAt
                : undefined
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
 * sources (same query key); `dataUpdatedAt` is the sources' `revision`.
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
    const { dataUpdatedAt } = useQuery({
        ...request,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
    })
    // The first load is not a change: the revision stays undefined until a
    // later update (invalidation) moves `dataUpdatedAt` off its first value.
    const baseline = useRef({ request, at: 0 })
    if (baseline.current.request !== request) {
        baseline.current = { request, at: 0 }
    }
    if (baseline.current.at === 0 && dataUpdatedAt !== 0) {
        baseline.current.at = dataUpdatedAt
    }
    const revision =
        dataUpdatedAt === baseline.current.at ? undefined : dataUpdatedAt

    return useMemo(
        (): TimelineSource<TData> => ({
            key,
            label,
            revision,
            async fetchPage(): Promise<Result<SourcePage<TData>, SourceError>> {
                try {
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
        [revision, request, queryClient, key]
    )
}

const milestoneEntries = (entity: TrackedEntity) =>
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
