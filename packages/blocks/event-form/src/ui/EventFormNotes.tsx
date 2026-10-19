import React, { useId, useMemo } from 'react'
import { useStore } from 'zustand'
import { Card, CardHeader, CardTitle } from '@/registry/dhis2/ui/card'
import { Textarea } from '@/registry/dhis2/ui/textarea'
import type { SystemCalendar } from '../api/schemas'
import {
    useEventFormFieldContext,
    useEventFormInternal,
} from './EventForm/EventFormContext'
import { useEventFormText } from './EventFormText'
import {
    canonicalDateToCalendarInput,
    isoToCalendarDate,
} from './fields/calendar'

/** The date part of a timestamp, as the system calendar writes it. */
const noteDate = (storedAt: string, calendar: SystemCalendar) => {
    const iso = storedAt.slice(0, 10)
    return (
        canonicalDateToCalendarInput(
            isoToCalendarDate(iso, calendar.calendar) ?? iso,
            calendar.dateFormat
        ) ?? iso
    )
}

/**
 * The event's notes, newest first, and a box for a new one. Notes cannot be changed once saved;
 * the new note is sent with the next save.
 */
export const EventFormNotes = ({ className }: { className?: string }) => {
    const translate = useEventFormText()
    const { store, notes } = useEventFormInternal('EventFormNotes')
    const { readOnly, calendar } = useEventFormFieldContext()
    const draft = useStore(store, (state) => state.noteDraft)
    const textareaId = useId()
    const newestFirst = useMemo(
        () => [...notes].sort((a, b) => b.storedAt.localeCompare(a.storedAt)),
        [notes]
    )
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>
                    <h2 className="m-0 text-base leading-snug font-medium">
                        {translate('Notes')}
                    </h2>
                </CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-3 px-4">
                {newestFirst.length > 0 && (
                    <ul className="m-0 flex list-none flex-col gap-3 p-0">
                        {newestFirst.map((note) => (
                            <li
                                key={note.note}
                                className="flex flex-col gap-0.5 border-b border-dhis2-grey-300 pb-2"
                            >
                                <p className="m-0 text-sm whitespace-pre-line text-dhis2-grey-900">
                                    {note.value}
                                </p>
                                <p className="m-0 text-xs text-dhis2-grey-700">
                                    {note.createdBy?.displayName ??
                                        note.createdBy?.username}{' '}
                                    <time dateTime={note.storedAt}>
                                        {noteDate(note.storedAt, calendar)}
                                    </time>
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
                <label
                    htmlFor={textareaId}
                    className="text-sm font-medium text-dhis2-grey-900"
                >
                    {translate('Notes about this event')}
                </label>
                <Textarea
                    id={textareaId}
                    value={draft}
                    disabled={readOnly}
                    onChange={(event) =>
                        store.getState().setNoteDraft(event.target.value)
                    }
                />
            </div>
        </Card>
    )
}
