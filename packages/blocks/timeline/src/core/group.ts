import {
    formatCalendarDate,
    storedDay,
} from '@/registry/dhis2/value-display/calendar'
import type { Dhis2Calendar } from '@/registry/dhis2/value-display/types'
import { compareEntries, sortKey } from './sort'
import type {
    GroupBy,
    TimelineEntry,
    TimelineGroup,
    TimelineOrder,
    TimelinePhase,
} from './types'

export interface GroupOptions<TData> {
    order: TimelineOrder
    groupBy: GroupBy<TData>
    /** The current day, `YYYY-MM-DD`, in the system calendar's ISO form. */
    today: string
    calendar: Dhis2Calendar
    locale?: string
    labels: { overdue: string; undated: string; allEntries: string }
}

interface GroupLabel {
    key: string
    label: string
}

interface TimelineLayout<TData> {
    groups: TimelineGroup<TData>[]
    /** The now marker renders before `groups[nowIndex]`. */
    nowIndex: number
}

let warnedAboutUndated = false

const warnOnceAboutUndated = (count: number) => {
    if (warnedAboutUndated || process.env.NODE_ENV === 'production') {
        return
    }
    warnedAboutUndated = true
    console.warn(
        `Timeline: ${count} entr${count === 1 ? 'y has' : 'ies have'} an unreadable "at" and ${count === 1 ? 'is' : 'are'} listed as undated.`
    )
}

const phaseOf = (
    entry: TimelineEntry<unknown>,
    day: string,
    today: string
): TimelinePhase => entry.phase ?? (day > today ? 'future' : 'past')

/** Groups the entries of one phase, in the order the entries arrive. */
const groupEntries = <TData>(
    entries: TimelineEntry<TData>[],
    phase: TimelinePhase,
    options: GroupOptions<TData>
): TimelineGroup<TData>[] => {
    const groups = new Map<string, TimelineGroup<TData>>()
    for (const entry of entries) {
        const { key, label } = groupLabel(entry, options)
        const group = groups.get(key) ?? { key, label, phase, entries: [] }
        group.entries.push(entry)
        groups.set(key, group)
    }
    return [...groups.values()]
}

const groupLabel = <TData>(
    entry: TimelineEntry<TData>,
    { groupBy, calendar, locale, labels }: GroupOptions<TData>
): GroupLabel => {
    if (groupBy === 'none') {
        return { key: 'all', label: labels.allEntries }
    }
    if (groupBy === 'day') {
        const day = storedDay(entry.at) ?? entry.at
        return { key: day, label: formatCalendarDate(day, calendar, locale) }
    }
    return groupBy(entry)
}

/**
 * Lays entries out for rendering: future groups, "now", overdue, past groups
 * when descending, mirrored when ascending, with undated entries last. The now
 * marker renders before `groups[nowIndex]`.
 */
export const buildTimelineGroups = <TData>(
    entries: TimelineEntry<TData>[],
    options: GroupOptions<TData>
): TimelineLayout<TData> => {
    const dated: TimelineEntry<TData>[] = []
    const undated: TimelineEntry<TData>[] = []
    for (const entry of entries) {
        ;(sortKey(entry) === undefined ? undated : dated).push(entry)
    }
    if (undated.length > 0) {
        warnOnceAboutUndated(undated.length)
    }

    const byPhase = {
        future: new Array<TimelineEntry<TData>>(),
        overdue: new Array<TimelineEntry<TData>>(),
        past: new Array<TimelineEntry<TData>>(),
    } satisfies Record<TimelinePhase, TimelineEntry<TData>[]>
    for (const entry of dated) {
        const day = storedDay(entry.at) ?? ''
        byPhase[phaseOf(entry, day, options.today)].push(entry)
    }

    const sorted = (phase: TimelinePhase) =>
        groupEntries(
            [...byPhase[phase]].sort(compareEntries(options.order)),
            phase,
            options
        )
    const future = sorted('future')
    const past = sorted('past')
    const overdue: TimelineGroup<TData>[] =
        byPhase.overdue.length === 0
            ? []
            : [
                  {
                      key: 'overdue',
                      label: options.labels.overdue,
                      phase: 'overdue',
                      entries: [...byPhase.overdue].sort(compareEntries('asc')),
                  },
              ]
    const undatedGroups: TimelineGroup<TData>[] =
        undated.length === 0
            ? []
            : [
                  {
                      key: 'undated',
                      label: options.labels.undated,
                      phase: 'undated',
                      entries: undated,
                  },
              ]

    if (options.order === 'desc') {
        return {
            groups: [...future, ...overdue, ...past, ...undatedGroups],
            nowIndex: future.length,
        }
    }
    return {
        groups: [...past, ...overdue, ...future, ...undatedGroups],
        nowIndex: past.length + overdue.length,
    }
}
