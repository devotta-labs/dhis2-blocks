import i18n from '@dhis2/d2-i18n'
import React, { createContext, useContext, useId, useState } from 'react'
import { Badge } from '@/registry/dhis2/ui/badge'
import { Button } from '@/registry/dhis2/ui/button'
import { cn } from '@/registry/dhis2/ui/cn'
import {
    formatCalendarDate,
    storedDay,
} from '@/registry/dhis2/value-display/calendar'
import { formatDhis2Value } from '@/registry/dhis2/value-display/formatDhis2Value'
import type { TimelineEntry } from '../../core/types'
import { useTimelineMeta } from '../../ui/TimelineContext'
import { TimelineItem } from '../../ui/TimelineParts'
import type { DerivedEventStatus } from '../eventStatus'
import { useTimelineDhis2 } from '../TimelineDhis2Provider'
import type { EventEntryData } from '../toEventEntry'
import { useEventChangelog } from '../useEventChangelog'
import {
    TimelineChangeEntry,
    TimelineChangeList,
    TimelineChangeSummary,
} from './TimelineChangeEntry'

const TimelineEventContext =
    createContext<TimelineEntry<EventEntryData> | null>(null)

/** The event entry the surrounding `TimelineEventEntry` shows. */
export const useTimelineEventEntry = (): TimelineEntry<EventEntryData> => {
    const entry = useContext(TimelineEventContext)
    if (entry === null) {
        throw new Error(
            'useTimelineEventEntry must be used within TimelineEventEntry.'
        )
    }
    return entry
}

/**
 * One event in the feed: a `TimelineItem` that shares the entry with the parts
 * composed inside it (`TimelineEventStage`, `TimelineEventStatus`, …) and with
 * the host's own children through `useTimelineEventEntry()`.
 */
export const TimelineEventEntry = ({
    entry,
    children,
}: {
    entry: TimelineEntry<EventEntryData>
    children: React.ReactNode
}) => (
    <TimelineEventContext.Provider value={entry}>
        <TimelineItem entry={entry}>
            <div
                data-slot="event-entry"
                data-status={entry.data.status}
                className="flex flex-col items-start gap-1"
            >
                {children}
            </div>
        </TimelineItem>
    </TimelineEventContext.Provider>
)

/** The name of the event's program stage. */
export const TimelineEventStage = () => {
    const { data } = useTimelineEventEntry()
    const { stages, status } = useTimelineDhis2()
    const stage = stages.get(data.event.programStage)
    if (stage === undefined && status === 'loading') {
        return null
    }
    // A skipped event is muted: lighter weight and grey, still readable.
    return (
        <span
            className={cn(
                'text-sm',
                data.status === 'skipped'
                    ? 'text-dhis2-grey-700'
                    : 'font-medium text-dhis2-grey-900'
            )}
        >
            {stage?.name ?? data.event.programStage}
        </span>
    )
}

const statusLabel = (status: DerivedEventStatus): string => {
    switch (status) {
        case 'completed':
            return i18n.t('Completed')
        case 'active':
            return i18n.t('Active')
        case 'scheduled':
            return i18n.t('Scheduled')
        case 'overdue':
            return i18n.t('Overdue')
        case 'skipped':
            return i18n.t('Skipped')
    }
}

const STATUS_STYLE = {
    completed: 'bg-dhis2-green-100 text-dhis2-green-900',
    active: 'bg-dhis2-blue-100 text-dhis2-blue-900',
    scheduled: 'bg-dhis2-grey-200 text-dhis2-grey-900',
    overdue: 'bg-dhis2-red-100 text-dhis2-red-900',
    skipped: 'bg-dhis2-grey-200 text-dhis2-grey-800',
} satisfies Record<DerivedEventStatus, string>

/**
 * The status badge. A scheduled or overdue event also shows its due date,
 * unless its stage hides due dates.
 */
export const TimelineEventStatus = () => {
    const { data } = useTimelineEventEntry()
    const { stages } = useTimelineDhis2()
    const calendar = useTimelineMeta((meta) => meta.calendar)
    const locale = useTimelineMeta((meta) => meta.locale)
    const { event, status } = data
    const showsDue = status === 'scheduled' || status === 'overdue'
    const hidden = stages.get(event.programStage)?.hideDueDate ?? false
    const day =
        showsDue && !hidden && event.scheduledAt !== undefined
            ? storedDay(event.scheduledAt)
            : undefined
    return (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge className={STATUS_STYLE[status]}>
                {statusLabel(status)}
            </Badge>
            {day === undefined ? null : (
                <span className="text-sm text-dhis2-grey-700">
                    {i18n.t('Due {{date}}', {
                        date: formatCalendarDate(day, calendar, locale),
                    })}
                </span>
            )}
        </span>
    )
}

/** The org unit's name; its id until the name arrives. */
export const TimelineEventOrgUnit = () => {
    const { orgUnit } = useTimelineEventEntry().data.event
    const { orgUnitNames } = useTimelineDhis2()
    if (orgUnit === undefined) {
        return null
    }
    return (
        <span className="text-sm text-dhis2-grey-700">
            {orgUnitNames.get(orgUnit) ?? orgUnit}
        </span>
    )
}

