import { useMemo } from 'react'
import type { TimelineStatus } from '@/components/timeline/core/types'
import { NO_ENTRIES } from './history'
import { milestoneEntries, noteEntries } from './toEntries'
import type { MilestoneEntryData, NoteEntryData, HistoryResult } from './types'
import {
    refetchOf,
    statusOf,
    useProgramInfo,
    useSettledOnce,
    useTrackedEntity,
} from './useHistoryQueries'
import i18n from '@dhis2/d2-i18n'

export interface EnrollmentEntriesOptions {
    trackedEntity: string
    /** Defaults to every program the tracked entity is enrolled in. */
    programs?: ReadonlyArray<string>
}

/**
 * Enrollment milestones (enrolled, incident, completed, cancelled) and
 * enrollment notes in each program, from one tracked entity request. Event
 * notes stay with their event.
 */
export const useEnrollmentEntries = ({
    trackedEntity,
    programs,
}: EnrollmentEntriesOptions): HistoryResult<
    MilestoneEntryData | NoteEntryData
> => {
    const entity = useTrackedEntity(trackedEntity)
    const programKey = programs?.join(',')
    const enrollments = useMemo(() => {
        const wanted =
            programKey === undefined
                ? undefined
                : new Set(programKey.split(','))
        return (entity.data?.enrollments ?? []).filter(
            (enrollment) =>
                wanted === undefined || wanted.has(enrollment.program)
        )
    }, [entity.data, programKey])
    const programIds = useMemo(
        () =>
            entity.data === undefined
                ? undefined
                : [
                      ...new Set(
                          enrollments.map((enrollment) => enrollment.program)
                      ),
                  ].sort(),
        [entity.data, enrollments]
    )
    const info = useProgramInfo(programIds)

    // An enrollment shows once its program's metadata has answered.
    const entries = useMemo(
        () =>
            enrollments.flatMap((enrollment) => {
                if (info.pendingIds.has(enrollment.program)) {
                    return []
                }
                const program = info.programs.get(enrollment.program)
                return [
                    ...milestoneEntries(enrollment, program),
                    ...noteEntries(enrollment, program),
                ]
            }),
        [enrollments, info.pendingIds, info.programs]
    )

    const entityStatus = statusOf(entity)
    const firstStatus: TimelineStatus =
        entityStatus === 'success' && info.pending ? 'pending' : entityStatus
    const shown = useSettledOnce(
        firstStatus !== 'pending',
        [trackedEntity, programKey].join('|')
    )
    // Once shown, later loading never empties the history again.
    const status: TimelineStatus =
        firstStatus === 'pending' && shown ? 'success' : firstStatus
    return {
        entries: status === 'pending' ? NO_ENTRIES : entries,
        status,
        notices: [
            ...(entityStatus === 'error'
                ? [
                      {
                          id: 'enrollments-failed',
                          tone: 'error' as const,
                          message: i18n.t("The enrollments couldn't load."),
                          retry: refetchOf(entity),
                      },
                  ]
                : []),
            ...info.notices,
        ],
        isFetching: entity.isFetching || info.isFetching,
        refetch: refetchOf(entity),
    }
}
