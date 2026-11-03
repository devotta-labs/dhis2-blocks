import i18n from '@dhis2/d2-i18n'
import { recordIdOf } from '../model/types'
import type { DataRecord, GridRow } from '../model/types'
import type { OutboxRecord } from '../outbox/outbox'
import { EVENT_DATE_COLUMN } from './eventSchemas'
import type { EventFields } from './eventSchemas'
import { SAVE_TIMEOUT, readEvents, withinLimit } from './trackerSave'
import type { DataEngine, LoadedForm } from './types'

/**
 * One row per new event of the form's new-row target (its stage, org unit and enrollment) that DHIS2 does not hold,
 * in the order they were made, labelled by its event date; with the record its changes save to. `remembered` are the
 * events DHIS2 held when loaded or saved here, which are never new.
 */
export const restoreEventRows = async (
    engine: DataEngine,
    records: ReadonlyArray<OutboxRecord>,
    { newRows: target }: LoadedForm,
    {
        programId,
        remembered,
        timeout = SAVE_TIMEOUT,
    }: {
        programId: string
        remembered: ReadonlySet<string>
        timeout?: number
    }
) => {
    const rows = new Map<string, GridRow>()
    const kept = new Map<string, DataRecord>()
    for (const { key, value, record } of [...records].sort(
        (a, b) => a.at - b.at
    )) {
        const id = recordIdOf(key)
        if (
            record?.kind !== 'event' ||
            !record.isNew ||
            remembered.has(id) ||
            record.programStageId !== target?.programStageId ||
            record.orgUnitId !== target.orgUnitId ||
            record.enrollmentId !== target.enrollmentId
        ) {
            continue
        }
        const restored = rows.get(id) ?? {
            id,
            label: i18n.t('New event'),
            stage: target?.stage,
        }
        if (key.slice(id.length + 1) === EVENT_DATE_COLUMN && value !== null) {
            restored.label = value
        }
        rows.set(id, restored)
        kept.set(id, record)
    }
    if (rows.size === 0) {
        return { rows: [], records: [] }
    }
    // One saved since, from another grid or beyond the page loaded, is DHIS2's: its changes are ordinary ones.
    // Unasked, the rows show as new; a save reads what DHIS2 holds first either way.
    const saved = await withinLimit(timeout, (signal) =>
        readEvents(engine, programId, [...rows.keys()], signal)
    ).catch(() => new Map<string, EventFields>())
    const unsaved = ({ id }: { id: string }) => !saved.has(id)
    return {
        rows: [...rows.values()].filter(unsaved),
        records: [...kept.values()].filter(unsaved),
    }
}
