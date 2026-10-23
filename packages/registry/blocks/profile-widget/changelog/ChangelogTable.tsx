import i18n from '@dhis2/d2-i18n'
import { IconArrowRight16 } from '@dhis2/ui-icons'
import React, { type ReactNode } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { Spinner } from '@/components/dhis2/ui/spinner'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/dhis2/ui/table'
import { ProfileWidgetValue } from '../ui/fields'
import type {
    TrackedEntityChangelogEntry,
    TrackedEntityChangelogOrder,
    TrackedEntityChangeType,
} from '../types'

/*
 * Capture's changelog table: Date / User / Data item / Change / Value, with
 * sortable column headers drawn like the working list's (and @dhis2/ui
 * DataTableColumnHeader's) sort buttons.
 */

type SortColumn = TrackedEntityChangelogOrder['column']

const COLUMN_COUNT = 5

/** Unsorted → ascending → descending → unsorted, as DataTable cycles. */
export const nextChangelogOrder = (
    current: TrackedEntityChangelogOrder | null,
    column: SortColumn
): TrackedEntityChangelogOrder | null => {
    if (current?.column !== column) {
        return { column, direction: 'asc' }
    }
    return current.direction === 'asc' ? { column, direction: 'desc' } : null
}

const SortIndicator = ({ direction }: { direction: 'asc' | 'desc' | null }) => (
    <span
        aria-hidden="true"
        data-slot="sort-indicator"
        data-direction={direction ?? 'none'}
        className="ms-0.5 flex size-6 shrink-0 items-center justify-center rounded-dhis2-md group-hover/sort:bg-dhis2-grey-400 group-focus-visible/sort:bg-dhis2-grey-400"
    >
        <svg viewBox="0 0 16 16" className="size-4">
            <polygon
                points="4 9 12 9 8 14"
                className={
                    direction === 'asc'
                        ? 'fill-dhis2-blue-700'
                        : 'fill-dhis2-grey-500'
                }
            />
            <polygon
                points="4 7 12 7 8 2"
                className={
                    direction === 'desc'
                        ? 'fill-dhis2-blue-700'
                        : 'fill-dhis2-grey-500'
                }
            />
        </svg>
    </span>
)

function ColumnHeader({
    column,
    order,
    sortable,
    onOrderChange,
    children,
}: {
    column: SortColumn
    order: TrackedEntityChangelogOrder | null
    sortable: boolean
    onOrderChange: (order: TrackedEntityChangelogOrder | null) => void
    children: ReactNode
}) {
    if (!sortable) {
        return (
            <TableHead scope="col" className="py-1.5 align-middle">
                {children}
            </TableHead>
        )
    }
    const direction = order?.column === column ? order.direction : null
    return (
        <TableHead
            scope="col"
            className="py-1.5 align-middle"
            aria-sort={
                direction === 'asc'
                    ? 'ascending'
                    : direction === 'desc'
                      ? 'descending'
                      : 'none'
            }
        >
            <button
                type="button"
                data-test={`profile-widget-changelog-sort-${column}`}
                className="group/sort flex min-h-6 w-full cursor-pointer items-center border-0 bg-transparent p-0 text-left text-[inherit] [font-weight:inherit] outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dhis2-ring/35"
                onClick={() => onOrderChange(nextChangelogOrder(order, column))}
            >
                {children}
                <SortIndicator direction={direction} />
            </button>
        </TableHead>
    )
}

const changeTags = {
    CREATE: {
        label: () => i18n.t('Created'),
        className: 'bg-dhis2-green-100 text-dhis2-green-900',
    },
    UPDATE: {
        label: () => i18n.t('Updated'),
        className: 'bg-dhis2-blue-100 text-dhis2-blue-900',
    },
    DELETE: {
        label: () => i18n.t('Deleted'),
        className: 'bg-dhis2-red-100 text-dhis2-red-900',
    },
} satisfies Record<
    TrackedEntityChangeType,
    { label: () => string; className: string }
>

/** @dhis2/ui Tag (100 tint, 23px high): positive for created, neutral for updated, negative for deleted. */
const ChangeTag = ({ changeType }: { changeType: TrackedEntityChangeType }) => {
    const tag = changeTags[changeType]
    return (
        <span
            data-slot="profile-widget-changelog-change"
            data-change-type={changeType}
            className={cn(
                'inline-flex h-[23px] max-w-full items-center rounded-[3px] px-1.5 text-[13px] leading-4 whitespace-nowrap',
                tag.className
            )}
        >
            {tag.label()}
        </span>
    )
}

