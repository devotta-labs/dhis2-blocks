import { cellKind } from '@/components/dhis2-value-types'
import type { Field } from '@/components/dhis2-value-types'
import { editorFor } from '@/components/dhis2-value-input'
import type { PopupValueType } from '@/components/dhis2-value-input'

/** Value types whose typed text parses, so paste can fill them. */
const pasteable: ReadonlySet<string> = new Set<PopupValueType>([
    'LONG_TEXT',
    'MULTI_TEXT',
    'AGE',
    'COORDINATE',
])

/** Whether a pasted block fills a field's cells: not read-only kinds, pop-up kinds without an editor or whose text does not parse, or usernames. */
export const takesPastedText = (field: Field) => {
    const kind = cellKind(field)
    if (kind === 'popup') {
        return (
            editorFor(field.valueType) !== undefined &&
            pasteable.has(field.valueType)
        )
    }
    // A username is checked against DHIS2 as it is typed, which paste cannot do.
    return kind !== 'readOnly' && field.valueType !== 'USERNAME'
}
