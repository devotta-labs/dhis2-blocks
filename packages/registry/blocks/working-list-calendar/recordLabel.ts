/**
 * A record's default name: the text of the first two columns that have a
 * value, in the list's column order, so it follows what users see in the
 * table whatever the program models.
 */
export const defaultRecordLabel = (
    columnIds: readonly string[],
    cellText: (fieldId: string) => string
) =>
    columnIds
        .map((id) => cellText(id).trim())
        .filter(Boolean)
        .slice(0, 2)
        .join(' ')
