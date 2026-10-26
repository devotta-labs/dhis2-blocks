import i18n from '@dhis2/d2-i18n'
import { memo } from 'react'
import { cellKind } from '@/components/dhis2-value-types'
import type { CellKind } from '@/components/dhis2-value-types'
import { useCellEffects, useDataEntryContext } from '../provider/context'
import { cellDomId } from './cellProps'
import type { CellComponent, CellProps } from './cellProps'
import { BooleanCell, TrueOnlyCell } from './ChoiceCells'
import { OptionCell } from './OptionCell'
import { TextCell } from './TextCell'

// A cell with no control: greyed, skipped by the arrows, its reason read out.
const ClosedCell = ({ reason }: { reason: string }) => (
    <div className="h-9 bg-dhis2-grey-200">
        <span className="sr-only">{reason}</span>
    </div>
)

/** The default control for each kind of field. */
export const cells = Object.freeze({
    text: TextCell,
    number: TextCell,
    date: TextCell,
    dateTime: TextCell,
    time: TextCell,
    boolean: BooleanCell,
    trueOnly: TrueOnlyCell,
    option: OptionCell,
    popup: TextCell,
    readOnly: TextCell,
} satisfies Record<CellKind, CellComponent>)

// One control whatever a rule does to the cell, so focus stays where it is.
const OpenCell = (props: CellProps) => {
    const { hiddenBy, readOnly } = useCellEffects(props.cellKey)
    const { overrides } = useDataEntryContext()
    const kind = cellKind(props.field)
    const column = props.cellKey.slice(props.cellKey.indexOf('.') + 1)
    const replacement =
        overrides?.fields?.[column] ??
        overrides?.valueTypes?.[props.field.valueType]
    // A value type edited elsewhere is the default controls' reason; a replacement is how a host edits it here.
    const elsewhere =
        replacement === undefined && (kind === 'popup' || kind === 'readOnly')
            ? i18n.t('Edit this field in its own form')
            : undefined
    const reason = hiddenBy ?? readOnly ?? elsewhere
    const Control = replacement ?? cells[kind]
    return (
        <Control
            {...props}
            id={cellDomId(props.cellKey)}
            readOnly={reason}
            hidden={hiddenBy !== undefined}
        />
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
