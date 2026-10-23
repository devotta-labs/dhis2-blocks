import type {
    TimelineEntry,
    TimelinePhase,
} from '@/components/timeline/core/types'
import { deriveEventStatus, type DerivedEventStatus } from './eventStatus'
import type { EventTimeField } from './queries'
import type { Enrollment, TrackerEvent } from './schemas'
import type {
    ChangeSave,
    Dhis2ChangeData,
    Dhis2EventData,
    Dhis2MilestoneData,
    Dhis2NoteData,
    MilestoneKind,
    ProgramInfo,
} from './types'

/** An event with no date has no place before or after now: it is Undated. */
const phaseOf = (status: DerivedEventStatus): TimelinePhase =>
    status === 'scheduled'
        ? 'future'
        : status === 'overdue'
          ? 'overdue'
          : 'past'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

const NO_NAMES: ReadonlyMap<string, string> = new Map()

export interface EventEntryOptions {
    timeField: EventTimeField
    /** The current day, `YYYY-MM-DD`. */
    today: string
    program?: ProgramInfo
    orgUnitNames?: ReadonlyMap<string, string>
}

/**
 * An event on the timeline, with its program, stage and org unit names.
 * Scheduled, overdue and skipped events sit at their `scheduledAt`; the others
 * at `timeField`. A missing value gives `at: ''`, which the feed shows as
 * Undated.
 */
export const eventEntry = (
    event: TrackerEvent,
    { timeField, today, program, orgUnitNames = NO_NAMES }: EventEntryOptions
): TimelineEntry<Dhis2EventData> => {
    const status = deriveEventStatus(event, today)
    const byScheduledAt =
        status === 'scheduled' || status === 'overdue' || status === 'skipped'
    const at = (byScheduledAt ? event.scheduledAt : event[timeField]) ?? ''
    const data: Dhis2EventData = { kind: 'event', event, status, orgUnitNames }
    if (program !== undefined) {
        data.program = program
        const stage = program.stages.get(event.programStage)
        if (stage !== undefined) {
            data.stage = stage
        }
    }
    const orgUnitName =
        event.orgUnit === undefined
            ? undefined
            : orgUnitNames.get(event.orgUnit)
    if (orgUnitName !== undefined) {
        data.orgUnitName = orgUnitName
    }
    return {
        id: `event:${event.event}`,
        at,
        precision: DATE_ONLY.test(at) ? 'day' : 'instant',
        phase: at === '' ? 'past' : phaseOf(status),
        data,
    }
}

/**
 * Enrolled, incident, completed and cancelled dates of one enrollment.
 * Enrollment and incident dates are dates stored at midnight; completed and
 * cancelled are moments.
 */
export const milestoneEntries = (
    enrollment: Enrollment,
    program?: ProgramInfo
): TimelineEntry<Dhis2MilestoneData>[] => {
    const milestone = (
        kind: MilestoneKind,
        at: string | undefined
    ): TimelineEntry<Dhis2MilestoneData>[] => {
        if (!at) {
            return []
        }
        const data: Dhis2MilestoneData = {
            kind: 'milestone',
            milestone: kind,
            enrollment,
        }
        if (program !== undefined) {
            data.program = program
        }
        return [
            {
                id: `milestone:${enrollment.enrollment}:${kind}`,
                at,
                precision:
                    kind === 'enrolled' || kind === 'incident'
                        ? 'day'
                        : 'instant',
                data,
            },
        ]
    }
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

/** The notes on one enrollment, at the time they were stored. */
export const noteEntries = (
    enrollment: Enrollment,
    program?: ProgramInfo
): TimelineEntry<Dhis2NoteData>[] =>
    enrollment.notes.flatMap((note) => {
        if (!note.storedAt) {
            return []
        }
        const data: Dhis2NoteData = { kind: 'note', note, enrollment }
        if (program !== undefined) {
            data.program = program
        }
        return [{ id: `note:${note.note}`, at: note.storedAt, data }]
    })

/** One entry per save. */
export const changeEntries = (
    saves: ReadonlyArray<ChangeSave>
): TimelineEntry<Dhis2ChangeData>[] =>
    saves.map((save) => ({
        id: `change:${save.id}`,
        at: save.createdAt,
        precision: 'instant',
        data: { kind: 'change', save },
    }))

/**
 * The org units to name for these events: where each happened, and any value
 * of an org-unit-typed data element in its program's stage. Sorted and unique.
 */
export const orgUnitIdsOf = (
    groups: ReadonlyArray<{
        events: ReadonlyArray<TrackerEvent>
        program?: ProgramInfo
    }>
): string[] => {
    const ids = new Set<string>()
    for (const { events, program } of groups) {
        for (const event of events) {
            if (event.orgUnit !== undefined) {
                ids.add(event.orgUnit)
            }
            const stage = program?.stages.get(event.programStage)
            for (const { dataElement, value } of event.dataValues) {
                if (
                    stage?.dataElements.get(dataElement)?.meta.valueType ===
                    'ORGANISATION_UNIT'
                ) {
                    ids.add(value)
                }
            }
        }
    }
    return [...ids].sort()
}
