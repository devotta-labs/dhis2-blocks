import i18n from '@dhis2/d2-i18n'
import { IconMore16 } from '@dhis2/ui-icons'
import { useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
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
import type { CellKey, GridColumn, GridRow, GridTable } from '../model/types'
import { useSpreadsheetContext } from '../provider/context'
import type { SpreadsheetContext } from '../provider/context'
import {
    changedBy,
    clearCandidates,
    columnCandidates,
    openKeyOf,
    planBulk,
    rowCandidates,
    skippedClause,
} from './bulk'
import type { BulkCandidate, BulkPlan } from './bulk'
import { ColumnPopover } from './ColumnPopover'
import type { ColumnTarget } from './ColumnPopover'
import { reasonOf, typedHere } from './navGrid'
import { BORDER_CLASS } from './RowHeader'

/** What the grid's one menu is open for: a row's button, a column's button, or a cell's context menu (both). */
export interface BulkTarget {
    anchor: HTMLElement
    table: GridTable
    row?: GridRow
    column?: GridColumn
}

/**
 * The sticky last column holding each row's button; the scroll region's end padding is as wide. Its line is on the side
 * facing the data, as the row header's is, so the cells scrolling under it keep a divider.
 */
export const ACTIONS_CLASS =
    'sticky end-0 z-10 w-9 min-w-9 border-s border-e-0 p-0 text-center'

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

/** Ctrl+Shift+\\ (Cmd+Shift+\\ on Apple keyboards), Google Sheets' key for a cell's menu, by its place on any layout. */
export const opensMenu = (event: KeyboardEvent) =>
    event.code === 'Backslash' &&
    event.shiftKey &&
    !event.altKey &&
    (/Mac|iPhone|iPad/.test(navigator.platform)
        ? event.metaKey && !event.ctrlKey
        : event.ctrlKey && !event.metaKey)

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
    run(): void
    anchor: HTMLElement
    ask: NonNullable<ReturnType<NonNullable<SpreadsheetContext['confirmBulk']>>>
}

/** What `useBulkConfirm` hands the grid: `ask` to call, `dialog` to render. */
export interface BulkConfirm {
    ask(
        keys: ReadonlyArray<CellKey>,
        anchor: HTMLElement,
        run: () => void
    ): void
    dialog: ReactNode
}

/**
 * Asks the provider's `confirmBulk` before a bulk write: `ask` runs `run` at once when it has no answer, else opens
 * the `dialog` and runs it on Confirm. Focus goes back to `anchor` when the dialog closes.
 */
export const useBulkConfirm = (): BulkConfirm => {
    const { confirmBulk } = useSpreadsheetContext()
    const [pending, setPending] = useState<Pending>()
    return {
        ask: (keys, anchor, run) => {
            const ask = confirmBulk?.(keys)
            if (ask === undefined) {
                run()
            } else {
                setPending({ run, anchor, ask })
            }
        },
        dialog:
            pending === undefined ? null : (
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
                                    pending.run()
                                }}
                            >
                                {pending.ask.confirm}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            ),
    }
}

/**
 * The grid's one menu of row and column actions, at `target`'s anchor. A write is one `commitMany`, so one undo step,
 * run as `changeHere` runs a paste; it plans again when `ask` confirms, since the cells may have changed meanwhile.
 */
export const BulkMenu = ({
    target,
    open,
    onClose,
    changeHere,
    ask,
}: {
    target: BulkTarget | undefined
    open: boolean
    onClose(): void
    changeHere(target: EventTarget, change: () => void): void
    ask: BulkConfirm['ask']
}) => {
    const context = useSpreadsheetContext()
    const { store, effects, overrides, keyOf, settings, announce, bulkColumn } =
        context
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
                const { key } = entries[i]
                if (result === 'invalid') {
                    // The planner skips what the store refuses; a refusal it missed leaves no draft behind.
                    skip(
                        after.cells[key]?.error ??
                            i18n.t('This cell cannot be changed')
                    )
                    after.discardDraft(key)
                    return
                }
                // An unchanged cell the plan left in was refused by the store, as a lock the annotations do not show.
                if (changedBy(result, before.cells[key], after.cells[key])) {
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
    /** Asks about the plan's cells, then plans again and writes it. */
    const confirm = (replan: () => BulkPlan, anchor: HTMLElement) =>
        ask(
            replan().entries.map(({ key }) => key),
            anchor,
            () => apply(replan(), anchor)
        )

    const columnPlan = (
        { table, column }: ColumnTarget,
        text: string,
        overwrite: boolean
    ) => planIn(table, columnCandidates(table, column, text, keyOf), overwrite)

    // The popover outlives the menu that opened it.
    const after = (
        <>
            {valueFor === undefined ? null : (
                <ColumnPopover
                    target={valueFor}
                    open={valueFor.open}
                    onClose={() =>
                        setValueFor((open) => open && { ...open, open: false })
                    }
                    plan={(text, overwrite) =>
                        columnPlan(valueFor, text, overwrite)
                    }
                    onApply={(text, overwrite) => {
                        setValueFor({ ...valueFor, open: false })
                        confirm(
                            () => columnPlan(valueFor, text, overwrite),
                            valueFor.anchor
                        )
                    }}
                />
            )}
        </>
    )

    if (target === undefined) {
        return after
    }
    const { anchor, table, row, column } = target
    const run = (candidates: () => BulkCandidate[], overwrite: boolean) =>
        confirm(() => planIn(table, candidates(), overwrite), anchor)
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
                                                () =>
                                                    rowCandidates(
                                                        columns,
                                                        row,
                                                        below.slice(0, 1),
                                                        keyOf,
                                                        store.getState(),
                                                        effects.getState(),
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
                                                () =>
                                                    rowCandidates(
                                                        columns,
                                                        row,
                                                        below,
                                                        keyOf,
                                                        store.getState(),
                                                        effects.getState(),
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
                                        () =>
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
                            {!typedHere(
                                store.getState(),
                                openKeyOf(table, column, keyOf),
                                overrides
                            ) ? null : (
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
                            )}
                            <DropdownMenuItem
                                onClick={() =>
                                    run(
                                        () =>
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
            {after}
        </>
    )
}
