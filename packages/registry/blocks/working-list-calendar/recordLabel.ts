import { z } from 'zod'
import type { WorkingListDisplayRow } from '@/components/working-list'

const NameSchema = z.string().min(1)

/**
 * A record's name: its visible, non-unique text attributes (first two), so
 * names read like "Jane Doe" rather than a generated ID. Falls back to the id.
 */
export const recordLabel = (
    row: WorkingListDisplayRow,
    labelFieldIds: readonly string[]
) =>
    labelFieldIds
        .slice(0, 2)
        .flatMap((id) => {
            const cell = row.values[id]
            const name = cell?.valid
                ? NameSchema.safeParse(cell.value)
                : undefined
            return name?.success ? [name.data] : []
        })
        .join(' ') || row.id
