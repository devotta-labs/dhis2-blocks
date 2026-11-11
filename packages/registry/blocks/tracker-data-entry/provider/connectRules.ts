import i18n from '@dhis2/d2-i18n'
import {
    emptyEffects,
    type EventsRuleRow,
    type EventsRules,
    type RuleEffects,
    type RuleEventInput,
} from '@/components/program-rules'
import { typedText } from '@/components/dhis2-value-types'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { cellDomId, typingIn, cellKey } from '@/components/spreadsheet'
import type { Announcer, CellKey, CellState } from '@/components/spreadsheet'
import { effectsWriter, sameNotes, withRow } from '../logic/effects'
import type { TrackerEffects } from '../logic/effects'
import {
    enrollmentUnitOf,
    eventsByEnrollment,
    isEmptySlot,
    partsOf,
    personRows,
    rowRuleOutcome,
    ruleRowsCache,
    stageFields,
} from '../logic/ruleEffects'
import { formOf, recordIdOf, rowsByRecord } from '../model/types'
import { fieldIdOfKey } from '../model/types'
import type { DataRecord } from '../model/types'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import type { LoadedForm } from '../sources/types'
import { measured } from './afterPaint'
import { lockedElsewhere } from './formRows'
import type { OpenForm } from './openForm'
import {
    addChangedField,
    changedFieldsByEdits,
    createRuleChangeQueue,
    type ChangedFieldsByRow,
} from './ruleChanges'
import { ruleQueue, ruleWindow } from './ruleWindow'
import type { Drawn } from './ruleWindow'

// Rules whose values keep changing each other's rows stop after this many passes; settled rules need two.
const PASSES = 5
// Rule names are shown as DHIS2 gives them, not HTML-escaped.
const AS_IS = { escapeValue: false }
const NONE: ReadonlySet<string> = new Set()
const NO_NOTES: ReadonlyArray<string> = []
/** What one record's rules said, or why they failed; `raw` names the rules behind its values. */
interface RowResult {
    recordId: string
    outcome: ReturnType<typeof rowRuleOutcome> | Error
    raw?: RuleEffects
}

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
    /** The rows the grid draws. Without a grid drawing the form, every row's rules run. */
    drawn?: Drawn
}

