import i18n from '@dhis2/d2-i18n'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { typedText } from '@/components/dhis2-value-types'
import { Button } from '@/components/dhis2/ui/button'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import { Label } from '@/components/dhis2/ui/label'
import { Popover, PopoverContent } from '@/components/dhis2/ui/popover'
import { Cell } from '../cells/Cell'
import { cellDomId } from '../cells/cellProps'
import { formatCount } from '../cells/OptionCell'
import { typingIn } from '../cells/useCellMode'
import type { AnnotationsState } from '../model/annotations'
import { cellKey } from '../model/types'
import type { GridColumn, GridTable } from '../model/types'
import {
    SpreadsheetReactContext,
    useSpreadsheetContext,
} from '../provider/context'
import { createCellStore } from '../store/store'
import { openKeyOf, skippedClause } from './bulk'
import type { BulkPlan } from './bulk'
import { columnHeaderIds } from './headers'
import { fieldAt } from './navGrid'

/** The column a value popover is for, and what opened its menu, where focus goes back when it closes. */
export interface ColumnTarget {
    anchor: HTMLElement
    table: GridTable
    column: GridColumn
}

// The popover's cell writes to a scratch store, so no rule says anything about it.
const NO_ANNOTATIONS = createStore<AnnotationsState>()(() => ({
    cells: {},
    rowMessages: new Map(),
    rowNotes: new Map(),
}))
const stay = () => {}

const previewOf = ({ entries, filled, skipped }: BulkPlan) =>
    `${i18n.t('Changes {{cells}} cells.', {
        cells: formatCount(entries.length),
    })}${
        filled === 0
            ? ''
            : ` ${i18n.t('{{filled}} already have a value.', {
                  filled: formatCount(filled),
              })}`
    }${skippedClause(skipped)}`

/** The column's header ids for its cells' names, and the leaf header's own. */
const headersOf = (idScope: string, table: GridTable, column: GridColumn) => {
    const labelledBy = columnHeaderIds(idScope, table)[
        table.columns.indexOf(column)
    ]
    return { labelledBy, leaf: labelledBy.split(' ').at(-1) ?? '' }
}

/** The column's control on a one-cell scratch store, the overwrite choice, the preview, Apply and Cancel. */
const ColumnValue = ({
    table,
    column,
    scope,
    plan,
    onApply,
    onCancel,
}: Pick<ColumnTarget, 'table' | 'column'> & {
    scope: string
    plan(text: string, overwrite: boolean): BulkPlan
    onApply(plan: BulkPlan): void
    onCancel(): void
}) => {
    const context = useSpreadsheetContext()
    const { store, keyOf, idScope, settings, announce } = context
    const key = cellKey('bulk', column.id)
    // The column's one field, from an open cell; `takesColumnActions` makes sure it has one.
    const [{ field, scratch }] = useState(() => {
        const state = store.getState()
        const source = openKeyOf(table, column, keyOf)
        const fieldId = state.fieldIdOf(source)
        const shared = fieldAt(state, source)
        return {
            field: shared,
            scratch: createCellStore({
                fields: new Map([[fieldId, shared]]),
                fieldIdOf: () => fieldId,
                values: new Map(),
                settings,
                enqueue: () => {},
            }),
        }
    })
    // The composer's overrides, engine and names still apply; the grid's one live region stays the only one.
    const scoped = useMemo(
        () => ({
            ...context,
            store: scratch,
            effects: NO_ANNOTATIONS,
            idScope: scope,
        }),
        [context, scratch, scope]
    )
    // A refused value is said aloud, once per text, as the grid says one in its cells.
    useEffect(
        () =>
            scratch.subscribe((state, before) => {
                const now = state.cells[key]
                const was = before.cells[key]
                if (
                    now?.error !== undefined &&
                    now !== was &&
                    now.draft !== was?.draft
                ) {
                    announce(now.error)
                }
            }),
        [scratch, key, announce]
    )
    const cell = useStore(scratch, (state) => state.cells[key])
    const [overwrite, setOverwrite] = useState(false)
    const text =
        cell?.value === undefined || cell.error !== undefined
            ? undefined
            : typedText(field, cell.value, settings)
    const planned = text === undefined ? undefined : plan(text, overwrite)
    const previewId = useId()
    return (
        <>
            <div className="h-9 rounded-dhis2-sm border border-dhis2-grey-300">
                <SpreadsheetReactContext.Provider value={scoped}>
                    <Cell
                        cellKey={key}
                        field={field}
                        labelledBy={
                            headersOf(idScope, table, column).labelledBy
                        }
                        move={stay}
                    />
                </SpreadsheetReactContext.Provider>
            </div>
            <Label className="cursor-pointer">
                <Checkbox
                    checked={overwrite}
                    onCheckedChange={(checked) => setOverwrite(checked)}
                />
                {i18n.t('Overwrite existing values')}
            </Label>
            {planned === undefined ? null : (
                <p id={previewId} className="text-dhis2-grey-700">
                    {previewOf(planned)}
                </p>
            )}
            <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={onCancel}>
                    {i18n.t('Cancel')}
                </Button>
                <Button
                    disabled={text === undefined}
                    aria-describedby={
                        planned === undefined ? undefined : previewId
                    }
                    onClick={() => {
                        if (text !== undefined) {
                            onApply(plan(text, overwrite))
                        }
                    }}
                >
                    {i18n.t('Apply')}
                </Button>
            </div>
        </>
    )
}

/**
 * The grid's one popover for a value to apply to a whole column, under the column's header. Focus goes into the
 * control when it opens and back to what opened the menu when it closes; Apply hands over the plan for the cells.
 */
export const ColumnPopover = ({
    target,
    open,
    onClose,
    plan,
    onApply,
}: {
    target: ColumnTarget
    open: boolean
    onClose(): void
    plan(text: string, overwrite: boolean): BulkPlan
    onApply(plan: BulkPlan): void
}) => {
    const { idScope } = useSpreadsheetContext()
    const { anchor, table, column } = target
    const scope = `${idScope}-bulk`
    const { leaf } = headersOf(idScope, table, column)
    // Whether focus goes back to what opened the menu: after Escape, Cancel or Apply, not after a press or focus elsewhere.
    const restore = useRef(false)
    const closeHere = () => {
        restore.current = true
        onClose()
    }
    return (
        <Popover
            open={open}
            onOpenChange={(next, { reason, event }) => {
                // Escape while typing puts the cell's value back; the popover stays.
                if (
                    !next &&
                    !(
                        reason === 'escape-key' &&
                        event.target instanceof HTMLElement &&
                        typingIn(event.target)
                    )
                ) {
                    restore.current = reason === 'escape-key'
                    onClose()
                }
            }}
        >
            <PopoverContent
                anchor={() =>
                    document.getElementById(leaf)?.closest('th') ?? anchor
                }
                align="start"
                aria-labelledby={leaf}
                initialFocus={() =>
                    document.getElementById(
                        cellDomId(scope, cellKey('bulk', column.id))
                    )
                }
                finalFocus={() => restore.current && anchor}
            >
                <ColumnValue
                    key={`${table.id} ${column.id}`}
                    table={table}
                    column={column}
                    scope={scope}
                    plan={plan}
                    onApply={(planned) => {
                        restore.current = true
                        onApply(planned)
                    }}
                    onCancel={closeHere}
                />
            </PopoverContent>
        </Popover>
    )
}
