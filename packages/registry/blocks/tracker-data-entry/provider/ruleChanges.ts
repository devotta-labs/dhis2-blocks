import type { EventsRuleRow } from '@/components/program-rules'
import { isEmptySlot, personRows } from '../logic/ruleEffects'
import type { DataRecord } from '../model/types'
import type { LoadedForm } from '../sources/types'
import { afterPaint } from './afterPaint'

export type ChangedFieldsByRow = Map<string, Set<string> | undefined>

export const addChangedField = (
    changes: ChangedFieldsByRow,
    rowId: string,
    field?: string
) => {
    if (field === undefined) {
        changes.set(rowId, undefined)
        return
    }
    if (changes.has(rowId) && changes.get(rowId) === undefined) return
    const fields = changes.get(rowId) ?? new Set<string>()
    fields.add(field)
    changes.set(rowId, fields)
}

export const changedFieldsByEdits = (
    edits: ReadonlyArray<{ rowId: string; field: string }>,
    records: ReadonlyMap<string, DataRecord>,
    ruleRows: ReadonlyArray<EventsRuleRow>,
    beforeCells: Parameters<typeof isEmptySlot>[1],
    cells: Parameters<typeof isEmptySlot>[1],
    fieldsByForm: LoadedForm['fieldsByForm'],
    isFieldIndexed: (field: string) => boolean,
    affectedBy: (
        records: ReadonlyMap<string, DataRecord>,
        ruleRows: ReadonlyArray<EventsRuleRow>,
        rowId: string,
        field: string
    ) => ReadonlyArray<string>
) => {
    const changes: ChangedFieldsByRow = new Map()
    for (const { rowId, field } of edits) {
        const record = records.get(rowId)
        if (record === undefined) continue
        const slotChanged =
            isEmptySlot(record, beforeCells, fieldsByForm) !==
            isEmptySlot(record, cells, fieldsByForm)
        const affected = slotChanged
            ? personRows(records, record)
            : affectedBy(records, ruleRows, rowId, field)
        const indexedField =
            slotChanged || !isFieldIndexed(field) ? undefined : field
        affected.forEach((id) => addChangedField(changes, id, indexedField))
    }
    return changes
}

export const createRuleChangeQueue = (
    run: (
        changes: ReadonlyMap<string, ReadonlySet<string> | undefined>
    ) => void,
    held: Map<string, string>
) => {
    const pending: ChangedFieldsByRow = new Map()
    let cancelPending: (() => void) | undefined
    const cancel = () => {
        cancelPending?.()
        cancelPending = undefined
    }
    const flush = () => {
        cancel()
        const changes = new Map(pending)
        pending.clear()
        if (changes.size > 0) run(changes)
    }
    const rerun = (
        changes: ReadonlyMap<string, ReadonlySet<string> | undefined>
    ) => {
        for (const [rowId, fields] of changes) {
            if (fields === undefined) {
                addChangedField(pending, rowId)
            } else {
                fields.forEach((field) =>
                    addChangedField(pending, rowId, field)
                )
            }
        }
        if (cancelPending === undefined && pending.size > 0) {
            cancelPending = afterPaint(flush)
        }
    }
    const rerunNow = (rowIds: ReadonlyArray<string>) => {
        rowIds.forEach((rowId) => addChangedField(pending, rowId))
        if (pending.size > 0) queueMicrotask(flush)
    }
    const onFocusOut = ({ target }: FocusEvent) => {
        const rowId =
            target instanceof HTMLElement ? held.get(target.id) : undefined
        if (target instanceof HTMLElement && rowId !== undefined) {
            held.delete(target.id)
            rerun(new Map([[rowId, undefined]]))
        }
    }
    return { cancel, flush, onFocusOut, rerun, rerunNow }
}