/**
 * Runs the rules over the rows the grid draws and the touched ones: the visible ones first for a slice of time, the
 * rest when idle, a row not evaluated yet once the grid draws it, then again for what each change can affect. A row
 * never drawn, changed or completed is never evaluated. Rule effects are merged with the form's own; in touched rows
 * the values rules assign or clear are committed as the rule's. Returns how to stop.
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
    drawn,
}: ConnectOptions) => {
    let stopped = false
    // Opening the grid changes nothing: rules' values are saved only with a row someone is changing. A failed change is
    // not on its way: it waits for the person to enter it again.
    for (const [key, cell] of Object.entries(store.getState().cells)) {
        if (cell !== undefined && onItsWay(cell)) {
            touched.add(recordIdOf(key))
        }
    }
    // A row neither evaluated nor touched waits for the grid to draw it: its rules' values would not be saved.
    const lazy = ruleWindow(
        drawn,
        () => tables.getState().tables,
        (id) => seen.has(id) || touched.has(id)
    )
    // Rows whose rules all ran here on the values they hold now: only for these can a change run just the rules that
    // read it. A reconnection starts over, as the rows may have changed while nothing listened.
    const current = new Set<string>()
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
     * The records to run again after `field` of `rowId` changed: for a data value, the row, the person's rows that read
     * it and a register's enrolment; for an event date, an attribute or an enrolment date, every row of that person.
     */
    const affectedBy = (
        records: ReadonlyMap<string, DataRecord>,
        ruleRows: ReadonlyArray<EventsRuleRow>,
        rowId: string,
        field: string
    ) => {
        const record = records.get(rowId)
        if (record === undefined) {
            return []
        }
        if (record.kind !== 'event' || field === EVENT_DATE_COLUMN) {
            return personRows(records, record)
        }
        const rows = rules.rowsAffectedBy(ruleRows, rowId, field)
        // A register's enrolment rules read its events.
        return record.enrollmentId !== undefined &&
            records.get(record.enrollmentId)?.kind === 'enrollment'
            ? [...rows, record.enrollmentId]
            : rows
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
        const writer = effectsWriter(state)
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
                    writer.setCell(key, next)
                }
            }
            const failed = outcome instanceof Error
            writer.setRowMessages(
                recordId,
                failed
                    ? [{ tone: 'error', text: outcome.message, source: 'rule' }]
                    : outcome.rowMessages
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
        const wrote = writer.state()
        if (
            wrote.cells !== state.cells ||
            wrote.rowMessages !== state.rowMessages ||
            rowNotes !== state.rowNotes
        ) {
            effects.setState({ ...wrote, rowNotes })
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
        until = Infinity,
        changedFields?: ReadonlyMap<string, ReadonlySet<string> | undefined>
    ) => {
        const { tables: all, records } = tables.getState()
        const cells = store.getState().cells
        const ruleRows = ruleRowsNow(records, cells)
        let byEnrollment: ReadonlyMap<string, RuleEventInput[]> | undefined
        // An enrolment runs its enrolment rules; any other record, its event rules.
        const evaluateRecord = (rowId: string, record?: DataRecord) => {
            if (record?.kind !== 'enrollment') {
                const fields = current.has(rowId)
                    ? changedFields?.get(rowId)
                    : undefined
                const evaluation = rules.evaluate(
                    ruleRows,
                    [rowId],
                    fields === undefined ? undefined : [...fields]
                )
                // A row the rules did not answer for (its person still loads, or they failed) runs them all next.
                if (evaluation.effects.has(rowId)) {
                    current.add(rowId)
                } else {
                    current.delete(rowId)
                }
                return evaluation
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
        let done = 0
        while (
            done < rowIds.length &&
            (done === 0 || performance.now() < until)
        ) {
            const rowId = rowIds[done]
            done += 1
            const record = records.get(rowId)
            // An empty slot has no rules: it shows the form's own effects, whatever the rules said while it had a value.
            const empty =
                record !== undefined &&
                isEmptySlot(record, cells, form.fieldsByForm)
            if (empty) {
                current.delete(rowId)
            }
            const evaluation = empty ? undefined : evaluateRecord(rowId, record)
            const raw = empty ? emptyEffects() : evaluation?.effects.get(rowId)
            const outcome =
                evaluation?.failures.get(rowId) ??
                (raw === undefined || record === undefined
                    ? undefined
                    : rowRuleOutcome(raw, fieldsOf(records, record)))
            // A record in neither map was not evaluated: it keeps its last effects. One no row shows has none.
            if (shown.has(rowId) && outcome !== undefined) {
                results.push({ recordId: rowId, outcome, raw })
                seen.add(rowId)
                lazy.evaluated(rowId)
            }
        }
        const changed = apply(results, said)
        const next: ChangedFieldsByRow = new Map()
        for (const { key } of changed) {
            const rowId = recordIdOf(key)
            const field = fieldIdOfKey(key)
            for (const other of affectedBy(records, ruleRows, rowId, field)) {
                if (other !== rowId && seen.has(other)) {
                    addChangedField(
                        next,
                        other,
                        field === EVENT_DATE_COLUMN || !form.fields.has(field)
                            ? undefined
                            : field
                    )
                }
            }
        }
        return { done, next }
    }

    /**
     * Runs the rows, until `until` passes for a slice of them, then passes until the rules' own values settle, and
     * says once what they cleared. Returns the rows it did not get to.
     */
    const run = (
        rowIds: ReadonlyArray<string>,
        until = Infinity,
        changedFields?: ReadonlyMap<string, ReadonlySet<string> | undefined>
    ) => {
        const said = new Set<string>()
        const first = pass(rowIds, said, until, changedFields)
        for (
            let next = first.next, left = PASSES - 1;
            next.size > 0 && left > 0;
            left -= 1
        ) {
            next = pass([...next.keys()], said, Infinity, next).next
        }
        if (said.size > 0) {
            announce([...said].join(' '))
        }
        return rowIds.slice(first.done)
    }

    const runChanges = (
        changes: ReadonlyMap<string, ReadonlySet<string> | undefined>
    ) => {
        if (!stopped && changes.size > 0) {
            measured('data-entry:rules-edit', () =>
                run([...changes.keys()], Infinity, changes)
            )
        }
    }
    const {
        cancel: cancelPendingReruns,
        flush,
        onFocusOut,
        rerun,
        rerunNow,
    } = createRuleChangeQueue(runChanges, held)

    const queue = ruleQueue({ tables, idScope, seen, lazy, run })
    queue.start()

    const unsubscribes = [
        drawn?.subscribe(queue.drawn),
        // A person's change re-runs the rows it can affect; an event date, an attribute or an enrolment date, every row
        // of that person.
        store.subscribe(({ cells, changedCellKeys }, before) => {
            const edits = changedCellKeys.flatMap((key) => {
                const cell = cells[key]
                if (cell === undefined) {
                    return []
                }
                const rowId = recordIdOf(key)
                const field = fieldIdOfKey(key)
                const was = before.cells[key]
                return cell === was ||
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
            const changes = changedFieldsByEdits(
                edits,
                records,
                ruleRows,
                before.cells,
                cells,
                form.fieldsByForm,
                (field) =>
                    field !== EVENT_DATE_COLUMN && form.fields.has(field),
                affectedBy
            )
            rerun(changes)
        }),
        // A new or removed record re-runs its person's rows; a saved status, which rewrote the row's effects, the row.
        // Of a person's rows, one neither evaluated nor drawn yet waits for the grid to draw it.
        tables.subscribe(({ records: is }, { records: was }) => {
            if (is === was) {
                return
            }
            const rowIds = [
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
            ]
            rerunNow(lazy.park(rowIds, (id) => !was.has(id)))
        }),
    ]
    document.addEventListener('focusout', onFocusOut)
    // Completing touches the record: what its rules say is saved before it is checked and sent.
    const prepare = (recordId: string) => {
        // An edit whose rules wait for a paint runs now: completion checks what they say.
        flush()
        // A changed row its rules reached, and that is not waiting to run again, holds what they say.
        const due =
            !touched.has(recordId) || !seen.has(recordId) || queue.has(recordId)
        if (!stopped && due) {
            touched.add(recordId)
            measured('data-entry:rules-edit', () => run([recordId]))
        }
        return undefined
    }
    beforeComplete.add(prepare)

    return () => {
        stopped = true
        cancelPendingReruns()
        queue.stop()
        unsubscribes.forEach((unsubscribe) => unsubscribe?.())
        document.removeEventListener('focusout', onFocusOut)
        beforeComplete.delete(prepare)
    }
}
