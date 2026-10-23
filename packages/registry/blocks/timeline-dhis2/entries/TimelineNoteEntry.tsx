import i18n from '@dhis2/d2-i18n'
import React, {
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type ComponentPropsWithoutRef,
} from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import type { TimelineEntry } from '@/components/timeline/core/types'
import { TimelineTime } from '@/components/timeline/ui/TimelineParts'
import { useSpansPrograms } from '../useSpansPrograms'
import type { NoteEntryData } from '../types'

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

/** An enrollment note: its text (clamped when long), then author, program and time. */
export const TimelineNoteEntry = ({
    entry,
    className,
    ...props
}: ComponentPropsWithoutRef<'div'> & {
    entry: TimelineEntry<NoteEntryData>
}) => {
    const { note } = entry.data
    const spansPrograms = useSpansPrograms()
    const [expanded, setExpanded] = useState(false)
    const textId = useId()
    const { ref, clamped } = useIsClamped(expanded, note.value)
    const author = note.createdBy?.displayName ?? note.storedBy
    return (
        <div
            {...props}
            data-slot="timeline-note"
            data-marker="dot"
            className={cn('flex flex-col gap-1', className)}
        >
            <p
                ref={ref}
                id={textId}
                data-slot="timeline-note-text"
                className={
                    expanded
                        ? 'm-0 text-sm whitespace-pre-wrap text-dhis2-grey-900'
                        : 'm-0 line-clamp-3 text-sm whitespace-pre-wrap text-dhis2-grey-900'
                }
            >
                {note.value}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-dhis2-grey-700 [&>*+*]:before:pe-1.5 [&>*+*]:before:content-['·']">
                {author === undefined ? null : <span>{author}</span>}
                {spansPrograms ? (
                    <span>
                        {entry.data.program?.name ??
                            entry.data.enrollment.program}
                    </span>
                ) : null}
                <TimelineTime entry={entry} />
                {clamped || expanded ? (
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto border-0 p-0 text-sm! leading-5 tracking-normal"
                        aria-expanded={expanded}
                        aria-controls={textId}
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? i18n.t('Show less') : i18n.t('Show more')}
                    </Button>
                ) : null}
            </div>
        </div>
    )
}
