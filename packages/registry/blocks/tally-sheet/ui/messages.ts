import i18n from '@dhis2/d2-i18n'
import type { TallyIndex } from '../core/layout'
import { formatCount } from './format'

const joined = (parts: readonly string[]) =>
    parts.slice(1).reduce(
        (before, label) =>
            i18n.t('{{before}}, {{label}}', {
                before,
                label,
                interpolation: { escapeValue: false },
            }),
        parts[0] ?? ''
    )

const place = (index: TallyIndex, cell: number) => {
    const size = index.columns.length
    const row = index.rows[Math.floor(cell / size)]
    return joined([
        ...(row?.group === undefined ? [] : [row.group]),
        row?.label ?? '',
        ...(index.columns[cell % size]?.labels ?? []),
    ])
}

export const tappedMessage = (index: TallyIndex, cell: number, count: number) =>
    i18n.t('{{place}}: {{marks}}', {
        place: place(index, cell),
        marks: formatCount(count),
        interpolation: { escapeValue: false },
    })

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
    return i18n.t('Undone: {{place}}, now {{marks}}', {
        place: place(index, cell),
        marks: formatCount(counts[cell] ?? 0),
        interpolation: { escapeValue: false },
    })
}

export const changedMessage = (count: number) => {
    if (count === 0) return i18n.t('No counts changed')
    return count === 1
        ? i18n.t('{{count}} count changed', { count })
        : i18n.t('{{count}} counts changed', { count })
}