/** Who completed the event, when it was completed. */
export const TimelineEventCompletedBy = () => {
    const { completedBy } = useTimelineEventEntry().data.event
    if (completedBy === undefined) {
        return null
    }
    return (
        <span className="text-sm text-dhis2-grey-700">
            {i18n.t('Completed by {{name}}', { name: completedBy })}
        </span>
    )
}

const MAX_VALUES = 5

/**
 * Up to 5 key data values. The host's `dataElementIds` win; otherwise the
 * stage's `displayInReports` elements; a stage that flags none shows none.
 */
export const TimelineEventValues = ({
    dataElementIds,
}: {
    dataElementIds?: readonly string[]
}) => {
    const { event } = useTimelineEventEntry().data
    const { stages, orgUnitNames } = useTimelineDhis2()
    const calendar = useTimelineMeta((meta) => meta.calendar)
    const locale = useTimelineMeta((meta) => meta.locale)
    const stage = stages.get(event.programStage)
    if (stage === undefined) {
        return null
    }
    const ids = dataElementIds ?? stage.reportDataElementIds
    const values = ids.flatMap((id) => {
        const info = stage.dataElements.get(id)
        const value = event.dataValues.find((v) => v.dataElement === id)?.value
        if (info === undefined || value === undefined) {
            return []
        }
        const text = formatDhis2Value(value, info.meta, {
            calendar,
            locale,
            orgUnitNames,
        })
        return text === '' ? [] : [{ id, name: info.name, text }]
    })
    if (values.length === 0) {
        return null
    }
    const hidden = values.length - MAX_VALUES
    return (
        <>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                {values.slice(0, MAX_VALUES).map(({ id, name, text }) => (
                    <React.Fragment key={id}>
                        <dt className="text-dhis2-grey-700">{name}</dt>
                        <dd className="m-0 text-dhis2-grey-900">{text}</dd>
                    </React.Fragment>
                ))}
            </dl>
            {hidden > 0 ? (
                <span className="text-sm text-dhis2-grey-700">
                    {i18n.t('+{{count}} more', { count: hidden })}
                </span>
            ) : null}
        </>
    )
}

/** The event's notes: a count that expands them. */
export const TimelineEventNotes = () => {
    const { notes } = useTimelineEventEntry().data.event
    const [open, setOpen] = useState(false)
    const listId = useId()
    if (notes.length === 0) {
        return null
    }
    return (
        <div className="flex flex-col items-start gap-1">
            <Button
                type="button"
                variant="link"
                size="sm"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => setOpen(!open)}
            >
                {notes.length === 1
                    ? i18n.t('{{count}} note', { count: notes.length })
                    : i18n.t('{{count}} notes', { count: notes.length })}
            </Button>
            <div id={listId} hidden={!open}>
                {open ? (
                    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                        {notes.map((note) => (
                            <li key={note.note} className="text-dhis2-grey-900">
                                <span className="whitespace-pre-wrap">
                                    {note.value}
                                </span>
                                {note.storedBy === undefined ? null : (
                                    <span className="text-dhis2-grey-700">
                                        {' '}
                                        {note.createdBy?.displayName ??
                                            note.storedBy}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
        </div>
    )
}

const ChangesBody = ({ event }: { event: string }) => {
    const { status, groups } = useEventChangelog(event, { enabled: true })
    switch (status) {
        case 'idle':
        case 'loading':
            return (
                <p role="status" className="m-0 text-sm text-dhis2-grey-700">
                    {i18n.t('Loading changes')}
                </p>
            )
        case 'unsupported':
            return (
                <p role="status" className="m-0 text-sm text-dhis2-grey-700">
                    {i18n.t("Changes aren't available on this DHIS2 version.")}
                </p>
            )
        case 'error':
            return (
                <p role="alert" className="m-0 text-sm text-dhis2-red-700">
                    {i18n.t("Couldn't load changes.")}
                </p>
            )
        case 'success':
            return groups.length === 0 ? (
                <p className="m-0 text-sm text-dhis2-grey-700">
                    {i18n.t('No changes')}
                </p>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {groups.map((group) => (
                        <li key={group.id}>
                            <TimelineChangeEntry group={group}>
                                <TimelineChangeSummary />
                                <TimelineChangeList />
                            </TimelineChangeEntry>
                        </li>
                    ))}
                </ul>
            )
    }
}

/** "Show changes": fetches the event's changelog when opened and lists the saves. */
export const TimelineEventChanges = () => {
    const { event } = useTimelineEventEntry().data
    const [open, setOpen] = useState(false)
    const bodyId = useId()
    return (
        <div className="flex flex-col items-start gap-1">
            <Button
                type="button"
                variant="link"
                size="sm"
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={() => setOpen(!open)}
            >
                {open ? i18n.t('Hide changes') : i18n.t('Show changes')}
            </Button>
            <div id={bodyId} hidden={!open}>
                {open ? <ChangesBody event={event.event} /> : null}
            </div>
        </div>
    )
}
