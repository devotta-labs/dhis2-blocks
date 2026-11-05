import i18n from '@dhis2/d2-i18n'
import { IconMore16 } from '@dhis2/ui-icons'
import { useState } from 'react'
import { parseTyped } from '@/components/dhis2-value-types'
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/dhis2/ui/alert-dialog'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
} from '@/components/dhis2/ui/dropdown-menu'
import { formatCount } from '../cells/OptionCell'
import type { GridColumn, GridRow, GridTable } from '../model/types'
import { useSpreadsheetContext } from '../provider/context'
import type { SpreadsheetContext } from '../provider/context'
import {
    clearCandidates,
    columnCandidates,
    planBulk,
    rowCandidates,
    skippedClause,
} from './bulk'
import type { BulkCandidate, BulkPlan } from './bulk'
import { ColumnPopover } from './ColumnPopover'
import type { ColumnTarget } from './ColumnPopover'
import { reasonOf } from './navGrid'
import { BORDER_CLASS } from './RowHeader'

/** What the grid's one menu is open for: a row's button, a column's button, or a cell's context menu (both). */
export interface BulkTarget {
    anchor: HTMLElement
    table: GridTable
    row?: GridRow
    column?: GridColumn
}

/** The sticky last column holding each row's button; the scroll region's end padding is as wide. */
export const ACTIONS_CLASS = 'sticky end-0 z-10 w-9 min-w-9 p-0 text-center'

/** Whether the column takes column actions: the provider's `bulkColumn` allows it and its open cells share one field. */
export const takesColumnActions = (
    { bulkColumn, store, keyOf }: SpreadsheetContext,
    table: GridTable,
    column: GridColumn
) => {
    const { fieldOf } = store.getState()
    return (
        bulkColumn?.(column) !== false &&
        new Set(
            table.rows
                .map((row) => keyOf(row, column))
                .filter((key) => !table.closed.has(key))
                .map(fieldOf)
        ).size === 1
    )
}

/** A ⋯ button opening the grid's menu, out of the Tab order, named by its own `label` and the header it is for. */
export const ActionsButton = ({
    id,
    label,
    labelledBy,
    onOpen,
}: {
    id: string
    label: string
    labelledBy: string
    onOpen(anchor: HTMLElement): void
}) => (
    <Button
        id={id}
        variant="ghost"
        size="icon-sm"
        tabIndex={-1}
        aria-haspopup="menu"
        aria-labelledby={`${id} ${labelledBy}`}
        onClick={(event) => onOpen(event.currentTarget)}
    >
        <IconMore16 />
        <span className="sr-only">{label}</span>
    </Button>
)

/** A row's last cell, sticky at the row's end, holding its actions button. */
export const RowActions = ({
    rowHeader,
    onOpen,
}: {
    /** The DOM id of the row's header. */
    rowHeader: string
    onOpen(anchor: HTMLElement): void
}) => (
    <td className={cn(BORDER_CLASS, ACTIONS_CLASS, 'bg-white')}>
        <ActionsButton
            id={`${rowHeader}-actions`}
            label={i18n.t('Row actions')}
            labelledBy={rowHeader}
            onOpen={onOpen}
        />
    </td>
)

/** What a bulk write says: how many cells changed and, when any were skipped, how many and the most common reason. */
const summary = (changed: number, skipped: ReadonlyMap<string, number>) =>
    `${i18n.t('Cells changed: {{cells}}.', {
        nsSeparator: '::',
        cells: formatCount(changed),
    })}${skippedClause(skipped)}`

interface Pending {
    plan: BulkPlan
    anchor: HTMLElement
    ask: NonNullable<ReturnType<NonNullable<SpreadsheetContext['confirmBulk']>>>
}

/**
 * The grid's one menu of row and column actions, at `target`'s anchor, and the dialog asking first when the provider's
 * `confirmBulk` answers. A write is one `commitMany`, so one undo step, run as `changeHere` runs a paste.
 */
