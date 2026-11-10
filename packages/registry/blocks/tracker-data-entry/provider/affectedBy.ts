import type { EventsRuleRow, EventsRules } from '@/components/program-rules'
import { personRows } from '../logic/ruleEffects'
import type { DataRecord } from '../model/types'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'

export const affectedBy = (
    rules: EventsRules,
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
