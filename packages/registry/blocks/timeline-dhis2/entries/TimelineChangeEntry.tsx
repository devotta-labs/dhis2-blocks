import i18n from '@dhis2/d2-i18n'
import React, {
    createContext,
    useContext,
    type ComponentPropsWithoutRef,
} from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import {
    formatCalendarDate,
    storedDay,
    storedTime,
} from '@/components/dhis2-value-display/calendar'
import { formatDhis2Value } from '@/components/dhis2-value-display/formatDhis2Value'
import type { TimelineEntry } from '@/components/timeline/core/types'
import {
    useOptionalTimeline,
    useTimelineMeta,
} from '@/components/timeline/ui/TimelineContext'
import type { ChangeSave, ChangeEntryData, ResolvedChange } from '../types'

const TimelineSaveContext = createContext<ChangeSave | null>(null)

/** Names for org-unit-typed values, from the surrounding `TimelineSaves`. */
const OrgUnitNamesContext = createContext<
    ReadonlyMap<string, string> | undefined
>(undefined)

/** The save the surrounding `TimelineSave` or `TimelineChangeEntry` shows. */
export const useTimelineSave = (): ChangeSave => {
    const save = useContext(TimelineSaveContext)
    if (save === null) {
        throw new Error(
            'useTimelineSave must be used within TimelineSave or TimelineChangeEntry.'
        )
    }
    return save
}

/** A save that only filled in fields: the record being entered, not edited. */
const isEntry = (save: ChangeSave) =>
    save.changes.every((change) => change.type === 'CREATE')

const summaryLabel = (name: string, count: number, entered: boolean) => {
    if (entered) {
        return count === 1
            ? i18n.t('{{name}} entered {{count}} field', { name, count })
            : i18n.t('{{name}} entered {{count}} fields', { name, count })
    }
    return count === 1
        ? i18n.t('{{name}} changed {{count}} field', { name, count })
        : i18n.t('{{name}} changed {{count}} fields', { name, count })
}

/** "Amina Bello changed 3 fields" (or "entered", for a first save), and when. */
export const TimelineChangeSummary = ({
    withDay = true,
    className,
    ...props
}: ComponentPropsWithoutRef<'p'> & {
    /** False under a day heading that already says the day. */
    withDay?: boolean
}) => {
    const save = useTimelineSave()
    const { user, changes, createdAt } = save
    const entered = isEntry(save)
    const { calendar, locale } = useTimelineMeta()
    const day = storedDay(createdAt)
    const time = storedTime(createdAt)
    let when: string | undefined
    if (day !== undefined) {
        when = withDay
            ? [formatCalendarDate(day, calendar, locale), time].join(' ')
            : time
    }
    return (
        <p
            {...props}
            data-slot="timeline-change-summary"
            className={cn(
                'm-0 flex flex-wrap items-baseline gap-x-2 text-sm text-dhis2-grey-900',
                className
            )}
        >
            <span className="font-medium">
                {summaryLabel(user.displayName, changes.length, entered)}
            </span>
            {when === undefined ? null : (
                <time dateTime={createdAt} className="text-dhis2-grey-700">
                    {when}
                </time>
            )}
        </p>
    )
}

/** Event fields are stored as `2026-06-12 00:00:00.000`: normalise to the `T` form the formatter reads. */
const EVENT_DATE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}).*$/

interface EventFieldValue {
    value: string | undefined
    /** Overrides the field's value type, for a date stored with a time. */
    valueType?: string
}

const eventFieldValue = (
    id: string,
    value: string | undefined
): EventFieldValue => {
    const match = value === undefined ? null : EVENT_DATE.exec(value)
    if (value === undefined || match === null || id === 'geometry') {
        return { value }
    }
    // A time of midnight is a date stored as a date-time: show only the day.
    return match[2] === '00:00'
        ? { value: match[1] }
        : { value: `${match[1]}T${match[2]}`, valueType: 'DATETIME' }
}