export const BulkMenu = ({
    target,
    open,
    onClose,
    changeHere,
}: {
    target: BulkTarget | undefined
    open: boolean
    onClose(): void
    changeHere(target: EventTarget, change: () => void): void
}) => {
    const context = useSpreadsheetContext()
    const {
        store,
        effects,
        overrides,
        keyOf,
        settings,
        announce,
        bulkColumn,
        confirmBulk,
    } = context
    const [pending, setPending] = useState<Pending>()
    // The column value popover, kept after it closes so it closes in place.
    const [valueFor, setValueFor] = useState<ColumnTarget & { open: boolean }>()

    const apply = ({ entries, skipped }: BulkPlan, anchor: HTMLElement) => {
        const counted = new Map(skipped)
        let changed = 0
        const skip = (reason: string) =>
            counted.set(reason, (counted.get(reason) ?? 0) + 1)
        changeHere(anchor, () => {
            const before = store.getState()
            const results = before.commitMany(entries)
            const after = store.getState()
            results.forEach((result, i) => {
                const { key, text } = entries[i]
                if (result === 'invalid') {
                    // The planner skips what the store refuses; a refusal it missed leaves no draft behind.
                    skip(after.cells[key]?.error ?? '')
                    after.discardDraft(key)
                    return
                }
                const was = before.cells[key]
                const now = after.cells[key]
                const field = after.fieldOf(key)
                const parsed =
                    field === undefined
                        ? undefined
                        : parseTyped(field, text, settings)
                // An unchanged cell already held the value, or had only its draft dropped; otherwise the store
                // refused it, as a lock the annotations do not show does.
                if (
                    result === 'queued' ||
                    (was?.draft !== undefined && now?.draft === undefined) ||
                    (parsed?.ok === true && parsed.value === now?.value)
                ) {
                    changed += 1
                } else {
                    skip(i18n.t('This cell cannot be changed'))
                }
            })
        })
        announce(summary(changed, counted))
    }

    const planIn = (
        table: GridTable,
        candidates: BulkCandidate[],
        overwrite: boolean
    ) =>
        planBulk(candidates, overwrite, {
            isEditable: reasonOf(table.closed, store, effects, overrides),
            state: store.getState(),
            annotations: effects.getState(),
            settings,
        })
    /** Writes the plan, or first asks the provider's dialog when `confirmBulk` answers. */
    const confirm = (plan: BulkPlan, anchor: HTMLElement) => {
        const ask = confirmBulk?.(plan.entries.map(({ key }) => key))
        if (ask === undefined) {
            apply(plan, anchor)
        } else {
            setPending({ plan, anchor, ask })
        }
    }

    if (target === undefined) {
        return null
    }
    const { anchor, table, row, column } = target
    const run = (candidates: BulkCandidate[], overwrite: boolean) =>
        confirm(planIn(table, candidates, overwrite), anchor)
    const columns = table.columns.filter((each) => bulkColumn?.(each) !== false)
    const below =
        row === undefined ? [] : table.rows.slice(table.rows.indexOf(row) + 1)
    const both = row !== undefined && column !== undefined
    return (
        <>
            <DropdownMenu
                open={open}
                onOpenChange={(next) => {
                    if (!next) {
                        onClose()
                    }
                }}
            >
                <DropdownMenuContent anchor={anchor} finalFocus={() => anchor}>
                    {row === undefined ? null : (
                        <DropdownMenuGroup>
                            {both ? (
                                <DropdownMenuLabel>
                                    {i18n.t('Row')}
                                </DropdownMenuLabel>
                            ) : null}
                            {below.length === 0 ? null : (
                                <>
                                    <DropdownMenuItem
                                        onClick={() =>
                                            run(
                                                rowCandidates(
                                                    columns,
                                                    row,
                                                    below.slice(0, 1),
                                                    keyOf,
                                                    store.getState(),
                                                    settings
                                                ),
                                                false
                                            )
                                        }
                                    >
                                        {i18n.t('Apply to next row')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() =>
                                            run(
                                                rowCandidates(
                                                    columns,
                                                    row,
                                                    below,
                                                    keyOf,
                                                    store.getState(),
                                                    settings
                                                ),
                                                false
                                            )
                                        }
                                    >
                                        {i18n.t('Apply to all rows below')}
                                    </DropdownMenuItem>
                                </>
                            )}
                            <DropdownMenuItem
                                onClick={() =>
                                    run(
                                        clearCandidates(
                                            columns.map((each) =>
                                                keyOf(row, each)
                                            )
                                        ),
                                        true
                                    )
                                }
                            >
                                {i18n.t('Clear row')}
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    )}
                    {column === undefined ||
                    !takesColumnActions(context, table, column) ? null : (
                        <DropdownMenuGroup>
                            {both ? (
                                <DropdownMenuLabel>
                                    {i18n.t('Column')}
                                </DropdownMenuLabel>
                            ) : null}
                            <DropdownMenuItem
                                onClick={() =>
                                    setValueFor({
                                        anchor,
                                        table,
                                        column,
                                        open: true,
                                    })
                                }
                            >
                                {i18n.t('Apply value to all column cells')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    run(
                                        clearCandidates(
                                            table.rows.map((each) =>
                                                keyOf(each, column)
                                            )
                                        ),
                                        true
                                    )
                                }
                            >
                                {i18n.t('Clear all column cells')}
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            {valueFor === undefined ? null : (
                <ColumnPopover
                    target={valueFor}
                    open={valueFor.open}
                    onClose={() =>
                        setValueFor((open) => open && { ...open, open: false })
                    }
                    plan={(text, overwrite) =>
                        planIn(
                            valueFor.table,
                            columnCandidates(
                                valueFor.table,
                                valueFor.column,
                                text,
                                keyOf
                            ),
                            overwrite
                        )
                    }
                    onApply={(plan) => {
                        setValueFor({ ...valueFor, open: false })
                        confirm(plan, valueFor.anchor)
                    }}
                />
            )}
            {pending === undefined ? null : (
                <AlertDialog
                    open
                    onOpenChange={(next) => {
                        if (!next) {
                            setPending(undefined)
                        }
                    }}
                >
                    {/* Focus goes back to what opened the menu: the menu that opened the dialog is gone. */}
                    <AlertDialogContent finalFocus={() => pending.anchor}>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {pending.ask.title}
                            </AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogDescription>
                            {pending.ask.body}
                        </AlertDialogDescription>
                        <AlertDialogFooter>
                            <AlertDialogCancel>
                                {i18n.t('Cancel')}
                            </AlertDialogCancel>
                            <Button
                                onClick={() => {
                                    setPending(undefined)
                                    apply(pending.plan, pending.anchor)
                                }}
                            >
                                {pending.ask.confirm}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </>
    )
}
