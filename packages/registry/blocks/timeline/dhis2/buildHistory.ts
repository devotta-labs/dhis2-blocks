import i18n from '@dhis2/d2-i18n'
import type { UseQueryResult } from '@tanstack/react-query'
import type { TimelineEntry, TimelineNotice } from '../core/types'
import { groupChangelogRows } from './changelog'
import { attributesOf } from './metadata'
import type { ChangeLogResult, EventsResult, EventTimeField } from './queries'
import type { TrackedEntity } from './schemas'
import {
    changeEntries,
    eventEntry,
    milestoneEntries,
    noteEntries,
    orgUnitIdsOf,
} from './toEntries'
import type { HistoryEntryData, ProgramInfo } from './types'

/** One request, as the history reads it. */
export interface Answer<T> {
    /** While `pending`, the answer to the request before this one, if any. */
    data: T | undefined
    pending: boolean
    /** Failed with nothing to show. */
    failed: boolean
    refetch(): void
}

/**
 * A query that failed and is being retried still counts as failed: TanStack
 * Query puts it back to `pending`, which would hide everything else while it
 * retries.
 */
export const toAnswer = <T>(query: UseQueryResult<T>): Answer<T> => {
    const failed =
        query.data === undefined &&
        (query.isError || query.errorUpdateCount > 0)
    return {
        data: query.data,
        pending:
            query.isPlaceholderData || (query.data === undefined && !failed),
        failed,
        refetch: query.refetch,
    }
}

/** The requests of one program. */
export interface ProgramAnswers {
    id: string
    info: Answer<ProgramInfo>
    events: Answer<EventsResult>
    changes: Answer<ChangeLogResult>
}

export interface HistorySources {
    trackedEntity: Answer<TrackedEntity>
    /** The programs the history covers; undefined until the enrollments say which. */
    programs: ReadonlyArray<ProgramAnswers> | undefined
    orgUnitNames: Answer<ReadonlyMap<string, string>>
    /** The history has been on show for this person; it never empties again. */
    shown: boolean
    timeField: EventTimeField
    cap: number
    /** The current day, `YYYY-MM-DD`. */
    today: string
}

export interface History {
    entries: ReadonlyArray<TimelineEntry<HistoryEntryData>>
    /** The first answers are on their way; there are no entries yet. */
    isPending: boolean
    /** Neither the enrollments nor any events could be loaded. */
    isError: boolean
    /** Failed parts (with retry), unsupported changelogs, capped events. */
    notices: TimelineNotice[]
}

const NO_ENTRIES: ReadonlyArray<never> = []
const NO_NAMES: ReadonlyMap<string, string> = new Map()

/**
 * A program shows once its metadata has answered or failed, so its entries
 * never show ids that names are about to replace.
 */
const readyPrograms = (programs: ReadonlyArray<ProgramAnswers> | undefined) =>
    (programs ?? []).filter((program) => !program.info.pending)

/** Every program's events and metadata have answered or failed. */
export const hasFirstAnswers = (
    programs: ReadonlyArray<ProgramAnswers> | undefined
) =>
    programs !== undefined &&
    programs.every(({ events, info }) => !events.pending && !info.pending)

/** The org units the events on show name. */
export const orgUnitsToName = (
    programs: ReadonlyArray<ProgramAnswers> | undefined
) =>
    orgUnitIdsOf(
        readyPrograms(programs).map(({ events, info }) => ({
            events: events.data?.events ?? [],
            program: info.data,
        }))
    )

