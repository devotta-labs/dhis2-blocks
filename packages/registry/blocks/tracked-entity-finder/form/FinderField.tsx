import React from 'react'
import { ConfigError } from './ConfigError'
import { useFieldPart, type FinderFieldPartProps } from './fieldProps'
import { BooleanSelect, OptionSelect } from './inputs/ChoiceSelect'
import { DateInput } from './inputs/DateInput'
import { NumberInput } from './inputs/NumberInput'
import { PendingInput } from './inputs/PendingInput'
import { TextInput } from './inputs/TextInput'
import { TrueOnlyCheckbox } from './inputs/TrueOnlyCheckbox'

export type FinderFieldProps = FinderFieldPartProps

/**
 * One attribute searched by exact value, with the input its value type
 * needs. Use inside `FinderForm`.
 */
export function FinderField(props: FinderFieldProps) {
    const part = useFieldPart(props, 'exact')
    if (part.state === 'problem') {
        return (
            <ConfigError className={props.className}>
                {part.message}
            </ConfigError>
        )
    }
    if (part.state === 'pending') {
        return <PendingInput label={part.label} className={props.className} />
    }
    const { input } = part
    switch (input.attribute.kind) {
        case 'text':
            return <TextInput {...input} />
        case 'option':
            return <OptionSelect {...input} />
        case 'boolean':
            return <BooleanSelect {...input} />
        case 'trueOnly':
            return <TrueOnlyCheckbox {...input} />
        case 'number':
            return <NumberInput {...input} />
        case 'date':
        case 'dateTime':
            return <DateInput {...input} />
        case 'unsupported':
            // The rules report an unsupported type as a problem first.
            return null
    }
}
