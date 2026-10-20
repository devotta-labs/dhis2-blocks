import React from 'react'
import { useSectionModels } from './EventForm/EventFormContext'
import {
    EventFormSection,
    type EventFormSectionSlots,
} from './EventFormSection'

/**
 * Every section of the stage, in metadata order. Hidden sections render nothing, unless
 * `HiddenSection` is given; `FieldWrapper` wraps every field (see `EventFormSectionSlots`).
 */
export const EventFormSections = ({
    FieldWrapper,
    HiddenSection,
}: EventFormSectionSlots) => {
    const sections = useSectionModels()
    return (
        <>
            {sections.map((section) => (
                <EventFormSection
                    key={section.id}
                    id={section.id}
                    FieldWrapper={FieldWrapper}
                    HiddenSection={HiddenSection}
                />
            ))}
        </>
    )
}
