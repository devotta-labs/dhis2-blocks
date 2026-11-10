import i18n from '@dhis2/d2-i18n'
import {
    type EventsRules,
    type RuleEventInput,
} from '@/components/program-rules'
import { typedText } from '@/components/dhis2-value-types'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { cellDomId, typingIn, cellKey } from '@/components/spreadsheet'
import type { Announcer, CellKey, CellState } from '@/components/spreadsheet'
import {
    sameEffects,
    sameMessages,
    sameNotes,
    saysNothing,
    withRow,
} from '../logic/effects'
import type { TrackerEffects } from '../logic/effects'
import {
    enrollmentUnitOf,
    eventsByEnrollment,
    isEmptySlot,
    partsOf,
    personRows,
    ruleRowsCache,
    stageFields,
} from '../logic/ruleEffects'
import {
    fieldIdOfKey,
    formOf,
    recordIdOf,
    recordsOf,
    rowsByRecord,
} from '../model/types'
import type { DataRecord } from '../model/types'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import type { LoadedForm } from '../sources/types'
import { afterPaint, measured, onScreen, soon, whenIdle } from './afterPaint'
import { affectedBy } from './affectedBy'
import { evaluateEventBatch } from './evaluateEventBatch'
import { lockedElsewhere } from './formRows'
import { createRowResultAppender, type RowResult } from './rowResults'
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

/** Whether the cell holds a change on its way to DHIS2: a failed one waits for the person to enter it again. */
const onItsWay = ({ sync }: CellState) => sync !== 'idle' && sync !== 'failed'

interface ConnectOptions {
    open: Pick<
        OpenForm,
        'store' | 'effects' | 'tables' | 'readOnlyRecords' | 'beforeComplete'
    >
    form: LoadedForm
    rules: EventsRules
    settings: ValueSettings
    announce: Announcer['announce']
    /** Cell → what a rule cleared there; said on the cell while it stays empty, across reconnections. */
    cleared: Map<CellKey, string>
    /** Rows a person changed or completed, or with unsent changes: only there are the rules' values saved. */
    touched: Set<string>
    /** Record → the notes the rules last wrote on it, after the source's own, across reconnections. */
    ruleNotes: Map<string, ReadonlyArray<string>>
    /**
     * Rows evaluated at least once, across reconnections: a rule's change re-runs only these; a reconnection runs them
     * after the rows not evaluated yet, in view and off screen alike.
     */
    seen: Set<string>
    /** Starts the form's DOM ids. */
    idScope: string
}

/**
 * Runs the rules over the rows: the visible ones first for a slice of time, the rest when idle, then again for what
 * each change can affect. Rule effects are merged with the form's own; in touched rows the values rules assign or clear
 * are committed as the rule's. Returns how to stop.
 */