const Value = ({ text }: { text: string }) =>
    text === '' ? (
        <span className="text-dhis2-grey-700 italic">{i18n.t('(empty)')}</span>
    ) : (
        <>{text}</>
    )

const ChangeRowItem = ({ change }: { change: ResolvedChange }) => {
    const { calendar, locale } = useTimelineMeta()
    const orgUnitNames = useContext(OrgUnitNamesContext)
    const { field } = change
    const show = (stored: string | undefined) => {
        const { value, valueType } =
            field.kind === 'eventField'
                ? eventFieldValue(field.id, stored)
                : { value: stored, valueType: undefined }
        return formatDhis2Value(
            value,
            valueType === undefined ? change.meta : { valueType },
            { calendar, locale, orgUnitNames }
        )
    }
    return (
        <li
            data-slot="timeline-change-row"
            className="flex flex-wrap items-baseline gap-x-2 text-sm"
        >
            <span
                data-slot="timeline-change-field"
                className="font-medium text-dhis2-grey-900"
            >
                {change.name}
            </span>
            <span className="text-dhis2-grey-800">
                {change.type === 'CREATE' ? null : (
                    <>
                        <Value text={show(change.previousValue)} /> →{' '}
                    </>
                )}
                <Value text={show(change.currentValue)} />
            </span>
        </li>
    )
}

/** Each changed field with its value before → after. */
export const TimelineChangeList = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'ul'>) => {
    const { changes } = useTimelineSave()
    return (
        <ul
            {...props}
            data-slot="timeline-change-list"
            className={cn('m-0 flex list-none flex-col gap-0.5 p-0', className)}
        >
            {changes.map((change) => (
                <ChangeRowItem
                    key={`${change.field.kind}:${change.field.id}`}
                    change={change}
                />
            ))}
        </ul>
    )
}

/**
 * One save: the rows a user changed together. Children default to the
 * summary and the list of changes; pass your own to recompose it.
 */
export const TimelineSave = ({
    save,
    className,
    children,
    ...props
}: ComponentPropsWithoutRef<'div'> & { save: ChangeSave }) => (
    <TimelineSaveContext.Provider value={save}>
        <div
            {...props}
            data-slot="timeline-change"
            className={cn('flex flex-col gap-1', className)}
        >
            {children ?? (
                <>
                    <TimelineChangeSummary />
                    <TimelineChangeList />
                </>
            )}
        </div>
    </TimelineSaveContext.Provider>
)

/** An attribute change entry from the history: its save. */
export const TimelineChangeEntry = ({
    entry,
    ...props
}: ComponentPropsWithoutRef<'div'> & {
    entry: TimelineEntry<ChangeEntryData>
}) => {
    const inFeed = useOptionalTimeline() !== null
    return (
        <TimelineSave data-marker="dot" {...props} save={entry.data.save}>
            <TimelineChangeSummary withDay={!inFeed} />
            <TimelineChangeList />
        </TimelineSave>
    )
}

/**
 * A list of saves, newest first, such as an event's changes. A save that
 * entered the record shows only who and when: its values are the record's.
 * `orgUnitNames` names org-unit-typed values; one not in it shows its id.
 */
export const TimelineSaves = ({
    saves,
    orgUnitNames,
    className,
    ...props
}: ComponentPropsWithoutRef<'ul'> & {
    saves: ReadonlyArray<ChangeSave>
    orgUnitNames?: ReadonlyMap<string, string>
}) => (
    <OrgUnitNamesContext.Provider value={orgUnitNames}>
        <ul
            {...props}
            data-slot="timeline-saves"
            className={cn('m-0 flex list-none flex-col gap-2 p-0', className)}
        >
            {saves.map((save) => (
                <li key={save.id}>
                    <TimelineSave save={save}>
                        {isEntry(save) ? <TimelineChangeSummary /> : undefined}
                    </TimelineSave>
                </li>
            ))}
        </ul>
    </OrgUnitNamesContext.Provider>
)
