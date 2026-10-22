import i18n from '@dhis2/d2-i18n'
import React, { useId, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/registry/dhis2/ui/button'
import type { TimelineEntry } from '../../core/types'
import { TimelineItem, TimelineTime } from '../../ui/TimelineParts'
import type { NoteEntryData } from '../useEnrollmentSources'

/** Whether the text is taller than the box that clamps it. */
const useIsClamped = (expanded: boolean, text: string) => {
    const ref = useRef<HTMLParagraphElement>(null)
    const [clamped, setClamped] = useState(false)
    useLayoutEffect(() => {
        const element = ref.current
        if (element === null || expanded) {
            return
        }
        const measure = () =>
            setClamped(element.scrollHeight > element.clientHeight + 1)
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
    }, [expanded, text])
    return { ref, clamped }
}

/** An enrollment note: its text (clamped when long), author and time. */
export const TimelineNoteEntry = ({
    entry,
}: {
    entry: TimelineEntry<NoteEntryData>
}) => {
    const { note } = entry.data
    const [expanded, setExpanded] = useState(false)
    const textId = useId()
    const { ref, clamped } = useIsClamped(expanded, note.value)
    const author = note.createdBy?.displayName ?? note.storedBy
    return (
        <TimelineItem entry={entry}>
            <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    {author === undefined ? null : (
                        <span className="font-medium text-dhis2-grey-900">
                            {author}
                        </span>
                    )}
                    <TimelineTime entry={entry} />
                </div>
                <p
                    ref={ref}
                    id={textId}
                    data-slot="note-text"
                    className={
                        expanded
                            ? 'm-0 text-sm whitespace-pre-wrap text-dhis2-grey-900'
                            : 'm-0 line-clamp-3 text-sm whitespace-pre-wrap text-dhis2-grey-900'
                    }
                >
                    {note.value}
                </p>
                {clamped || expanded ? (
                    <div>
                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            aria-expanded={expanded}
                            aria-controls={textId}
                            onClick={() => setExpanded(!expanded)}
                        >
                            {expanded
                                ? i18n.t('Show less')
                                : i18n.t('Show more')}
                        </Button>
                    </div>
                ) : null}
            </div>
        </TimelineItem>
    )
}
