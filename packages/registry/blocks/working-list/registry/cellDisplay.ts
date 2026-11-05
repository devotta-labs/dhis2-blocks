import { z } from 'zod'
import { localizedField } from '../domain/filterControlPolicy'
import type { WorkingListField } from '../domain/model'
import type { WorkingListTranslate } from '../domain/translation'
import type { WorkingListCellValue } from '../query/normalizeRows'
import {
    getCellDisplayValue,
    type CellDisplayValue,
    type CellFormattingContext,
} from './valueTypes'

const ScalarSchema = z.union([z.string(), z.number(), z.boolean()])

export const visibleCellDisplay = (
    cell: WorkingListCellValue | undefined,
    field: WorkingListField,
    formattingContext: CellFormattingContext | undefined,
    translate: WorkingListTranslate
): CellDisplayValue => {
    if (cell && !cell.valid) {
        if (cell.raw == null || cell.raw === '')
            return { kind: 'empty', text: '' }
        const scalar = ScalarSchema.safeParse(cell.raw)
        return {
            kind: 'text',
            text: scalar.success ? String(scalar.data) : '-',
        }
    }
    const display = getCellDisplayValue(
        cell?.value,
        localizedField(field, translate),
        formattingContext
    )
    return display.kind === 'image'
        ? { ...display, alt: display.alt || translate('Image attachment') }
        : display
}

export const visibleCellText = (display: CellDisplayValue) =>
    display.kind === 'image' ? display.alt : display.text
