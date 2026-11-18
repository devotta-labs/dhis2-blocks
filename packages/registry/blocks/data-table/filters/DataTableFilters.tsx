import i18n from '@dhis2/d2-i18n'
import { IconFilter16 } from '@dhis2/ui-icons'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/dhis2/ui/dropdown-menu'
import { useRef, useState } from 'react'
import {
    FILTER_FOCUS_TARGETS,
    useFocusAfterRemoval,
} from '../focusAfterRemoval'
import { useDataTableInstance } from '../tableHook'
import { FilterChip } from './FilterChip'
import {
    isDataTableFilterValueEmpty,
    parseDataTableFilterValue,
} from './filterValue'
import type { DataTableFilter, DataTableFilterValue } from './types'

export interface DataTableFiltersProps {
    filters: readonly DataTableFilter[]
    className?: string
}

/**
 * Filter chips for `columnFilters`, a "Filter" menu for the filters not
 * shown, and "Clear filters". Entries with other ids are left alone.
 */
export const DataTableFilters = ({
    filters,
    className,
}: DataTableFiltersProps) => {
    const table = useDataTableInstance()
    const columnFilters = table.state.columnFilters
    // Chips added from the menu stay until their popover closes.
    const [added, setAdded] = useState<readonly string[]>([])
    const [openId, setOpenId] = useState<string>()
    const root = useRef<HTMLDivElement>(null)

    const entryOf = (id: string) =>
        columnFilters.find((entry) => entry.id === id)
    const shown = filters.filter(
        (filter) =>
            filter.pinned === true ||
            entryOf(filter.id) !== undefined ||
            added.includes(filter.id)
    )
    const remaining = filters.filter((filter) => !shown.includes(filter))
    const anyActive = filters.some((filter) => entryOf(filter.id) !== undefined)
    // Chips and the "Clear filters" button, which leave with a click; focus
    // moves to the "Filter" button, or the first chip when every filter is
    // shown.
    useFocusAfterRemoval(
        shown.length + (anyActive ? 1 : 0),
        root,
        FILTER_FOCUS_TARGETS
    )

    const write = (id: string, value: DataTableFilterValue | undefined) =>
        table.setColumnFilters((old) => {
            if (value === undefined || isDataTableFilterValueEmpty(value)) {
                return old.filter((entry) => entry.id !== id)
            }
            if (old.some((entry) => entry.id === id)) {
                return old.map((entry) =>
                    entry.id === id ? { id, value } : entry
                )
            }
            return [...old, { id, value }]
        })

    const changeOpen = (id: string, open: boolean) => {
        if (open) {
            setOpenId(id)
            return
        }
        setOpenId((current) => (current === id ? undefined : current))
        setAdded((current) => current.filter((addedId) => addedId !== id))
    }

    return (
        <div
            ref={root}
            data-slot="data-table-filters"
            className={cn('flex flex-wrap items-center gap-2', className)}
        >
            {shown.map((filter) => {
                const entry = entryOf(filter.id)
                return (
                    <FilterChip
                        key={filter.id}
                        filter={filter}
                        active={entry !== undefined}
                        value={
                            entry === undefined
                                ? undefined
                                : parseDataTableFilterValue(entry)
                        }
                        open={openId === filter.id}
                        onOpenChange={(open) => changeOpen(filter.id, open)}
                        onApply={(value) => write(filter.id, value)}
                    />
                )
            })}
            {remaining.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger
                        data-slot="data-table-add-filter"
                        render={<Button variant="secondary" size="sm" />}
                    >
                        <IconFilter16 />
                        {i18n.t('Filter')}
                    </DropdownMenuTrigger>
                    {/* The chosen filter's popover takes focus, so the menu does not hand it back. */}
                    <DropdownMenuContent finalFocus={false}>
                        {remaining.map((filter) => (
                            <DropdownMenuItem
                                key={filter.id}
                                onClick={() => {
                                    setAdded((current) => [
                                        ...current,
                                        filter.id,
                                    ])
                                    setOpenId(filter.id)
                                }}
                            >
                                {filter.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            {anyActive && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-slot="data-table-clear-filters"
                    onClick={() => table.resetColumnFilters(true)}
                >
                    {i18n.t('Clear filters')}
                </Button>
            )}
        </div>
    )
}
