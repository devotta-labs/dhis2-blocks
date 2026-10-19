import React, { memo, useCallback } from 'react'
import {
    useEventFormFieldContext,
    useFieldModel,
} from './EventForm/EventFormContext'
import { AgeField } from './fields/AgeField'
import { ChoiceField } from './fields/ChoiceField'
import { CoordinateField } from './fields/CoordinateField'
import { DateField } from './fields/DateField'
import { DateTimeField } from './fields/DateTimeField'
import { LongTextField } from './fields/LongTextField'
import { MultiSelectField } from './fields/MultiSelectField'
import { NumberField } from './fields/NumberField'
import { OrgUnitField } from './fields/OrgUnitField'
import { SelectField } from './fields/SelectField'
import { TextField } from './fields/TextField'
import { TimeField } from './fields/TimeField'
import { TrueOnlyField } from './fields/TrueOnlyField'
import { UnsupportedField } from './fields/UnsupportedField'

/**
 * One data element of the stage: its label, description, messages and the widget for its value
 * type. It subscribes to its own model, so it re-renders only when that field changes. Renders
 * nothing for a field a rule hides or an id the stage does not have.
 */
export const EventFormField = memo(function EventFormField({
    id,
}: {
    id: string
}) {
    const field = useFieldModel(id)
    const { commit, readOnly } = useEventFormFieldContext()
    const onCommit = useCallback(
        (value: string | undefined) => commit(id, value),
        [commit, id]
    )
    if (field === undefined || field.hidden) {
        return null
    }
    const props = {
        field,
        onCommit,
        disabled: readOnly || field.disabled,
    }
    switch (field.kind) {
        case 'text':
            return <TextField {...props} />
        case 'longText':
            return <LongTextField {...props} />
        case 'number':
            return <NumberField {...props} />
        case 'choice':
            return <ChoiceField {...props} />
        case 'select':
            // A stage can ask for radio buttons however many options there are.
            return field.radioLayout === undefined ? (
                <SelectField {...props} />
            ) : (
                <ChoiceField {...props} />
            )
        case 'multiSelect':
            return <MultiSelectField {...props} />
        case 'trueOnly':
            return <TrueOnlyField {...props} />
        case 'date':
            return <DateField {...props} />
        case 'dateTime':
            return <DateTimeField {...props} />
        case 'time':
            return <TimeField {...props} />
        case 'age':
            return <AgeField {...props} />
        case 'coordinate':
            return <CoordinateField {...props} />
        case 'orgUnit':
            return <OrgUnitField {...props} />
        case 'unsupported':
            return <UnsupportedField {...props} />
    }
})
