import i18n from '@dhis2/d2-i18n'
import type { TallyIndex } from '../core/layout'
import { formatCount } from './format'

const columnName = (labels: readonly string[]) =>
    labels.reduce((before, label) =>
        i18n.t('{{before}}, {{label}}', {
            before,
            label,
            interpolation: { escapeValue: false },
        })
    )

const place = (index: TallyIndex, cell: number) => {
    const size = index.columns.length
    const row = index.rows[Math.floor(cell / size)]
    return {
        group: row?.group,
        row: row?.label ?? '',
        column: columnName(index.columns[cell % size]?.labels ?? ['']),
    }
}

export const tappedMessage = (
    index: TallyIndex,
    cell: number,
    count: number
) => {
    const { group, row, column } = place(index, cell)
    const marks = formatCount(count)
    if (group === undefined) {
        return i18n.t('{{row}}, {{column}}: {{marks}}', {
            row,
            column,
            marks,
            interpolation: { escapeValue: false },
        })
    }
    return i18n.t('{{group}}, {{row}}, {{column}}: {{marks}}', {
        group,
        row,
        column,
        marks,
        interpolation: { escapeValue: false },
    })
}

export const undoneMessage = (
    index: TallyIndex,
    cells: readonly number[],
    counts: readonly number[]
) => {
    const [cell] = cells
    if (cell === undefined) return ''
    if (cells.length > 1) {
        return i18n.t('{{count}} corrections undone', { count: cells.length })
    }
    const { group, row, column } = place(index, cell)
    const marks = formatCount(counts[cell] ?? 0)
    if (group === undefined) {
        return i18n.t('Undone: {{row}}, {{column}}, now {{marks}}', {
            row,
            column,
            marks,
            interpolation: { escapeValue: false },
        })
    }
    return i18n.t('Undone: {{group}}, {{row}}, {{column}}, now {{marks}}', {
        group,
        row,
        column,
        marks,
        interpolation: { escapeValue: false },
    })
}

export const changedMessage = (count: number) => {
    if (count === 0) return i18n.t('No counts changed')
    return count === 1
        ? i18n.t('{{count}} count changed', { count })
        : i18n.t('{{count}} counts changed', { count })
}
