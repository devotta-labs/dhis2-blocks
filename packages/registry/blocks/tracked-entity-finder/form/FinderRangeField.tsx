import React from 'react'
import { MetadataErrorNotice } from './MetadataErrorNotice'
import { useFieldPart, type FinderFieldPartProps } from './fieldProps'
import { PendingInput } from './inputs/PendingInput'
import { DateRangeInput, NumberRangeInput } from './inputs/RangeInputs'

export type FinderRangeFieldProps = FinderFieldPartProps

/**
 * One number or date attribute searched From–To; either side alone counts.
 * Use inside `FinderForm`.
 */
export function FinderRangeField(props: FinderRangeFieldProps) {
    const part = useFieldPart(props, 'range')
    if (part.state === 'metadata-error') {
        return (
            <MetadataErrorNotice className={props.className}>
                {part.message}
            </MetadataErrorNotice>
        )
    }
    if (part.state === 'pending') {
        return <PendingInput label={part.label} className={props.className} />
    }
    const { input } = part
    switch (input.attribute.kind) {
        case 'number':
            return <NumberRangeInput {...input} />
        case 'date':
        case 'dateTime':
            return <DateRangeInput {...input} />
        default:
            // The rules report any other kind as a metadata error first.
            return null
    }
}
