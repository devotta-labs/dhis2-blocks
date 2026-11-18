import i18n from '@dhis2/d2-i18n'
import { IconMore16 } from '@dhis2/ui-icons'
import type { Column, RowData } from '@tanstack/react-table'
import { Button } from '@/components/dhis2/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/dhis2/ui/dropdown-menu'
import { Fragment, useRef } from 'react'
import type { DataTableFeatures } from '../features'
import { FILTER_FOCUS_TARGETS, focusAfterRemoval } from '../focusAfterRemoval'
import type { DataTableLayout } from '../types'

type MenuColumn<TData extends RowData> = Column<
    DataTableFeatures,
    TData,
    unknown
>

const sortItems = <TData extends RowData>(column: MenuColumn<TData>) => {
    if (!column.getCanSort()) return []
    return [
        <DropdownMenuItem key="asc" onClick={() => column.toggleSorting(false)}>
            {i18n.t('Sort ascending')}
        </DropdownMenuItem>,
        <DropdownMenuItem key="desc" onClick={() => column.toggleSorting(true)}>
            {i18n.t('Sort descending')}
        </DropdownMenuItem>,
        column.getIsSorted() !== false && (
            <DropdownMenuItem key="clear" onClick={() => column.clearSorting()}>
                {i18n.t('Clear sorting')}
            </DropdownMenuItem>
        ),
    ].filter(Boolean)
}

const pinItems = <TData extends RowData>(
    column: MenuColumn<TData>,
    layout: DataTableLayout
) => {
    if (layout !== 'fixed' || !column.getCanPin()) return []
    const pinned = column.getIsPinned()
    return [
        pinned !== 'start' && (
            <DropdownMenuItem key="start" onClick={() => column.pin('start')}>
                {i18n.t('Pin to start')}
            </DropdownMenuItem>
        ),
        pinned !== 'end' && (
            <DropdownMenuItem key="end" onClick={() => column.pin('end')}>
                {i18n.t('Pin to end')}
            </DropdownMenuItem>
        ),
        pinned !== false && (
            <DropdownMenuItem key="unpin" onClick={() => column.pin(false)}>
                {i18n.t('Unpin')}
            </DropdownMenuItem>
        ),
    ].filter(Boolean)
}

const groupItems = <TData extends RowData>(column: MenuColumn<TData>) => {
    // Grouping is offered only where the column definition opts in.
    if (!column.getCanGroup() || column.columnDef.enableGrouping !== true) {
        return []
    }
    return [
        <DropdownMenuItem key="group" onClick={() => column.toggleGrouping()}>
            {column.getIsGrouped()
                ? i18n.t('Stop grouping')
                : i18n.t('Group by this column')}
        </DropdownMenuItem>,
    ]
}

const hideItems = <TData extends RowData>(
    column: MenuColumn<TData>,
    hide: () => void
) => {
    const ownVisible = column
        .getLeafColumns()
        .filter((leaf) => leaf.getIsVisible()).length
    const allVisible = column.table.getVisibleLeafColumns().length
    if (!column.getCanHide() || allVisible <= ownVisible) return []
    return [
        <DropdownMenuItem key="hide" onClick={hide}>
            {i18n.t('Hide column')}
        </DropdownMenuItem>,
    ]
}

const HEAD = '[data-slot="data-table-head"]'

/**
 * Where focus goes when the header holding `trigger` hides: the menu of the
 * next header that has one, else of the previous; else a sort button in the
 * same order; else the filters.
 */
const targetsAfterHide = (trigger: HTMLElement): readonly string[] => {
    const head = trigger.closest(HEAD)
    const row = head?.parentElement
    if (head === null || row === null || row === undefined) {
        return FILTER_FOCUS_TARGETS
    }
    const heads = Array.from(row.querySelectorAll(`:scope > ${HEAD}`))
    const index = heads.indexOf(head)
    const ids = [...heads.slice(index + 1), ...heads.slice(0, index).reverse()]
        .map((candidate) => candidate.getAttribute('data-column-id'))
        .filter((id) => id !== null)
        .map((id) => `${HEAD}[data-column-id="${CSS.escape(id)}"]`)
    return [
        ...ids.map((id) => `${id} [data-slot="data-table-column-menu"]`),
        ...ids.map((id) => `${id} [data-slot="data-table-sort"]`),
        ...FILTER_FOCUS_TARGETS,
    ]
}

/** The header's "more" menu; renders nothing when no action applies. */
export const ColumnMenu = <TData extends RowData>({
    column,
    label,
    layout,
}: {
    column: MenuColumn<TData>
    label: string
    layout: DataTableLayout
}) => {
    const trigger = useRef<HTMLButtonElement>(null)
    // The trigger leaves with its header; focus goes to a neighbour's.
    const hide = () => {
        const element = trigger.current
        const root =
            element?.closest<HTMLElement>('[data-slot="data-table"]') ?? null
        const targets =
            element === null ? FILTER_FOCUS_TARGETS : targetsAfterHide(element)
        column.toggleVisibility(false)
        focusAfterRemoval(root, targets)
    }
    const sections = [
        { id: 'sort', items: sortItems(column) },
        { id: 'pin', items: pinItems(column, layout) },
        { id: 'group', items: groupItems(column) },
        { id: 'hide', items: hideItems(column, hide) },
    ].filter((section) => section.items.length > 0)
    if (sections.length === 0) return null
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                ref={trigger}
                data-slot="data-table-column-menu"
                aria-label={i18n.t('Options for {{column}}', {
                    column: label,
                })}
                render={<Button variant="ghost" size="icon-sm" />}
            >
                <IconMore16 />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {sections.map((section, index) => (
                    <Fragment key={section.id}>
                        {index > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuGroup>{section.items}</DropdownMenuGroup>
                    </Fragment>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
