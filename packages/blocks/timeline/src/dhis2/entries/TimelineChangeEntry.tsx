import i18n from '@dhis2/d2-i18n'
import React, { createContext, useContext, useMemo } from 'react'
import {
    formatCalendarDate,
    storedDay,
    storedTime,
} from '@/registry/dhis2/value-display/calendar'
import {
    formatDhis2Value,
    type ValueMeta,
} from '@/registry/dhis2/value-display/formatDhis2Value'
import { useTimelineMeta } from '../../ui/TimelineContext'
import type { ChangeGroup, ChangeRow } from '../changelog'
import { useTimelineDhis2 } from '../TimelineDhis2Provider'

const TimelineChangeContext = createContext<ChangeGroup | null>(null)

/** The save the surrounding `TimelineChangeEntry` shows. */
export const useTimelineChangeEntry = (): ChangeGroup => {
    const group = useContext(TimelineChangeContext)
    if (group === null) {
        throw new Error(
            'useTimelineChangeEntry must be used within TimelineChangeEntry.'
        )
    }
    return group
}

/**
 * One save: the rows a user changed together. Compose it from
 * `TimelineChangeSummary` and `TimelineChangeList`. Inside `TimelineFeed`, wrap
 * it in `TimelineItem` (for valid list markup and load-more focus); it renders
 * no list item of its own so it can also sit inside an event's change list.
 */
export const TimelineChangeEntry = ({
    group,
    children,
}: {
    group: ChangeGroup
    children: React.ReactNode
}) => (
    <TimelineChangeContext.Provider value={group}>
        <div data-slot="change-entry" className="flex flex-col gap-1">
            {children}
        </div>
    </TimelineChangeContext.Provider>
)

/** "Amina Bello changed 3 fields", and when. */
export const TimelineChangeSummary = () => {
    const { user, changes, createdAt } = useTimelineChangeEntry()
    const calendar = useTimelineMeta((meta) => meta.calendar)
    const locale = useTimelineMeta((meta) => meta.locale)
    const day = storedDay(createdAt)
    const time = storedTime(createdAt)
    const when =
        day === undefined
            ? undefined
            : [formatCalendarDate(day, calendar, locale), time].join(' ')
    return (
        <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm text-dhis2-grey-900">
            <span className="font-medium">
                {changes.length === 1
                    ? i18n.t('{{name}} changed {{count}} field', {
                          name: user.displayName,
                          count: changes.length,
                      })
                    : i18n.t('{{name}} changed {{count}} fields', {
                          name: user.displayName,
                          count: changes.length,
                      })}
            </span>
            {when === undefined ? null : (
                <time dateTime={createdAt} className="text-dhis2-grey-700">
                    {when}
                </time>
            )}
        </p>
    )
}

interface FieldInfo {
    name: string
    meta: ValueMeta
}

const UNKNOWN_FIELD: ValueMeta = { valueType: 'TEXT' }

const eventFieldInfo = (id: string): FieldInfo | undefined => {
    switch (id) {
        case 'occurredAt':
            return { name: i18n.t('Event date'), meta: { valueType: 'DATE' } }
        case 'scheduledAt':
            return { name: i18n.t('Due date'), meta: { valueType: 'DATE' } }
        case 'completedAt':
            return {
                name: i18n.t('Completed date'),
                meta: { valueType: 'DATE' },
            }
        case 'geometry':
            return {
                name: i18n.t('Coordinates'),
                meta: { valueType: 'COORDINATE' },
            }
        default:
            return undefined
    }
}

/** Event fields are stored as `2026-06-12 00:00:00.000`: normalise to the `T` form the formatter reads. */
const EVENT_DATE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}).*$/

interface EventFieldValue {
    value: string | undefined
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

const ChangeRowItem = ({ change }: { change: ChangeRow }) => {
    const { stages, attributes, orgUnitNames } = useTimelineDhis2()
    const calendar = useTimelineMeta((meta) => meta.calendar)
    const locale = useTimelineMeta((meta) => meta.locale)
    const { field } = change
    const info = useMemo((): FieldInfo => {
        const known =
            field.kind === 'attribute'
                ? attributes.get(field.id)
                : field.kind === 'dataElement'
                  ? [...stages.values()]
                        .map((stage) => stage.dataElements.get(field.id))
                        .find((element) => element !== undefined)
                  : eventFieldInfo(field.id)
        return known ?? { name: field.id, meta: UNKNOWN_FIELD }
    }, [field.kind, field.id, stages, attributes])
    const show = (stored: string | undefined) => {
        const { value, valueType } =
            field.kind === 'eventField'
                ? eventFieldValue(field.id, stored)
                : { value: stored, valueType: undefined }
        return formatDhis2Value(
            value,
            valueType === undefined ? info.meta : { valueType },
            { calendar, locale, orgUnitNames }
        )
    }
    const before = show(change.previousValue)
    const after = show(change.currentValue)
    return (
        <li className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span
                data-slot="change-field"
                className="font-medium text-dhis2-grey-900"
            >
                {info.name}
            </span>
            <span className="text-dhis2-grey-800">
                <Value text={before} /> → <Value text={after} />
            </span>
        </li>
    )
}

const Value = ({ text }: { text: string }) =>
    text === '' ? (
        <span className="text-dhis2-grey-700 italic">{i18n.t('(empty)')}</span>
    ) : (
        <>{text}</>
    )

/** Each changed field with its value before → after. */
export const TimelineChangeList = () => {
    const { changes } = useTimelineChangeEntry()
    return (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {changes.map((change) => (
                <ChangeRowItem
                    key={`${change.field.kind}:${change.field.id}`}
                    change={change}
                />
            ))}
        </ul>
    )
}