const noticesOf = ({
    trackedEntity,
    programs = [],
    orgUnitNames,
    cap,
}: HistorySources): TimelineNotice[] => {
    const label = ({ id, info }: ProgramAnswers) => info.data?.name ?? id
    const notices: TimelineNotice[] = []
    if (trackedEntity.failed) {
        notices.push({
            id: 'enrollments-failed',
            tone: 'error',
            message: i18n.t("The enrollments couldn't load."),
            retry: () => trackedEntity.refetch(),
        })
    }
    for (const program of programs) {
        if (program.events.failed) {
            notices.push({
                id: `events-failed:${program.id}`,
                tone: 'error',
                message: i18n.t("Events in {{program}} couldn't load.", {
                    program: label(program),
                }),
                retry: () => program.events.refetch(),
            })
        } else if (program.events.data?.capped) {
            notices.push({
                id: `events-capped:${program.id}`,
                tone: 'info',
                message: i18n.t(
                    'Showing the most recent {{count}} events in {{program}}.',
                    { count: cap, program: label(program) }
                ),
            })
        }
    }
    for (const program of programs) {
        if (program.info.failed) {
            notices.push({
                id: `metadata-failed:${program.id}`,
                tone: 'warning',
                message: i18n.t(
                    "Details of program {{program}} couldn't load, so ids are shown.",
                    { program: program.id }
                ),
                retry: () => program.info.refetch(),
            })
        }
    }
    if (orgUnitNames.failed) {
        notices.push({
            id: 'org-units-failed',
            tone: 'warning',
            message: i18n.t("Org unit names couldn't load, so ids are shown."),
            retry: () => orgUnitNames.refetch(),
        })
    }
    if (programs.some(({ changes }) => changes.data?.unsupported)) {
        notices.push({
            id: 'changes-unsupported',
            tone: 'info',
            message: i18n.t("Changes aren't available on this DHIS2 version."),
        })
    }
    for (const program of programs) {
        if (program.changes.failed) {
            notices.push({
                id: `changes-failed:${program.id}`,
                tone: 'error',
                message: i18n.t("Changes in {{program}} couldn't load.", {
                    program: label(program),
                }),
                retry: () => program.changes.refetch(),
            })
        } else if (program.changes.data?.truncated) {
            notices.push({
                id: `changes-truncated:${program.id}`,
                tone: 'info',
                message: i18n.t("Older changes in {{program}} aren't shown.", {
                    program: label(program),
                }),
            })
        }
    }
    return notices
}

const entriesOf = ({
    trackedEntity,
    programs,
    orgUnitNames,
    timeField,
    today,
}: HistorySources): TimelineEntry<HistoryEntryData>[] => {
    const ready = readyPrograms(programs)
    const infoOf = new Map(ready.map(({ id, info }) => [id, info.data]))
    const attributes = attributesOf(
        ready.flatMap(({ info }) =>
            info.data === undefined ? [] : [info.data]
        )
    )
    return [
        ...ready.flatMap(({ events, info }) =>
            (events.data?.events ?? []).map((event) =>
                eventEntry(event, {
                    timeField,
                    today,
                    program: info.data,
                    orgUnitNames: orgUnitNames.data ?? NO_NAMES,
                })
            )
        ),
        ...(trackedEntity.data?.enrollments ?? []).flatMap((enrollment) => {
            if (!infoOf.has(enrollment.program)) {
                return []
            }
            const program = infoOf.get(enrollment.program)
            return [
                ...milestoneEntries(enrollment, program),
                ...noteEntries(enrollment, program),
            ]
        }),
        // The type's attributes come back in every program's changelog;
        // grouping the programs' rows together keeps each save once.
        ...changeEntries(
            groupChangelogRows(
                ready.flatMap(({ changes }) => changes.data?.rows ?? []),
                (field) =>
                    field.kind === 'attribute'
                        ? attributes.get(field.id)
                        : undefined
            )
        ),
    ]
}

/**
 * A person's history from its requests: the tracked entity (enrollments and
 * their notes) and, per program, its metadata, events and attribute changes.
 *
 * Nothing shows until the enrollments, every program's events and metadata
 * and the org unit names have answered once, so entries don't shift about
 * while the first answers arrive. Attribute changes are not waited for: a
 * changelog is read a page at a time, and its entries join when they arrive.
 * Once `shown`, the history never empties again: a refetch, a retry or a newly
 * enrolled program fills in while what is on screen stays.
 *
 * A request that fails becomes a notice and the rest still shows. It is an
 * error only when the enrollments failed and no program's events loaded.
 */
export const buildHistory = (sources: HistorySources): History => {
    const { trackedEntity, programs, orgUnitNames, shown } = sources
    const notices = noticesOf(sources)
    const isError =
        trackedEntity.failed &&
        (programs === undefined ||
            (programs.length > 0 &&
                programs.every(({ events }) => events.failed)))
    const waiting =
        trackedEntity.pending ||
        (programs !== undefined &&
            (!hasFirstAnswers(programs) || orgUnitNames.pending))
    const isPending = !isError && waiting && !shown
    if (isError || isPending) {
        return { entries: NO_ENTRIES, isPending, isError, notices }
    }
    return { entries: entriesOf(sources), isPending, isError, notices }
}
