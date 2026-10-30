import i18n from '@dhis2/d2-i18n'
import type { EventsRules, RuleEffects } from '@/components/program-rules'
import { typedText } from '@/components/dhis2-value-types'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { cellDomId } from '../cells/cellProps'
import { typingIn } from '../cells/useCellMode'
import { rowHeaderDomId } from '../grid/headers'
import {
    sameEffects,
    sameMessages,
    sameNotes,
    saysNothing,
    withRow,
} from '../logic/effects'
import type { CellEffects } from '../logic/effects'
import { rowRuleOutcome, ruleRowsOf, stageFields } from '../logic/ruleEffects'
import { cellKey } from '../model/types'
import type { CellKey, CellState, GridRow, GridTable } from '../model/types'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import type { LoadedForm } from '../sources/types'
import { afterPaint } from './afterPaint'
import { rowIdOf } from './formRows'
import type { OpenForm } from './openForm'

// Loading evaluates rows for about this long at once (a row at least), then for about a frame's time whenever the
// browser is idle, so it never blocks the page for long.
const FIRST_SLICE_MS = 100
const IDLE_SLICE_MS = 16
// Rules whose values keep changing each other's rows stop after this many passes; settled rules need two.
const PASSES = 5
// Rule names are shown as DHIS2 gives them, not HTML-escaped.
const AS_IS = { escapeValue: false }
const NONE: ReadonlySet<string> = new Set()
const NO_NOTES: ReadonlyArray<string> = []

/** What one row's rules said, or why they failed; `raw` names the rules behind its values. */
interface RowResult {
    row: GridRow
    table: GridTable
    outcome: ReturnType<typeof rowRuleOutcome> | Error
    raw?: RuleEffects
}

const measured = (name: string, work: () => void) => {
    const start = performance.now()
    work()
    performance.measure(name, { start })
}

/** Runs `work` when the browser is idle; returns how to cancel it. */
const whenIdle = (work: () => void) => {
    if ('requestIdleCallback' in window) {
        const id = requestIdleCallback(work)
        return () => cancelIdleCallback(id)
    }
    const id = setTimeout(work)
    return () => clearTimeout(id)
}

// The rows in view do not wait for the browser to be idle, which it rarely is while it renders the grid.
const soon = (work: () => void) => {
    const id = setTimeout(work)
    return () => clearTimeout(id)
}

const onScreen = (idScope: string, tableId: string, rowId: string) => {
    const box = document
        .getElementById(rowHeaderDomId(idScope, tableId, rowId))
        ?.getBoundingClientRect()
    return box !== undefined && box.bottom > 0 && box.top < window.innerHeight
}

/** Whether the cell holds a change on its way to DHIS2: a failed one waits for the person to enter it again. */
const onItsWay = ({ sync }: CellState) => sync !== 'idle' && sync !== 'failed'

/** The row's own id, or every row of its person. */
const personRows = (tables: ReadonlyArray<GridTable>, row: GridRow) =>
    row.enrollmentId === undefined
        ? [row.id]
        : tables.flatMap(({ rows }) =>
              rows
                  .filter(
                      ({ enrollmentId }) => enrollmentId === row.enrollmentId
                  )
                  .map(({ id }) => id)
          )

interface ConnectOptions {
    open: Pick<
        OpenForm,
        'store' | 'effects' | 'tables' | 'readOnlyRows' | 'beforeComplete'
    >
    form: LoadedForm
    rules: EventsRules
    settings: ValueSettings
    announce(text: string): void
    /** Cell → what a rule cleared there; said on the cell while it stays empty, across reconnections. */
    cleared: Map<CellKey, string>
    /** Rows a person changed or completed, or with unsent changes: only there are the rules' values saved. */
    touched: Set<string>
    /** Starts the form's DOM ids. */
    idScope: string
}

/**
 * Runs the rules over the rows: the visible ones first for a slice of time, the rest when idle, then again for what
 * each change can affect. Rule effects are merged with the form's own; in touched rows the values rules assign or clear
 * are committed as the rule's. Returns how to stop.
 */
