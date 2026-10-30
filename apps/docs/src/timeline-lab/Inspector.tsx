import type { TimelineEntry } from '@/components/timeline'
import type { HistoryEntryData } from '@/components/timeline-dhis2'
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react'

/** Each part by its data-slot: the component that draws it and where its content comes from. */
const PARTS = new Map(
    Object.entries({
        timeline: {
            part: 'Timeline',
            source: 'The entries array the host passes in',
        },
        'timeline-feed': {
            part: 'TimelineFeed',
            source: 'Groups and the now position, from groupTimeline',
        },
        'timeline-group': {
            part: 'TimelineFeed group',
            source: 'One day (or the groupBy key) of one phase',
        },
        'timeline-group-heading': {
            part: 'TimelineGroupHeading',
            source: "The day of its entries' at, in the system calendar; or Overdue / Undated",
        },
        'timeline-group-entries': {
            part: 'TimelineFeed group list',
            source: "The group's entries, sorted by at",
        },
        'timeline-item': {
            part: 'TimelineItem',
            source: 'One entry: list item, marker and connector',
        },
        'timeline-marker': {
            part: 'TimelineMarker',
            source: "The entry's phase (future grey, overdue red) and its content's data-marker",
        },
        'timeline-connector': {
            part: 'TimelineConnector',
            source: 'Decoration joining entries',
        },
        'timeline-now': {
            part: 'TimelineNow',
            source: "Today, from the timeline's now, in the system calendar",
        },
        'timeline-time': {
            part: 'TimelineTime',
            source: "HH:mm of the entry's at, as stored; none for date-only entries",
        },
        'timeline-event': {
            part: 'TimelineEventEntry',
            source: 'A tracker event (tracker/events)',
        },
        'timeline-event-stage': {
            part: 'TimelineEventStage',
            source: 'Stage name from program metadata; the programStage id if metadata failed',
        },
        'timeline-event-program': {
            part: 'TimelineEventProgram',
            source: 'Program name; only when the history spans programs',
        },
        'timeline-event-status': {
            part: 'TimelineEventStatus',
            source: 'Derived from event.status and scheduledAt vs today; due date from scheduledAt unless the stage hides it',
        },
        badge: {
            part: 'Badge (in TimelineEventStatus)',
            source: 'The derived status: completed, active, scheduled, overdue, skipped',
        },
        'timeline-event-meta': {
            part: 'TimelineEventMeta',
            source: 'The line holding time, org unit and who completed it',
        },
        'timeline-event-org-unit': {
            part: 'TimelineEventOrgUnit',
            source: 'event.orgUnit, named from the org unit lookup; the id if that failed',
        },
        'timeline-event-completed-by': {
            part: 'TimelineEventCompletedBy',
            source: 'event.completedBy',
        },
        'timeline-event-values': {
            part: 'TimelineEventValues',
            source: "event.dataValues for the stage's displayInReports data elements, formatted by value type",
        },
        'timeline-event-actions': {
            part: 'Action row (TimelineEventEntry)',
            source: 'Notes, Show changes, then the host actions',
        },
        'timeline-event-notes': {
            part: 'TimelineEventNotes',
            source: 'event.notes: value, storedBy, storedAt',
        },
        'timeline-event-changes': {
            part: 'TimelineEventChanges',
            source: 'Fetched on press from tracker/events/{uid}/changeLogs',
        },
        'timeline-event-action': {
            part: 'TimelineEventAction',
            source: "A host action (Open) or one of the event's toggles",
        },
        'timeline-saves': {
            part: 'TimelineSaves',
            source: "The event's changelog rows grouped into saves",
        },
        'timeline-change': {
            part: 'TimelineSave',
            source: 'One save: changelog rows sharing createdAt and user',
        },
        'timeline-change-summary': {
            part: 'TimelineChangeSummary',
            source: "The save's user and createdAt",
        },
        'timeline-change-list': {
            part: 'TimelineChangeList',
            source: "The save's changed fields",
        },
        'timeline-change-row': {
            part: 'TimelineChangeList row',
            source: 'One changelog row',
        },
        'timeline-change-field': {
            part: 'TimelineChangeList field',
            source: 'Attribute or data element name from metadata',
        },
        'timeline-change-before': {
            part: 'TimelineChangeList old value',
            source: 'previousValue, formatted by value type',
        },
        'timeline-milestone': {
            part: 'TimelineMilestoneEntry',
            source: 'An enrollment date: enrolled, incident, completed or cancelled',
        },
        'timeline-note': {
            part: 'TimelineNoteEntry',
            source: 'An enrollment note: value, storedBy, storedAt',
        },
        'timeline-note-text': {
            part: 'TimelineNoteEntry text',
            source: 'note.value',
        },
        'timeline-notices': {
            part: 'TimelineNotices',
            source: 'The notices array the host passes in',
        },
        'timeline-notice': {
            part: 'TimelineNotices notice',
            source: 'One notice: a failure, a cap or a missing feature',
        },
        'timeline-empty': {
            part: 'TimelineEmpty',
            source: 'Shown when status is success and entries is empty',
        },
        'timeline-loading': {
            part: 'TimelineLoading',
            source: "Shown while status is 'pending'",
        },
        'timeline-error': {
            part: 'TimelineError',
            source: "Shown when status is 'error'",
        },
        'timeline-show-more': {
            part: 'TimelineShowMore',
            source: "useShowMore's hasMore; reveals entries already in memory",
        },
        'timeline-end': {
            part: 'TimelineEnd',
            source: 'No more to show and the host says the history is complete',
        },
    })
)

