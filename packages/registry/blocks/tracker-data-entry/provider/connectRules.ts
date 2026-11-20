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
    rowRuleOutcome,
    ruleRowsCache,
    stageFields,
} from '../logic/ruleEffects'
import { formOf, recordsOf, recordIdOf, rowsByRecord } from '../model/types'
import { fieldIdOfKey } from '../model/types'
import type { DataRecord } from '../model/types'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import type { LoadedForm } from '../sources/types'
import { afterPaint, measured, onScreen, soon, whenIdle } from './afterPaint'
import { lockedElsewhere } from './formRows'
import type { OpenForm } from './openForm'

const FIRST_SLICE_MS = 100
const IDLE_SLICE_MS = 16
const PASSES = 5
const AS_IS = { escapeValue: false }
const NONE: ReadonlySet<string> = new Set()
const NO_NOTES: ReadonlyArray<string> = []

interface RowResult {
    recordId: string
    outcome: ReturnType<typeof rowRuleOutcome> | Error
    raw?: RuleEffects
}

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
    for (const [key, cell] of Object.entries(store.getState().cells)) {
        if (cell !== undefined && onItsWay(cell)) {
            touched.add(recordIdOf(key))
        }
    }
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
        return record.enrollmentId !== undefined &&
            records.get(record.enrollmentId)?.kind === 'enrollment'
            ? [...rows, record.enrollmentId]
            : rows
    }

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

    const pass = (
        rowIds: ReadonlyArray<string>,
        said: Set<string>,
        until = Infinity
    ) => {
        const { tables: all, records } = tables.getState()
        const cells = store.getState().cells
        const ruleRows = ruleRowsNow(records, cells)
        let byEnrollment: ReadonlyMap<string, RuleEventInput[]> | undefined
        const evaluateRecord = (rowId: string, record?: DataRecord) => {
            if (record?.kind !== 'enrollment') {
                return rules.evaluate(ruleRows, [rowId])
            }
            const unit = enrollmentUnitOf(
                records,
                rowId,
                cells,
                form.fieldsByForm,
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
            const empty =
                record !== undefined &&
                isEmptySlot(record, cells, form.fieldsByForm)
            const evaluation = empty ? undefined : evaluateRecord(rowId, record)
            const raw = empty ? emptyEffects() : evaluation?.effects.get(rowId)
            const outcome =
                evaluation?.failures.get(rowId) ??
                (raw === undefined || record === undefined
                    ? undefined
                    : rowRuleOutcome(raw, fieldsOf(records, record)))
            if (shown.has(rowId) && outcome !== undefined) {
                results.push({ recordId: rowId, outcome, raw })
                seen.add(rowId)
            }
        }
        const changed = apply(results, said)
        const next = new Set(
            changed.flatMap(({ key }) => {
                const rowId = recordIdOf(key)
                return affectedBy(
                    records,
                    ruleRows,
                    rowId,
                    fieldIdOfKey(key)
                ).filter((other) => other !== rowId && seen.has(other))
            })
        )
        return { done, next: [...next] }
    }

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
    const rerun = (rowIds: ReadonlyArray<string>) => {
        rowIds.forEach((rowId) => pending.add(rowId))
        if (cancelPending === undefined && pending.size > 0) {
            cancelPending = afterPaint(flush)
        }
    }
    const rerunNow = (rowIds: ReadonlyArray<string>) => {
        rowIds.forEach((rowId) => pending.add(rowId))
        if (pending.size > 0) {
            queueMicrotask(flush)
        }
    }

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
        if (inView && rest.length <= later.length) {
            inView = false
            performance.measure('data-entry:rules-visible', { start })
        }
    }
    measured('data-entry:rules', () => slice(FIRST_SLICE_MS))
    let cancel = () => {}
    const schedule = () => (inView ? soon : whenIdle)(nextSlice)
    const nextSlice = () => {
        if (!stopped && rest.length > 0) {
            slice(IDLE_SLICE_MS)
            cancel = schedule()
        }
    }
    cancel = schedule()

    const unsubscribes = [
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
                    return record !== undefined &&
                        isEmptySlot(record, before.cells, form.fieldsByForm) !==
                            isEmptySlot(record, cells, form.fieldsByForm)
                        ? personRows(records, record)
                        : affectedBy(records, ruleRows, rowId, field)
                })
            )
        }),
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
    const prepare = (recordId: string) => {
        flush()
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
