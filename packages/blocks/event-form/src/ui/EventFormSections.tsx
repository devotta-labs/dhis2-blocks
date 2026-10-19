import React from 'react'
import { useSectionModels } from './EventForm/EventFormContext'
import { EventFormSection } from './EventFormSection'

/** Every section of the stage, in metadata order. Hidden sections render nothing. */
export const EventFormSections = () => {
    const sections = useSectionModels()
    return (
        <>
            {sections.map((section) => (
                <EventFormSection key={section.id} id={section.id} />
            ))}
        </>
    )
}
