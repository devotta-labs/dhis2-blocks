import { partsOf, stageFields } from '../logic/ruleEffects'
import { formOf } from '../model/types'
import type { DataRecord } from '../model/types'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'

const NONE: ReadonlySet<string> = new Set()

interface RecordParts {
    record: DataRecord
    parts: ReadonlyArray<{
        record: DataRecord
        required: ReadonlySet<string>
        ids: ReadonlyArray<string>
    }>
    formIds: ReadonlyArray<string>
    ownerByField: ReadonlyMap<string, DataRecord>
}

export const createRecordPartsCache = (
    form: Parameters<typeof stageFields>[0],
    optionGroups: Parameters<typeof stageFields>[2]
) => {
    const fieldsCache = new Map<string, ReturnType<typeof stageFields>>()
    const partsCache = new WeakMap<
        ReadonlyMap<string, DataRecord>,
        Map<string, RecordParts>
    >()
    const partsFor = (
        records: ReadonlyMap<string, DataRecord>,
        record: DataRecord
    ): RecordParts => {
        let byId = partsCache.get(records)
        if (byId === undefined) {
            byId = new Map()
            partsCache.set(records, byId)
        }
        const cached = byId.get(record.id)
        if (cached?.record === record) {
            return cached
        }
        const parts = partsOf(records, record)
        const ownerByField = new Map<string, DataRecord>()
        const details = parts.map((part) => {
            const formId = formOf(part)
            const fields = form.fieldsByForm.get(formId) ?? NONE
            for (const field of fields) {
                if (!ownerByField.has(field)) {
                    ownerByField.set(field, part)
                }
            }
            return {
                record: part,
                required: form.required.get(formId) ?? NONE,
                ids: [
                    ...(part.kind === 'event' ? [EVENT_DATE_COLUMN] : []),
                    ...fields,
                ],
            }
        })
        const next = {
            record,
            parts: details,
            formIds: parts.map(formOf),
            ownerByField,
        }
        byId.set(record.id, next)
        return next
    }
    const fieldsOf = (
        records: ReadonlyMap<string, DataRecord>,
        record: DataRecord
    ) => {
        const { formIds } = partsFor(records, record)
        const cacheKey = formIds.join(',')
        const fields =
            fieldsCache.get(cacheKey) ??
            stageFields(form, formIds, optionGroups)
        fieldsCache.set(cacheKey, fields)
        return fields
    }
    return { fieldsOf, partsFor }
}
