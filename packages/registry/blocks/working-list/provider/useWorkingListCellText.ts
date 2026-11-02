import { useCallback, useMemo } from 'react'
import type { WorkingListDisplayRow } from './contracts'
import { cellText } from './results'
import { useWorkingListMeta } from './WorkingListContext'
import { useWorkingListPrivateUi } from './WorkingListPrivateContext'

/**
 * Formats a row's value as the table shows it, in plain text: option names,
 * dates in the system calendar, organisation unit names, Yes/No. Unknown
 * fields give an empty string.
 */
export const useWorkingListCellText = () => {
    const { formattingContext } = useWorkingListPrivateUi()
    const fields = useWorkingListMeta((meta) => meta.fields)
    const fieldsById = useMemo(
        () => new Map(fields.map((field) => [field.id, field])),
        [fields]
    )
    return useCallback(
        (row: WorkingListDisplayRow, fieldId: string) => {
            const field = fieldsById.get(fieldId)
            return field ? cellText(row, field, formattingContext) : ''
        },
        [fieldsById, formattingContext]
    )
}
