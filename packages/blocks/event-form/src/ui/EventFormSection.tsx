import React, { memo } from 'react'
import { cn } from '@/registry/dhis2/ui/cn'
import {
    useEventFormInternal,
    useSectionModel,
} from './EventForm/EventFormContext'
import { EventFormField } from './EventFormField'

export interface EventFormSectionProps {
    /** The program stage section id. */
    id: string
    className?: string
}

/**
 * One section of the stage: its heading and its visible fields, in metadata order. Renders
 * nothing when a rule hides the section or every field in it. It subscribes to its own section
 * model, so answering a question re-renders the section only when its list of fields changes.
 */
export const EventFormSection = memo(function EventFormSection({
    id,
    className,
}: EventFormSectionProps) {
    const section = useSectionModel(id)
    const { sectionHeadingId } = useEventFormInternal('EventFormSection')
    if (
        section === undefined ||
        section.hidden ||
        section.fieldIds.length === 0
    ) {
        return null
    }
    const headingId = sectionHeadingId(id)
    return (
        <section
            aria-labelledby={headingId}
            data-section-id={id}
            className={cn(
                'flex flex-col gap-4 rounded-dhis2-md bg-dhis2-card p-4 text-dhis2-card-foreground shadow-dhis2-card',
                className
            )}
        >
            <h2
                id={headingId}
                tabIndex={-1}
                className="m-0 scroll-mt-4 text-base leading-snug font-medium text-dhis2-grey-900 outline-none focus-visible:underline"
            >
                {section.name}
            </h2>
            {section.fieldIds.map((fieldId) => (
                <EventFormField key={fieldId} id={fieldId} />
            ))}
        </section>
    )
})
