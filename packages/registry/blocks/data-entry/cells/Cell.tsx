import i18n from '@dhis2/d2-i18n'
import { memo } from 'react'
import { cellKind } from '@/components/dhis2-value-types'
import { useCellEffects } from '../provider/context'
import type { CellProps } from './cellProps'
import { BooleanCell, TrueOnlyCell } from './ChoiceCells'
import { OptionCell } from './OptionCell'
import { TextCell } from './TextCell'

// A cell with no control: greyed, skipped by the arrows, its reason read out.
const ClosedCell = ({ reason }: { reason: string }) => (
    <div className="h-9 bg-dhis2-grey-200">
        <span className="sr-only">{reason}</span>
    </div>
)

// One control whatever a rule does to the cell, so focus stays where it is.
const OpenCell = (props: CellProps) => {
    const { hiddenBy, readOnly } = useCellEffects(props.cellKey)
    const kind = cellKind(props.field)
    const reason =
        hiddenBy ??
        readOnly ??
        (kind === 'popup' || kind === 'readOnly'
            ? i18n.t('Edit this field in its own form')
            : undefined)
    const Control =
        kind === 'boolean'
            ? BooleanCell
            : kind === 'trueOnly'
              ? TrueOnlyCell
              : kind === 'option'
                ? OptionCell
                : TextCell
    return (
        <Control {...props} readOnly={reason} hidden={hiddenBy !== undefined} />
    )
}

/**
 * The cell for a field: closed, or one control that is typed, read-only (a rule, or a value type edited elsewhere) or
 * hidden by a rule. `closedReason` arrives translated.
 */
export const Cell = memo(function Cell({
    closedReason,
    ...props
}: CellProps & { closedReason?: string }) {
    return closedReason === undefined ? (
        <OpenCell {...props} />
    ) : (
        <ClosedCell reason={closedReason} />
    )
})
