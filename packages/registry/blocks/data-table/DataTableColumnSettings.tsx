import i18n from '@dhis2/d2-i18n'
import { IconArrowDown16, IconArrowUp16, IconSettings16 } from '@dhis2/ui-icons'
import { Button } from '@/components/dhis2/ui/button'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import { cn } from '@/components/dhis2/ui/cn'
import { Label } from '@/components/dhis2/ui/label'
import {
    Popover,
    PopoverContent,
    PopoverTitle,
    PopoverTrigger,
} from '@/components/dhis2/ui/popover'
import { useLayoutEffect, useRef } from 'react'
import { dataTableColumnLabel } from './columnLabel'
import { useDataTableInstance } from './tableHook'

export interface DataTableColumnSettingsProps {
    className?: string
    /** Button text. Default: "Columns". */
    label?: string
}

// Labels are shown as they are; React escapes them.
const raw = { interpolation: { escapeValue: false } } as const

/** Utility columns that cannot be hidden are not listed and keep their place. */
const utilityIds: readonly string[] = ['select', 'expand', 'actions']

const listed = <TColumn extends { id: string; getCanHide: () => boolean }>(
    group: TColumn[]
) =>
    group.filter(
        (column) => column.getCanHide() || !utilityIds.includes(column.id)
    )

type Direction = 'up' | 'down'

/** Shows, hides and reorders the table's columns. Changes apply at once. */
export const DataTableColumnSettings = ({
    className,
    label,
}: DataTableColumnSettingsProps) => {
    const table = useDataTableInstance()
    const list = useRef<HTMLUListElement>(null)
    // The move button to focus again once the moved row has rendered.
    const moved = useRef<{ id: string; direction: Direction }>(undefined)

    useLayoutEffect(() => {
        const pending = moved.current
        if (pending === undefined) return
        moved.current = undefined
        list.current
            ?.querySelector<HTMLElement>(
                `[data-column-id="${CSS.escape(pending.id)}"] [data-move="${pending.direction}"]`
            )
            ?.focus()
    })

    // Table order. Pinned columns keep their place; the others move among
    // themselves.
    const unpinned = listed(table.getCenterLeafColumns())
    const columns = [
        ...listed(table.getStartLeafColumns()),
        ...unpinned,
        ...listed(table.getEndLeafColumns()),
    ]
    const visibleHideable = columns.filter(
        (column) => column.getCanHide() && column.getIsVisible()
    )

    const move = (index: number, direction: Direction) => {
        const other = unpinned[direction === 'up' ? index - 1 : index + 1]
        const column = unpinned[index]
        if (other === undefined || column === undefined) return
        const ids = table.getAllLeafColumns().map((leaf) => leaf.id)
        const from = ids.indexOf(column.id)
        const to = ids.indexOf(other.id)
        ids[from] = other.id
        ids[to] = column.id
        table.setColumnOrder(ids)
        moved.current = { id: column.id, direction }
    }

    return (
        <Popover>
            <PopoverTrigger
                data-slot="data-table-column-settings"
                className={className}
                render={<Button variant="secondary" size="sm" />}
            >
                <IconSettings16 />
                {label ?? i18n.t('Columns')}
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="w-[min(320px,calc(100vw-32px))] gap-3"
            >
                <PopoverTitle>{i18n.t('Columns')}</PopoverTitle>
                <ul
                    ref={list}
                    className="m-0 flex max-h-80 list-none flex-col gap-1 overflow-y-auto p-0"
                >
                    {columns.map((column) => {
                        const name = dataTableColumnLabel(column)
                        const index = unpinned.indexOf(column)
                        const locked =
                            !column.getCanHide() ||
                            (visibleHideable.length === 1 &&
                                visibleHideable[0]?.id === column.id)
                        return (
                            <li
                                key={column.id}
                                data-slot="data-table-column-setting"
                                data-column-id={column.id}
                                className="flex min-w-0 items-center gap-1"
                            >
                                <Label
                                    className={cn(
                                        'min-w-0 flex-1 cursor-pointer py-1 font-normal',
                                        locked && 'cursor-not-allowed'
                                    )}
                                >
                                    <Checkbox
                                        checked={column.getIsVisible()}
                                        disabled={locked}
                                        onCheckedChange={(checked) =>
                                            column.toggleVisibility(checked)
                                        }
                                    />
                                    <span className="truncate">{name}</span>
                                </Label>
                                {index === -1 ? (
                                    <span className="shrink-0 px-2 text-sm text-dhis2-muted-foreground">
                                        {i18n.t('Pinned')}
                                    </span>
                                ) : (
                                    <>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            data-move="up"
                                            focusableWhenDisabled
                                            disabled={index === 0}
                                            aria-label={i18n.t(
                                                'Move {{column}} up',
                                                { column: name, ...raw }
                                            )}
                                            onClick={() => move(index, 'up')}
                                        >
                                            <IconArrowUp16 />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            data-move="down"
                                            focusableWhenDisabled
                                            disabled={
                                                index === unpinned.length - 1
                                            }
                                            aria-label={i18n.t(
                                                'Move {{column}} down',
                                                { column: name, ...raw }
                                            )}
                                            onClick={() => move(index, 'down')}
                                        >
                                            <IconArrowDown16 />
                                        </Button>
                                    </>
                                )}
                            </li>
                        )
                    })}
                </ul>
                <div className="flex border-t border-dhis2-border pt-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            table.resetColumnVisibility()
                            table.resetColumnOrder()
                        }}
                    >
                        {i18n.t('Reset')}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