export const connectRules = ({
    open: { store, effects, tables, readOnlyRecords, beforeComplete },
    form,
    rules,
    settings,
    announce,
    cleared,
    touched,
    ruleNotes,
    seen,
    idScope,
}: ConnectOptions) => {
    let stopped = false
    const lastEventRulesMs = new Map<string, number>()
    // Opening the grid changes nothing: rules' values are saved only with a row someone is changing. A failed change is
    // not on its way: it waits for the person to enter it again.
    for (const [key, cell] of Object.entries(store.getState().cells)) {
        if (cell !== undefined && onItsWay(cell)) {
            touched.add(recordIdOf(key))
        }
    }
    // Control id → row id: a value the rules held back while the cell was typed in.
    const held = new Map<string, string>()

    const ruleRowsNow = ruleRowsCache(form.fieldsByForm)
    const fieldsCache = new Map<string, ReturnType<typeof stageFields>>()
    const fieldsOf = (
        records: ReadonlyMap<string, DataRecord>,
        record: DataRecord
    ) => {
        const formIds = partsOf(records, record).map(formOf)
        const cacheKey = formIds.join(',')
        const fields =
            fieldsCache.get(cacheKey) ??
            stageFields(form, formIds, rules.optionGroupOptions)
        fieldsCache.set(cacheKey, fields)
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
        const { records } = tables.getState()
        const entries: Array<{ key: CellKey; text: string }> = []
        const notes: Array<string | undefined> = []
        for (const { recordId, outcome, raw } of results) {
            const record = records.get(recordId)
            if (outcome instanceof Error || record === undefined) {
                continue
            }
            const parts = partsOf(records, record)
            for (const [field, value] of outcome.assignments) {
                // The person's attribute, else the record's own field.
                const owner =
                    parts.find((part) =>
                        form.fieldsByForm.get(formOf(part))?.has(field)
                    ) ?? record
                if (
                    readOnlyRecords.has(owner.id) ||
                    !(touched.has(owner.id) || touched.has(recordId))
                ) {
                    continue
                }
                const key = cellKey(owner.id, field)
                const now = values[key]?.value
                const definition = form.fields.get(field)
                if (definition === undefined || (now ?? '') === (value ?? '')) {
                    continue
                }
                // A rule never overwrites what is being typed: it runs again once the person leaves the cell.
                if (cellDomId(idScope, key) === typing) {
                    held.set(typing, recordId)
                    continue
                }
                entries.push({
                    key,
                    text:
                        value === null
                            ? ''
                            : typedText(definition, value, settings),
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
        for (const { recordId, outcome } of results) {
            const record = records.get(recordId)
            for (const part of record === undefined
                ? []
                : partsOf(records, record)) {
                const readOnly = readOnlyRecords.get(part.id)
                const required = form.required.get(formOf(part)) ?? NONE
                // An event's date and every field of the record's form, shown in a column or not.
                const ids = [
                    ...(part.kind === 'event' ? [EVENT_DATE_COLUMN] : []),
                    ...(form.fieldsByForm.get(formOf(part)) ?? NONE),
                ]
                for (const id of ids) {
                    const key = cellKey(part.id, id)
                    const rule =
                        outcome instanceof Error
                            ? undefined
                            : outcome.cells.get(id)
                    // A read-only row asks for nothing, as the form's own effects say.
                    let next: TrackerEffects =
                        readOnly === undefined
                            ? (rule ?? {
                                  required: required.has(id),
                                  messages: [],
                              })
                            : {
                                  ...rule,
                                  readOnly,
                                  required: false,
                                  messages: rule?.messages ?? [],
                              }
                    next = lockedElsewhere(form, part, id, next)
                    // A draft in a cell the rules hide can no longer be reached to clear it, and would block completion.
                    if (
                        next.hiddenBy !== undefined &&
                        after[key]?.draft !== undefined
                    ) {
                        store.getState().discardDraft(key)
                    }
                    const note = cleared.get(key)
                    if (note !== undefined && !after[key]?.value) {
                        next = {
                            ...next,
                            messages: [
                                ...next.messages,
                                { tone: 'warning', text: note, source: 'rule' },
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
            }
            const failed = outcome instanceof Error
            rowMessages = withRow(
                rowMessages,
                recordId,
                failed
                    ? [{ tone: 'error', text: outcome.message, source: 'rule' }]
                    : outcome.rowMessages,
                sameMessages
            )
            // The source's notes on the record (a register's on the events it leaves out) come first and stay.
            const written = rowNotes.get(recordId) ?? NO_NOTES
            const last = ruleNotes.get(recordId) ?? NO_NOTES
            const offset = written.length - last.length
            const own =
                offset >= 0 &&
                last.every((note, at) => written[offset + at] === note)
                    ? written.slice(0, offset)
                    : written
            const said = failed ? NO_NOTES : outcome.notes
            ruleNotes.set(recordId, said)
            rowNotes = withRow(
                rowNotes,
                recordId,
                own.length === 0 ? said : [...own, ...said],
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

    /** Evaluates rows in order, in small compatible event batches, until `until` passes, a row at least. */
    const pass = (
        rowIds: ReadonlyArray<string>,
        said: Set<string>,
        until = Infinity
    ) => {
        const { tables: all, records } = tables.getState()
        const cells = store.getState().cells
        const ruleRows = ruleRowsNow(records, cells)
        let byEnrollment: ReadonlyMap<string, RuleEventInput[]> | undefined
        // An enrolment runs its enrolment rules; any other record, its event rules.
        const evaluateRecord = (rowId: string, record?: DataRecord) => {
            if (record?.kind !== 'enrollment') {
                return rules.evaluate(ruleRows, [rowId])
            }
            const unit = enrollmentUnitOf(
                records,
                rowId,
                cells,
                form.fieldsByForm,
                // Gathered on the first enrolment's turn.
                () =>
                    (byEnrollment ??= eventsByEnrollment(ruleRows)).get(
                        rowId
                    ) ?? []
            )
            return unit && rules.evaluateEnrollments?.([unit])
        }
        const shown = rowsByRecord(all)
        const results: RowResult[] = []
        const addResult = createRowResultAppender(
            results,
            shown,
            seen,
            (record) => fieldsOf(records, record)
        )
        let done = 0
        while (
            done < rowIds.length &&
            (done === 0 || performance.now() < until)
        ) {
            const rowId = rowIds[done]
            const record = records.get(rowId)
            // An empty slot has no rules: it shows the form's own effects, whatever the rules said while it had a value.
            const empty =
                record !== undefined &&
                isEmptySlot(record, cells, form.fieldsByForm)
            if (record?.kind === 'event' && !empty) {
                const batchKey = `${record.programStageId}\u0000${record.enrollmentId ?? ''}`
                const batch = evaluateEventBatch(
                    rowIds,
                    done,
                    record,
                    records,
                    until,
                    lastEventRulesMs.get(batchKey),
                    (event) => isEmptySlot(event, cells, form.fieldsByForm),
                    (ids) => rules.evaluate(ruleRows, ids)
                )
                lastEventRulesMs.set(batchKey, batch.millisecondsPerRow)
                for (const batchId of batch.rowIds) {
                    addResult(
                        batchId,
                        records.get(batchId),
                        false,
                        batch.result
                    )
                }
                done += batch.rowIds.length
                continue
            }
            const evaluation = empty ? undefined : evaluateRecord(rowId, record)
            // A record in neither map was not evaluated: it keeps its last effects. One no row shows has none.
            addResult(rowId, record, empty, evaluation)
            done += 1
        }
        const changed = apply(results, said)
        const next = new Set(
            changed.flatMap(({ key }) => {
                const rowId = recordIdOf(key)
                // The row's own rules ran with the value; the person's other rows read it through cross-event fields,
                // and their events read the person's attributes.
                return affectedBy(
                    rules,
                    records,
                    ruleRows,
                    rowId,
                    fieldIdOfKey(key)
                ).filter((other) => other !== rowId && seen.has(other))
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

    // The records of the visible rows first, then the rest, in their rows' order. Rows evaluated before a reconnection
    // show their effects meanwhile: they run again after the rows not evaluated yet, in view and off screen alike, as
    // the people the rules have now can change them.
    const order = tables.getState().tables.flatMap(({ id: tableId, rows }) =>
        rows.flatMap((row) => {
            const visible = onScreen(idScope, tableId, row.id)
            return recordsOf(row).map((id) => ({ id, visible }))
        })
    )
    const ids = (keep: (entry: (typeof order)[number]) => boolean) =>
        order.filter(keep).map(({ id }) => id)
    const later = [
        ...ids(({ id, visible }) => !visible && !seen.has(id)),
        ...ids(({ id, visible }) => !visible && seen.has(id)),
    ]
    let rest = [
        ...ids(({ id, visible }) => visible && !seen.has(id)),
        ...ids(({ id, visible }) => visible && seen.has(id)),
        ...later,
    ]
    const start = performance.now()
    let inView = true
    const slice = (ms: number) => {
        rest = run(rest, performance.now() + ms)
        // The rows in view are done, however many slices they took.
        if (inView && rest.length <= later.length) {
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
        // A person's change re-runs the rows it can affect; an event date, an attribute or an enrolment date, every row
        // of that person.
        store.subscribe(({ cells }, before) => {
            const edits = Object.entries(cells).flatMap(([key, cell]) => {
                const rowId = recordIdOf(key)
                const field = fieldIdOfKey(key)
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
            const { records } = tables.getState()
            const ruleRows = ruleRowsNow(records, cells)
            rerun(
                edits.flatMap(({ rowId, field }) => {
                    const record = records.get(rowId)
                    // A slot that starts or stops being an event, its `createdWith` values with it, changes the person's
                    // other rows, as an event date does.
                    return record !== undefined &&
                        isEmptySlot(record, before.cells, form.fieldsByForm) !==
                            isEmptySlot(record, cells, form.fieldsByForm)
                        ? personRows(records, record)
                        : affectedBy(rules, records, ruleRows, rowId, field)
                })
            )
        }),
        // A new or removed record re-runs its person's rows; a saved status, which rewrote the row's effects, the row.
        tables.subscribe(({ records: is }, { records: was }) => {
            if (is === was) {
                return
            }
            rerunNow([
                ...[...is.values()].flatMap((record) => {
                    if (was.get(record.id) === record) {
                        return []
                    }
                    return was.has(record.id)
                        ? [record.id]
                        : personRows(is, record)
                }),
                ...[...was.values()].flatMap((record) =>
                    is.has(record.id) ? [] : personRows(is, record)
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
    // Completing touches the record: what its rules say is saved before it is checked and sent.
    const prepare = (recordId: string) => {
        // An edit whose rules wait for a paint runs now: completion checks what they say.
        flush()
        // A changed row its rules reached, and that is not waiting to run again, holds what they say.
        const due =
            !touched.has(recordId) ||
            !seen.has(recordId) ||
            rest.includes(recordId)
        if (!stopped && due) {
            touched.add(recordId)
            measured('data-entry:rules-edit', () => run([recordId]))
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