const ChangeValue = ({ entry }: { entry: TrackedEntityChangelogEntry }) => {
    const previous = (
        <span className="min-w-0 wrap-break-word text-dhis2-grey-700">
            <span className="sr-only">{i18n.t('Previous value')}: </span>
            <ProfileWidgetValue value={entry.previousValue} />
        </span>
    )
    const current = (
        <span className="min-w-0 wrap-break-word text-dhis2-grey-900">
            <span className="sr-only">{i18n.t('New value')}: </span>
            <ProfileWidgetValue value={entry.currentValue} />
        </span>
    )

    return (
        <div className="flex flex-row items-center gap-1">
            {entry.changeType !== 'CREATE' && previous}
            {entry.changeType === 'UPDATE' && (
                <span
                    aria-hidden="true"
                    className="flex shrink-0 text-dhis2-grey-700 rtl:rotate-180 [&_svg]:fill-current"
                >
                    <IconArrowRight16 />
                </span>
            )}
            {entry.changeType !== 'DELETE' && current}
        </div>
    )
}

const MessageRow = ({ children }: { children: ReactNode }) => (
    <TableRow>
        <TableCell colSpan={COLUMN_COUNT} className="text-center">
            {children}
        </TableCell>
    </TableRow>
)

export interface ChangelogTableProps {
    entries: readonly TrackedEntityChangelogEntry[] | undefined
    /** True while a newer page, filter or order is loading over `entries`. */
    isFetching: boolean
    order: TrackedEntityChangelogOrder | null
    /** Username and data-item sorting are 2.42+; the date always sorts. */
    canSortByUserAndDataItem: boolean
    onOrderChange: (order: TrackedEntityChangelogOrder | null) => void
}

export function ChangelogTable({
    entries,
    isFetching,
    order,
    canSortByUserAndDataItem,
    onOrderChange,
}: ChangelogTableProps) {
    const headerProps = { order, onOrderChange }

    return (
        <Table
            data-test="profile-widget-changelog-table"
            className="table-fixed"
        >
            <colgroup>
                <col className="w-[150px]" />
                <col className="w-[140px]" />
                <col className="w-[130px]" />
                <col className="w-[96px]" />
                <col />
            </colgroup>
            <TableHeader>
                <TableRow>
                    <ColumnHeader {...headerProps} column="createdAt" sortable>
                        {i18n.t('Date')}
                    </ColumnHeader>
                    <ColumnHeader
                        {...headerProps}
                        column="username"
                        sortable={canSortByUserAndDataItem}
                    >
                        {i18n.t('User')}
                    </ColumnHeader>
                    <ColumnHeader
                        {...headerProps}
                        column="attribute"
                        sortable={canSortByUserAndDataItem}
                    >
                        {i18n.t('Data item')}
                    </ColumnHeader>
                    <TableHead scope="col" className="py-1.5 align-middle">
                        {i18n.t('Change')}
                    </TableHead>
                    <TableHead scope="col" className="py-1.5 align-middle">
                        {i18n.t('Value')}
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody
                aria-busy={isFetching}
                className={cn(
                    entries && isFetching && 'opacity-60 transition-opacity'
                )}
            >
                {entries === undefined ? (
                    <MessageRow>
                        <Spinner
                            className="size-6 border-4 align-middle"
                            aria-label={i18n.t('Loading changelog')}
                        />
                    </MessageRow>
                ) : entries.length === 0 ? (
                    <MessageRow>{i18n.t('No changes to display')}</MessageRow>
                ) : (
                    entries.map((entry) => (
                        <TableRow
                            key={entry.id}
                            data-test="profile-widget-changelog-row"
                        >
                            <TableCell>{entry.createdAtLabel}</TableCell>
                            <TableCell className="wrap-break-word">
                                {entry.user.displayName}
                            </TableCell>
                            <TableCell className="wrap-break-word hyphens-auto">
                                {entry.attributeLabel}
                            </TableCell>
                            <TableCell>
                                <ChangeTag changeType={entry.changeType} />
                            </TableCell>
                            <TableCell>
                                <ChangeValue entry={entry} />
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    )
}
