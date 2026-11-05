import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { typedText } from '@/components/dhis2-value-types'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { nameFrom, cellKey } from '@/components/spreadsheet'
import type { CellKey, CellStoreState } from '@/components/spreadsheet'
import type { DataRecord, TrackerRow } from '../model/types'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import { useTrackerContext } from './hooks'

const EVENT_DATE = { valueType: 'DATE' }
const NO_KEYS: ReadonlyArray<CellKey> = []

/**
 * What names a row: once it has an event date (or, until then, the day its record is scheduled for), that date in the
 * system calendar and date format (and its stage in a grid of several stages); before, the label its source gave it.
 * A row named by its cells (`labelFrom`) has the label its source gave it until they hold a name (`nameFrom`).
 */
export const rowLabel = (
    row: TrackerRow,
    record: DataRecord | undefined,
    date: string | undefined,
    settings: ValueSettings
) => {
    if (row.labelFrom !== undefined) {
        return row.label
    }
    const day =
        date ?? (record?.kind === 'event' ? record.scheduledAt : undefined)
    if (day === undefined) {
        return row.label
    }
    const shown = typedText(EVENT_DATE, day, settings)
    return row.stage === undefined ? shown : `${shown} · ${row.stage}`
}

/** A row's name: its label cells' values, each as its field shows it, else `rowLabel`. */
export const labelOf = (
    row: TrackerRow,
    record: DataRecord | undefined,
    cells: CellStoreState['cells'],
    fieldOf: CellStoreState['fieldOf'],
    settings: ValueSettings
) =>
    nameFrom(
        row.labelFrom ?? [],
        (row.labelFrom ?? []).map((key) => cells[key]?.value),
        fieldOf,
        settings
    ) ||
    rowLabel(
        row,
        record,
        cells[cellKey(row.id, EVENT_DATE_COLUMN)]?.value,
        settings
    )

/**
 * What names the row, as it changes: a person by their label cells' values, each as its field shows it; any other row
 * as `rowLabel` says. Nothing for no row.
 */
export const useRowLabel = (row: TrackerRow | undefined) => {
    const { store, settings, records } = useTrackerContext()
    const id = row?.id ?? ''
    // The cells the label reads, so it changes only with them.
    const cells = useStore(
        store,
        useShallow((state) =>
            Object.fromEntries(
                [
                    cellKey(id, EVENT_DATE_COLUMN),
                    ...(row?.labelFrom ?? NO_KEYS),
                ].map((key) => [key, state.cells[key]])
            )
        )
    )
    if (row === undefined) {
        return undefined
    }
    return labelOf(
        row,
        records.get(row.id),
        cells,
        store.getState().fieldOf,
        settings
    )
}

/** A row's name in its header, as `useRowLabel` gives it; formatted even when the event date has no column. */
export const TrackerRowLabel = ({ row }: { row: TrackerRow }) => (
    <>{useRowLabel(row)}</>
)
