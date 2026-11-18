import i18n from '@dhis2/d2-i18n'
import {
    Field,
    FieldDescription,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from '@/components/dhis2/ui/field'
import { Textarea } from '@/components/dhis2/ui/textarea'
import { formatDhis2Value } from '@/components/dhis2-value-display'
import { useEventFormContext } from './context'

/**
 * The event's notes, oldest first, each with who wrote it and when, and a box for one more, sent with the next Save
 * or Complete. DHIS2 only adds notes, so the ones listed cannot be changed. A read-only form lists them without the box.
 */
export const EventFormNotes = () => {
    const { state, settings, readOnly, locked, writeNote, formId } =
        useEventFormContext()
    return (
        <FieldSet>
            <FieldLegend>{i18n.t('Notes')}</FieldLegend>
            {state.notes.length === 0 ? null : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {state.notes.map((note) => (
                        <li key={note.note} className="flex flex-col gap-0.5">
                            <p className="m-0 text-sm whitespace-pre-wrap text-dhis2-foreground">
                                {note.value}
                            </p>
                            <p className="m-0 text-sm text-dhis2-muted-foreground">
                                {note.yours
                                    ? i18n.t('You')
                                    : (note.createdBy?.displayName ??
                                      note.storedBy)}
                                {note.storedAt === undefined ? null : (
                                    <>
                                        {' · '}
                                        <time dateTime={note.storedAt}>
                                            {formatDhis2Value(
                                                note.storedAt,
                                                { valueType: 'DATETIME' },
                                                { calendar: settings.calendar }
                                            )}
                                        </time>
                                    </>
                                )}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
            {readOnly === undefined ? (
                <Field>
                    <FieldLabel>{i18n.t('Add a note')}</FieldLabel>
                    <Textarea
                        id={`${formId}-note`}
                        value={state.note.text}
                        readOnly={locked !== undefined}
                        onChange={(event) => writeNote(event.target.value)}
                    />
                    {locked === undefined ? null : (
                        <FieldDescription className="sr-only">
                            {locked}
                        </FieldDescription>
                    )}
                </Field>
            ) : null}
        </FieldSet>
    )
}