export const connectRules = ({
    open: { store, effects, tables, readOnlyRows, beforeComplete },
    form,
    rules,
    settings,
    announce,
    cleared,
    touched,
    idScope,
}: ConnectOptions) => {
    let stopped = false
    // Opening the grid changes nothing: rules' values are saved only with a row someone is changing. A failed change is
    // not on its way: it waits for the person to enter it again.
    for (const [key, cell] of Object.entries(store.getState().cells)) {
        if (cell !== undefined && onItsWay(cell)) {
            touched.add(rowIdOf(key))
        }
    }
    // Rows evaluated at least once; a row still waiting for its idle turn is not run early.
    const seen = new Set<string>()
    // Control id → row id: a value the rules held back while the cell was typed in.
    const held = new Map<string, string>()

    const fieldsCache = new Map<string, ReturnType<typeof stageFields>>()
    const fieldsOf = (table: GridTable, stageId: string) => {
        const id = `${table.id}\n${stageId}`
        const fields =
            fieldsCache.get(id) ??
            stageFields(form, table, stageId, rules.optionGroupOptions)
        fieldsCache.set(id, fields)
        return fields
    }

    /**
     * Commits the rules' values, then writes each row's effects: an outcome, or why its rules failed. Adds what a rule
     * cleared to `said`; returns the cells the rules changed.
     */
    const apply = (results: ReadonlyArray<RowResult>, said: Set<string>) => {
        const values = store.getState().cells
        const active = document.activeElement
        const typing =
            active instanceof HTMLElement && typingIn(active)
                ? active.id
                : undefined
        const entries: Array<{ key: CellKey; text: string }> = []
        const notes: Array<string | undefined> = []
        for (const { row, table, outcome, raw } of results) {
            if (
                outcome instanceof Error ||
                readOnlyRows.has(row.id) ||
                !touched.has(row.id)
            ) {
                continue
            }
            for (const [field, value] of outcome.assignments) {
                const key = cellKey(row.id, field)
                const column = table.columns.find(({ id }) => id === field)
                const now = values[key]?.value
                if (
                    column === undefined ||
                    table.closed.has(key) ||
                    (now ?? '') === (value ?? '')
                ) {
                    continue
                }
                // A rule never overwrites what is being typed: it runs again once the person leaves the cell.
                if (cellDomId(idScope, key) === typing) {
                    held.set(typing, row.id)
                    continue
                }
                entries.push({
                    key,
                    text:
                        value === null
                            ? ''
                            : typedText(column.field, value, settings),
                })
                const by =
                    raw?.assignedValues.get(field)?.by ??
                    raw?.hiddenFields.get(field)?.[0]
                notes.push(
                    value === null && now
                        ? i18n.t('Cleared by rule: {{rule}}', {
                              nsSeparator: '::',
                              rule: by?.ruleName ?? '',
                              interpolation: AS_IS,
                          })
                        : undefined
                )
            }
        }
        const committed =
            entries.length === 0
                ? []
                : store.getState().commitMany(entries, 'rule')
        const changed = entries.filter((_, i) => committed[i] === 'queued')
        entries.forEach(({ key }, i) => {
            // A value its type refuses is dropped: the locked cell must not keep a draft no one can delete.
            if (committed[i] === 'invalid') {
                store.getState().discardDraft(key)
            }
            const note = notes[i]
            if (committed[i] === 'queued' && note !== undefined) {
                cleared.set(key, note)
                said.add(note)
            }
        })

        const after = store.getState().cells
        const state = effects.getState()
        let cells = state.cells
        let rowMessages = state.rowMessages
        let rowNotes = state.rowNotes
        for (const { row, table, outcome } of results) {
            const readOnly = readOnlyRows.get(row.id)
            const required =
                (row.programStageId === undefined
                    ? undefined
                    : form.required.get(row.programStageId)) ?? NONE
            for (const { id } of table.columns) {
                const key = cellKey(row.id, id)
                const rule =
                    outcome instanceof Error ? undefined : outcome.cells.get(id)
                // A read-only row asks for nothing, as the form's own effects say.
                let next: CellEffects =
                    readOnly === undefined
                        ? (rule ?? { required: required.has(id), messages: [] })
                        : {
                              ...rule,
                              readOnly,
                              required: false,
                              messages: rule?.messages ?? [],
                          }
                const note = cleared.get(key)
                if (note !== undefined && !after[key]?.value) {
                    next = {
                        ...next,
                        messages: [
                            ...next.messages,
                            { kind: 'warning', text: note, source: 'rule' },
                        ],
                    }
                } else if (note !== undefined) {
                    cleared.delete(key)
                }
                const kept = saysNothing(next) ? undefined : next
                if (!sameEffects(kept, cells[key])) {
                    cells = cells === state.cells ? { ...cells } : cells
                    if (kept === undefined) {
                        delete cells[key]
                    } else {
                        cells[key] = kept
                    }
                }
            }
            const failed = outcome instanceof Error
            rowMessages = withRow(
                rowMessages,
                row.id,
                failed
                    ? [{ kind: 'error', text: outcome.message, source: 'rule' }]
                    : outcome.rowMessages,
                sameMessages
            )
            rowNotes = withRow(
                rowNotes,
                row.id,
                failed ? NO_NOTES : outcome.notes,
                sameNotes
            )
        }
        if (
            cells !== state.cells ||
            rowMessages !== state.rowMessages ||
            rowNotes !== state.rowNotes
        ) {
            effects.setState({ cells, rowMessages, rowNotes })
        }
        return changed
    }

    /**
     * Evaluates the rows in order, one at a time, until `until` (a `performance.now()` time) passes, a row at least,
     * and applies what they say. Returns how many it evaluated and the rows the rules' own values can change.
     */
    const pass = (
        rowIds: ReadonlyArray<string>,
        said: Set<string>,
        until = Infinity
    ) => {
        const all = tables.getState().tables
        const ruleRows = ruleRowsOf(all, store.getState().cells)
        const places = new Map(
            all.flatMap((table) =>
                table.rows.map(
                    (row): [string, { row: GridRow; table: GridTable }] => [
                        row.id,
                        { row, table },
                    ]
                )
            )
        )
        const results: RowResult[] = []
        let done = 0
        while (
            done < rowIds.length &&
            (done === 0 || performance.now() < until)
        ) {
            const rowId = rowIds[done]
            done += 1
            const evaluation = rules.evaluate(ruleRows, [rowId])
            const place = places.get(rowId)
            const raw = evaluation.effects.get(rowId)
            const outcome =
                evaluation.failures.get(rowId) ??
                (raw === undefined || place?.row.programStageId === undefined
                    ? undefined
                    : rowRuleOutcome(
                          raw,
                          fieldsOf(place.table, place.row.programStageId)
                      ))
            // A row in neither map was not evaluated: it keeps its last effects.
            if (place !== undefined && outcome !== undefined) {
                results.push({ ...place, outcome, raw })
                seen.add(rowId)
            }
        }
        const changed = apply(results, said)
        const next = new Set(
            changed.flatMap(({ key }) => {
                const rowId = rowIdOf(key)
                // The row's own rules ran with the value; the person's other rows read it through cross-event fields.
                return rules
                    .rowsAffectedBy(
                        ruleRows,
                        rowId,
                        key.slice(rowId.length + 1)
                    )
                    .filter((other) => other !== rowId && seen.has(other))
            })
        )
        return { done, next: [...next] }
    }

    /**
     * Runs the rows, until `until` passes for a slice of them, then passes until the rules' own values settle, and
     * says once what they cleared. Returns the rows it did not get to.
     */
    const run = (rowIds: ReadonlyArray<string>, until = Infinity) => {
        const said = new Set<string>()
        const first = pass(rowIds, said, until)
        for (
            let next = first.next, left = PASSES - 1;
            next.length > 0 && left > 0;
            left -= 1
        ) {
            next = pass(next, said).next
        }
        if (said.size > 0) {
            announce([...said].join(' '))
        }
        return rowIds.slice(first.done)
    }

    const pending = new Set<string>()
    let cancelPending: (() => void) | undefined
    const flush = () => {
        cancelPending?.()
        cancelPending = undefined
        const rowIds = [...pending]
        pending.clear()
        if (!stopped && rowIds.length > 0) {
            measured('data-entry:rules-edit', () => run(rowIds))
        }
    }
    // A person's changes until the next paint run together, after it: the key or click that made them returns first.
    const rerun = (rowIds: ReadonlyArray<string>) => {
        rowIds.forEach((rowId) => pending.add(rowId))
        if (cancelPending === undefined && pending.size > 0) {
            cancelPending = afterPaint(flush)
        }
    }
    // A row added or saved re-runs before the next paint, so its rule effects never go missing for a frame.
    const rerunNow = (rowIds: ReadonlyArray<string>) => {
        rowIds.forEach((rowId) => pending.add(rowId))
        if (pending.size > 0) {
            queueMicrotask(flush)
        }
    }

    // The visible rows first, then the rest in their order.
    const order = tables.getState().tables.flatMap(({ id: tableId, rows }) =>
        rows.map(({ id }) => ({
            id,
            visible: onScreen(idScope, tableId, id),
        }))
    )
    const offScreen = order
        .filter(({ visible }) => !visible)
        .map(({ id }) => id)
    let rest = [
        ...order.filter(({ visible }) => visible).map(({ id }) => id),
        ...offScreen,
    ]
    const start = performance.now()
    let inView = true
    const slice = (ms: number) => {
        rest = run(rest, performance.now() + ms)
        // The rows in view are done, however many slices they took.
        if (inView && rest.length <= offScreen.length) {
            inView = false
            performance.measure('data-entry:rules-visible', { start })
        }
    }
    measured('data-entry:rules', () => slice(FIRST_SLICE_MS))
    let cancel = () => {}
    // Rows still in view take short slices one after another; the rest wait for idle time.
    const schedule = () => (inView ? soon : whenIdle)(nextSlice)
    const nextSlice = () => {
        if (!stopped && rest.length > 0) {
            slice(IDLE_SLICE_MS)
            cancel = schedule()
        }
    }
    cancel = schedule()

    const unsubscribes = [
        // A person's change re-runs the rows it can affect; an event date, every row of that person.
        store.subscribe(({ cells }, before) => {
            const edits = Object.entries(cells).flatMap(([key, cell]) => {
                const rowId = rowIdOf(key)
                const field = key.slice(rowId.length + 1)
                const was = before.cells[cellKey(rowId, field)]
                return cell === undefined ||
                    cell === was ||
                    cell.source === 'rule' ||
                    (cell.value ?? '') === (was?.value ?? '')
                    ? []
                    : [{ rowId, field, cell }]
            })
            if (edits.length === 0) {
                return
            }
            // A value a page loads, or put back as DHIS2 has it, is no change on its way.
            for (const { rowId, cell } of edits) {
                if (onItsWay(cell)) {
                    touched.add(rowId)
                }
            }
            const all = tables.getState().tables
            const ruleRows = ruleRowsOf(all, cells)
            const rows = new Map(
                all.flatMap(({ rows: each }) =>
                    each.map((row) => [row.id, row])
                )
            )
            rerun(
                edits.flatMap(({ rowId, field }) => {
                    const row = rows.get(rowId)
                    if (row === undefined) {
                        return []
                    }
                    return field === EVENT_DATE_COLUMN
                        ? personRows(all, row)
                        : rules.rowsAffectedBy(ruleRows, rowId, field)
                })
            )
        }),
        // A new or removed row re-runs its person's rows; a saved status, which rewrote the row's effects, the row.
        tables.subscribe(({ tables: now }, { tables: before }) => {
            const rowsOf = (all: ReadonlyArray<GridTable>) =>
                new Map(
                    all.flatMap(({ rows }) => rows.map((row) => [row.id, row]))
                )
            const is = rowsOf(now)
            const was = rowsOf(before)
            rerunNow([
                ...[...is.values()].flatMap((row) => {
                    if (was.get(row.id) === row) {
                        return []
                    }
                    return was.has(row.id) ? [row.id] : personRows(now, row)
                }),
                ...[...was.values()].flatMap((row) =>
                    is.has(row.id) ? [] : personRows(now, row)
                ),
            ])
        }),
    ]
    const onFocusOut = ({ target }: FocusEvent) => {
        const rowId =
            target instanceof HTMLElement ? held.get(target.id) : undefined
        if (target instanceof HTMLElement && rowId !== undefined) {
            held.delete(target.id)
            rerun([rowId])
        }
    }
    document.addEventListener('focusout', onFocusOut)
    // Completing touches the row: what its rules say is saved before it is checked and sent.
    const prepare = (rowId: string) => {
        // An edit whose rules wait for a paint runs now: completion checks what they say.
        flush()
        if (!stopped && !(touched.has(rowId) && seen.has(rowId))) {
            touched.add(rowId)
            measured('data-entry:rules-edit', () => run([rowId]))
        }
        return undefined
    }
    beforeComplete.add(prepare)

    return () => {
        stopped = true
        cancel()
        cancelPending?.()
        unsubscribes.forEach((unsubscribe) => unsubscribe())
        document.removeEventListener('focusout', onFocusOut)
        beforeComplete.delete(prepare)
    }
}
