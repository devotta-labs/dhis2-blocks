import i18n from '@dhis2/d2-i18n'
import { memo, useMemo, useState } from 'react'
import { cellKind } from '@/components/dhis2-value-types'
import type { CellKind, Field } from '@/components/dhis2-value-types'
import { useCellView, useDataEntryContext } from '../provider/context'
import { cellDomId } from './cellProps'
import type { CellComponent, CellOverrides, CellProps } from './cellProps'
import { CellNotes, CellStatus, describeCell } from './CellStatus'
import { BooleanCell, TrueOnlyCell } from './ChoiceCells'
import { OptionCell } from './OptionCell'
import { PopupCell } from './PopupCell'
import { editorFor } from './popupEditors'
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
    popup: PopupCell,
    readOnly: TextCell,
} satisfies Record<CellKind, CellComponent>)

/** The control that replaces the default one for a column's field: by the field's id, else by its value type. */
export const replacementFor = (
    overrides: CellOverrides | undefined,
    column: string,
    field: Field
) => overrides?.fields?.[column] ?? overrides?.valueTypes?.[field.valueType]

// One control whatever a rule does to the cell, so focus stays where it is.
const OpenCell = (props: CellProps) => {
    const view = useCellView(props.cellKey)
    const { hiddenBy, readOnly } = view.effects
    const { overrides, idScope, settings } = useDataEntryContext()
    const kind = cellKind(props.field)
    const column = props.cellKey.slice(props.cellKey.indexOf('.') + 1)
    const replacement = replacementFor(overrides, column, props.field)
    // A value type no default control edits (unknown, or a pop-up type without an editor) is edited elsewhere; a
    // replacement is how a host edits it here.
    const elsewhere =
        replacement === undefined &&
        (kind === 'readOnly' ||
            (kind === 'popup' &&
                editorFor(props.field.valueType) === undefined))
            ? i18n.t('Edit this field in its own form')
            : undefined
    const reason = hiddenBy ?? readOnly ?? elsewhere
    // An empty date says how to type it.
    const hint =
        replacement === undefined &&
        view.value === undefined &&
        (kind === 'date' || kind === 'dateTime')
            ? i18n.t('Date format: {{format}}', {
                  nsSeparator: '::',
                  format:
                      kind === 'date'
                          ? settings.dateFormat
                          : `${settings.dateFormat} HH:mm`,
              })
            : undefined
    const id = cellDomId(idScope, props.cellKey)
    const { notes, aria } = describeCell(id, view, reason, hint)
    // Escape hides the notes until focus next enters the cell (WCAG 1.4.13).
    const [dismissed, setDismissed] = useState(false)
    const shown = notes.length > 0 && !dismissed
    const cellNotes = useMemo(
        () => ({ shown, show: () => setDismissed(false) }),
        [shown]
    )
    const Control = replacement ?? cells[kind]
    return (
        <div
            className="group/cell relative focus-within:[anchor-name:--data-entry-cell]"
            onFocus={() => setDismissed(false)}
            onKeyDown={(event) => {
                if (
                    event.key === 'Escape' &&
                    !event.nativeEvent.defaultPrevented
                ) {
                    setDismissed(true)
                }
            }}
        >
            <CellNotes.Provider value={cellNotes}>
                <Control
                    {...props}
                    id={id}
                    readOnly={reason}
                    hidden={hiddenBy !== undefined}
                    aria={aria}
                />
            </CellNotes.Provider>
            <CellStatus view={view} notes={notes} dismissed={dismissed} />
        </div>
    )
}

/**
 * The cell for a field: closed, or one control that is typed, read-only (a rule, or a value type edited elsewhere) or
 * hidden by a rule, with the cell's notes, required marker and sync state around it. `closedReason` arrives translated.
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
