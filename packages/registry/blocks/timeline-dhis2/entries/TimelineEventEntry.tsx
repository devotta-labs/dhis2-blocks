import i18n from '@dhis2/d2-i18n'
import React, {
    createContext,
    useContext,
    useId,
    useState,
    type ComponentPropsWithoutRef,
    type ReactNode,
} from 'react'
import { Badge } from '@/components/dhis2/ui/badge'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import {
    formatCalendarDate,
    storedDay,
    storedTime,
} from '@/components/dhis2-value-display/calendar'
import { formatDhis2Value } from '@/components/dhis2-value-display/formatDhis2Value'
import type { TimelineEntry } from '@/components/timeline/core/types'
import { useTimelineMeta } from '@/components/timeline/ui/TimelineContext'
import type { DerivedEventStatus } from '../eventStatus'
import type { Note } from '../schemas'
import type { EventEntryData } from '../types'
import { useEventChangelog } from '../useEventChangelog'
import { TimelineSaves } from './TimelineChangeEntry'

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

/** The name of the event's program, for a history across programs. */
export const TimelineEventProgram = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'span'>) => {
    const { data } = useTimelineEventEntry()
    return (
        <span
            {...props}
            data-slot="timeline-event-program"
            className={cn('text-sm text-dhis2-grey-700', className)}
        >
            {data.program?.name ?? data.event.program}
        </span>
    )
}

/** The name of the event's program stage; its id when the stage is unknown. */
export const TimelineEventStage = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'span'>) => {
    const { data } = useTimelineEventEntry()
    // A skipped event is muted by the frame's data-status: lighter, still readable.
    return (
        <span
            {...props}
            data-slot="timeline-event-stage"
            className={cn(
                'text-sm font-medium text-dhis2-grey-900 group-data-[status=skipped]/event:font-normal group-data-[status=skipped]/event:text-dhis2-grey-700',
                className
            )}
        >
            {data.stage?.name ?? data.event.programStage}
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
export const TimelineEventStatus = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'span'>) => {
    const { data } = useTimelineEventEntry()
    const { calendar, locale } = useTimelineMeta()
    const { event, status, stage } = data
    const showsDue = status === 'scheduled' || status === 'overdue'
    const day =
        showsDue && !stage?.hideDueDate && event.scheduledAt !== undefined
            ? storedDay(event.scheduledAt)
            : undefined
    return (
        <span
            {...props}
            data-slot="timeline-event-status"
            data-status={status}
            className={cn(
                'flex flex-wrap items-center gap-x-2 gap-y-1',
                className
            )}
        >
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

/** The org unit's name; its id when the name couldn't be read. */
export const TimelineEventOrgUnit = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'span'>) => {
    const { data } = useTimelineEventEntry()
    const { orgUnit } = data.event
    if (orgUnit === undefined) {
        return null
    }
    return (
        <span
            {...props}
            data-slot="timeline-event-org-unit"
            className={cn('text-sm text-dhis2-grey-700', className)}
        >
            {data.orgUnitName ?? orgUnit}
        </span>
    )
}

/** Who completed the event, when it was completed. */
export const TimelineEventCompletedBy = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'span'>) => {
    const { completedBy } = useTimelineEventEntry().data.event
    if (completedBy === undefined) {
        return null
    }
    return (
        <span
            {...props}
            data-slot="timeline-event-completed-by"
            className={cn('text-sm text-dhis2-grey-700', className)}
        >
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
    className,
    ...props
}: ComponentPropsWithoutRef<'div'> & {
    dataElementIds?: readonly string[]
}) => {
    const { event, stage, orgUnitNames } = useTimelineEventEntry().data
    const { calendar, locale } = useTimelineMeta()
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
        <div
            {...props}
            data-slot="timeline-event-values"
            className={cn('flex flex-col items-start gap-1', className)}
        >
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                {values.slice(0, MAX_VALUES).map(({ id, name, text }) => (
                    <React.Fragment key={id}>
                        <dt className="text-dhis2-grey-700">{name}</dt>
                        <dd className="m-0 text-dhis2-grey-900 group-data-[status=skipped]/event:text-dhis2-grey-700">
                            {text}
                        </dd>
                    </React.Fragment>
                ))}
            </dl>
            {hidden > 0 ? (
                <span className="text-sm text-dhis2-grey-700">
                    {i18n.t('+{{count}} more', { count: hidden })}
                </span>
            ) : null}
        </div>
    )
}