/** The stored field that placed an entry on the timeline. */
const placedBy = (entry: TimelineEntry<HistoryEntryData>) => {
    const { data } = entry
    if (data.kind === 'event') {
        return ['scheduled', 'overdue', 'skipped'].includes(data.status)
            ? 'event.scheduledAt'
            : 'event.occurredAt (the timeField)'
    }
    if (data.kind === 'milestone') {
        return {
            enrolled: 'enrollment.enrolledAt',
            incident: 'enrollment.occurredAt',
            completed: 'enrollment.completedAt ?? updatedAt',
            cancelled: 'enrollment.completedAt ?? updatedAt',
        }[data.milestone]
    }
    return data.kind === 'note' ? 'note.storedAt' : 'save.createdAt'
}

/** The label of the row under the pointer in a two-column value list. */
const rowLabel = (target: Element) => {
    const cell = target.closest('dt, dd')
    const label = cell?.tagName === 'DD' ? cell.previousElementSibling : cell
    return label?.textContent ?? undefined
}

interface Hover {
    rect: DOMRect
    slots: string[]
    entry?: TimelineEntry<HistoryEntryData>
    field?: string
    x: number
    y: number
}

/**
 * Hover any part of the timeline inside it to outline it and say which part
 * draws it, the parts around it, and where its content comes from.
 */
export const Inspector = ({
    on,
    entries,
    children,
}: {
    on: boolean
    entries: ReadonlyArray<TimelineEntry<HistoryEntryData>>
    children: ReactNode
}) => {
    const [hover, setHover] = useState<Hover>()
    const byId = useMemo(
        () => new Map(entries.map((entry) => [entry.id, entry])),
        [entries]
    )
    const inspect = (event: MouseEvent<HTMLDivElement>) => {
        if (!(event.target instanceof Element)) {
            return
        }
        const part = event.target.closest('[data-slot]')
        if (part === null || !event.currentTarget.contains(part)) {
            setHover(undefined)
            return
        }
        const slots: string[] = []
        for (
            let node: Element | null = part;
            node !== null && event.currentTarget.contains(node);
            node = node.parentElement?.closest('[data-slot]') ?? null
        ) {
            slots.unshift(node.getAttribute('data-slot') ?? '')
        }
        const entryId =
            event.target
                .closest('[data-timeline-entry]')
                ?.getAttribute('data-timeline-entry') ?? undefined
        setHover({
            rect: part.getBoundingClientRect(),
            slots,
            entry: entryId === undefined ? undefined : byId.get(entryId),
            field: rowLabel(event.target),
            x: event.clientX,
            y: event.clientY,
        })
    }
    const slot = hover?.slots.at(-1) ?? ''
    const known = PARTS.get(slot)
    // Always the same wrapper: switching inspection must not remount the timeline.
    return (
        <div
            onMouseMove={on ? inspect : undefined}
            onMouseLeave={() => setHover(undefined)}
            onWheel={() => setHover(undefined)}
        >
            {children}
            {!on || hover === undefined ? null : (
                <>
                    <div
                        aria-hidden="true"
                        className="pointer-events-none fixed z-40 rounded-sm bg-dhis2-blue-500/10 outline-2 outline-dhis2-blue-700"
                        style={{
                            left: hover.rect.left,
                            top: hover.rect.top,
                            width: hover.rect.width,
                            height: hover.rect.height,
                        }}
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none fixed z-50 flex max-w-sm flex-col gap-1 rounded border border-dhis2-grey-400 bg-white p-2.5 text-xs shadow-lg"
                        style={{
                            left: Math.min(
                                hover.x + 14,
                                window.innerWidth - 400
                            ),
                            top: Math.min(
                                hover.y + 14,
                                window.innerHeight - 180
                            ),
                        }}
                    >
                        <span className="font-mono text-dhis2-grey-600">
                            {hover.slots.join(' › ')}
                        </span>
                        <span className="text-sm font-medium text-dhis2-grey-900">
                            {known?.part ?? slot}
                        </span>
                        {known === undefined ? null : (
                            <span className="text-dhis2-grey-800">
                                {known.source}
                            </span>
                        )}
                        {hover.field === undefined ? null : (
                            <span className="text-dhis2-grey-800">
                                Field: {hover.field}
                            </span>
                        )}
                        {hover.entry === undefined ? null : (
                            <span className="border-t border-dhis2-grey-300 pt-1 font-mono text-dhis2-grey-700">
                                {hover.entry.data.kind} · at {hover.entry.at}
                                {hover.entry.precision === 'day'
                                    ? ' (date only)'
                                    : ''}{' '}
                                · from {placedBy(hover.entry)}
                                {hover.entry.phase === undefined
                                    ? ''
                                    : ` · ${hover.entry.phase}`}
                            </span>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
