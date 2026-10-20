import React, { memo, type ComponentType, type ReactNode } from 'react'
import { cn } from '@/registry/dhis2/ui/cn'
import {
    useEventFormInternal,
    useSectionModel,
} from './EventForm/EventFormContext'
import { EventFormField } from './EventFormField'

export interface EventFormFieldWrapperProps {
    fieldId: string
    /** A rule hides the field: `children` renders nothing, so show a placeholder or nothing. */
    hidden: boolean
    /** The block's field. */
    children: ReactNode
}

export interface EventFormHiddenSectionProps {
    sectionId: string
    name: string
}

/**
 * Hooks for a host that adds to the block's sections, such as rule annotations. Pass components
 * defined once (at module level), not inline, or every section re-renders on every render.
 */
export interface EventFormSectionSlots {
    /**
     * Wraps every field of the section. With it, fields a rule hides are passed too, marked
     * `hidden`, so the host can show them in place.
     */
    FieldWrapper?: ComponentType<EventFormFieldWrapperProps>
    /** Rendered in place of a section a rule hides. Without it a hidden section renders nothing. */
    HiddenSection?: ComponentType<EventFormHiddenSectionProps>
}

export interface EventFormSectionProps extends EventFormSectionSlots {
    /** The program stage section id. */
    id: string
    className?: string
}

/**
 * One section of the stage: its heading and its visible fields, in metadata order. Renders
 * nothing when a rule hides the section or every field in it, unless the slots ask for hidden
 * parts. It subscribes to its own section model, so answering a question re-renders the section
 * only when its list of fields changes.
 */
export const EventFormSection = memo(function EventFormSection({
    id,
    className,
    FieldWrapper,
    HiddenSection,
}: EventFormSectionProps) {
    const section = useSectionModel(id)
    const { sectionHeadingId } = useEventFormInternal('EventFormSection')
    if (section === undefined) {
        return null
    }
    if (section.hidden) {
        return HiddenSection === undefined ? null : (
            <HiddenSection sectionId={id} name={section.name} />
        )
    }
    const fieldIds =
        FieldWrapper === undefined ? section.fieldIds : section.allFieldIds
    if (fieldIds.length === 0) {
        return null
    }
    const visible = new Set(section.fieldIds)
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
            {fieldIds.map((fieldId) =>
                FieldWrapper === undefined ? (
                    <EventFormField key={fieldId} id={fieldId} />
                ) : (
                    <FieldWrapper
                        key={fieldId}
                        fieldId={fieldId}
                        hidden={!visible.has(fieldId)}
                    >
                        <EventFormField id={fieldId} />
                    </FieldWrapper>
                )
            )}
        </section>
    )
})