const EventNote = ({ note }: { note: Note }) => {
    const author = note.createdBy?.displayName ?? note.storedBy
    const time =
        note.storedAt === undefined ? undefined : storedTime(note.storedAt)
    return (
        <li className="text-dhis2-grey-900">
            <span className="whitespace-pre-wrap">{note.value}</span>
            {author === undefined ? null : (
                <span className="text-dhis2-grey-700"> {author}</span>
            )}
            {time === undefined || note.storedAt === undefined ? null : (
                <time dateTime={note.storedAt} className="text-dhis2-grey-700">
                    {' '}
                    {time}
                </time>
            )}
        </li>
    )
}

/** The event's notes: a count that expands them. */
export const TimelineEventNotes = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'div'>) => {
    const { notes } = useTimelineEventEntry().data.event
    const [open, setOpen] = useState(false)
    const listId = useId()
    if (notes.length === 0) {
        return null
    }
    return (
        <div
            {...props}
            data-slot="timeline-event-notes"
            className={cn('flex flex-col items-start gap-1', className)}
        >
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
                            <EventNote key={note.note} note={note} />
                        ))}
                    </ul>
                ) : null}
            </div>
        </div>
    )
}

const ChangesBody = ({ entry }: { entry: TimelineEntry<EventEntryData> }) => {
    const { status, saves, truncated } = useEventChangelog(
        entry.data.event.event,
        { enabled: true, stage: entry.data.stage }
    )
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
            return saves.length === 0 ? (
                <p className="m-0 text-sm text-dhis2-grey-700">
                    {i18n.t('No changes')}
                </p>
            ) : (
                <>
                    <TimelineSaves saves={saves} />
                    {truncated ? (
                        <p className="m-0 mt-2 text-sm text-dhis2-grey-700">
                            {i18n.t("Older changes aren't shown.")}
                        </p>
                    ) : null}
                </>
            )
    }
}

/**
 * "Show changes": fetches the event's changelog when the user opens it, and
 * lists the saves. The one part that fetches; render `TimelineSaves` with
 * saves you fetched yourself to avoid it.
 */
export const TimelineEventChanges = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'div'>) => {
    const entry = useTimelineEventEntry()
    const [open, setOpen] = useState(false)
    const bodyId = useId()
    return (
        <div
            {...props}
            data-slot="timeline-event-changes"
            className={cn('flex flex-col items-start gap-1', className)}
        >
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
                {open ? <ChangesBody entry={entry} /> : null}
            </div>
        </div>
    )
}

/**
 * One event: shares the entry with the parts composed inside it and with the
 * host's own children through `useTimelineEventEntry()`. Children default to
 * the standard composition; pass your own to recompose it, or `actions` to
 * add host actions (such as an "Open" link) after it.
 */
export const TimelineEventEntry = ({
    entry,
    actions,
    className,
    children,
    ...props
}: ComponentPropsWithoutRef<'div'> & {
    entry: TimelineEntry<EventEntryData>
    actions?: ReactNode
}) => (
    <TimelineEventContext.Provider value={entry}>
        <div
            {...props}
            data-slot="timeline-event"
            data-status={entry.data.status}
            className={cn(
                'group/event flex flex-col items-start gap-1 data-[status=skipped]:text-dhis2-grey-700',
                className
            )}
        >
            {children ?? (
                <>
                    <span className="flex flex-wrap items-baseline gap-x-2">
                        <TimelineEventStage />
                        <TimelineEventProgram />
                    </span>
                    <TimelineEventStatus />
                    <TimelineEventOrgUnit />
                    <TimelineEventCompletedBy />
                    <TimelineEventValues />
                    <TimelineEventNotes />
                    <TimelineEventChanges />
                </>
            )}
            {actions}
        </div>
    </TimelineEventContext.Provider>
)
