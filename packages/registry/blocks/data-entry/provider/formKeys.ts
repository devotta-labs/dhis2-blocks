import type { StoreApi } from 'zustand/vanilla'
import { indexCells } from '../model/types'
import type { CellKey } from '../model/types'
import type { LoadedForm } from '../sources/types'
import { isRecordField } from './formRows'
import type { FormTables } from './openForm'

/**
 * Whether a key is this form's: an open cell of its tables, or a field of a record it holds that no column shows,
 * which rules may assign. The outbox also holds changes made in the program's other grids.
 */
export const formKeys = (
    form: Pick<LoadedForm, 'fieldsByForm'>,
    tables: StoreApi<FormTables>
) => {
    // The cell index, made again only when the tables change.
    let indexed:
        | { of: FormTables['tables']; cells: ReturnType<typeof indexCells> }
        | undefined
    return (key: string) => {
        const { tables: now, records } = tables.getState()
        if (indexed?.of !== now) {
            indexed = { of: now, cells: indexCells(now) }
        }
        // SAFETY: a string that is no cell key is in no index.
        return (
            indexed.cells.has(key as CellKey) ||
            isRecordField(form, records, key)
        )
    }
}
