import { useMemo } from 'react'
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
const useRowLabel = (row: TrackerRow | undefined) => {
    const { store, settings, records } = useTrackerContext()
    const id = row?.id ?? ''
    // The cells the label reads, so it changes only with them.
    const selectCells = useShallow((state: CellStoreState) =>
        Object.fromEntries(
            [
                cellKey(id, EVENT_DATE_COLUMN),
                ...(row?.labelFrom ?? NO_KEYS),
            ].map((key) => [key, state.cells[key]])
        )
    )
    const cells = useStore(store, selectCells)
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

/** A row with the name last made for it. */
interface NamedRow {
    row: TrackerRow
    /** The cells its name reads. */
    keys: CellKey[]
    /** What those cells held when the name was made. */
    values: Array<string | undefined>
    label?: string
}

/**
 * The names of the rows by row id, as they change, read from the store once for them all: a list that names many rows
 * hands each name down rather than have every entry listen to the store. The same map while no name changes.
 */
export const useRowLabels = (
    rows: ReadonlyArray<TrackerRow>
): ReadonlyMap<string, string> => {
    const { store, settings, records } = useTrackerContext()
    const select = useMemo(() => {
        const named = rows.map((row): NamedRow => ({
            row,
            keys: [
                cellKey(row.id, EVENT_DATE_COLUMN),
                ...(row.labelFrom ?? []),
            ],
            values: [],
        }))
        let labels: ReadonlyMap<string, string> | undefined
        return ({ cells, fieldOf }: CellStoreState) => {
            let changed = labels === undefined
            for (const entry of named) {
                const values = entry.keys.map((key) => cells[key]?.value)
                if (
                    entry.label !== undefined &&
                    values.every((value, at) => value === entry.values[at])
                ) {
                    continue
                }
                entry.values = values
                const label = labelOf(
                    entry.row,
                    records.get(entry.row.id),
                    cells,
                    fieldOf,
                    settings
                )
                changed ||= label !== entry.label
                entry.label = label
            }
            if (changed || labels === undefined) {
                labels = new Map(
                    named.map(({ row, label }) => [row.id, label ?? row.label])
                )
            }
            return labels
        }
    }, [rows, records, settings])
    return useStore(store, select)
}

/** A row's name in its header, as `useRowLabel` gives it; formatted even when the event date has no column. */
export const TrackerRowLabel = ({ row }: { row: TrackerRow }) => {
    const label = useRowLabel(row)
    return <>{label}</>
}
