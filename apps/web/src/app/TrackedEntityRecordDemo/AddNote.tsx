import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/dhis2/ui/card'
import { Spinner } from '@/components/dhis2/ui/spinner'
import { Textarea } from '@/components/dhis2/ui/textarea'
import {
    useTrackedEntityRecord,
    type Enrollment,
    type ProgramInfo,
} from '@/components/tracked-entity-record'
import { useDataEngine } from '@dhis2/app-runtime'
import React, { useId, useState } from 'react'
import i18n from '../../i18n'

type EnrollmentNotesProps = { enrollment: Enrollment }
type AddNoteProps = { program: ProgramInfo; enrollment: Enrollment }

/** Recipe: the enrollment's notes, read from the record like every other view. */
export const EnrollmentNotes = ({ enrollment }: EnrollmentNotesProps) => (
    <Card data-testid="notes">
        <CardHeader>
            <CardTitle>{i18n.t('Notes')}</CardTitle>
        </CardHeader>
        <CardContent>
            {enrollment.notes.length === 0 ? (
                <p className="m-0 text-sm">{i18n.t('No notes yet.')}</p>
            ) : (
                <ul className="m-0 grid list-none gap-2 p-0">
                    {enrollment.notes.map((note) => (
                        <li key={note.note} className="text-sm">
                            {note.value}
                        </li>
                    ))}
                </ul>
            )}
        </CardContent>
    </Card>
)

/**
 * Recipe: the smallest real write. It adds a note to the enrollment, then
 * awaits `refresh()` so every view under the provider shows it.
 */
export const AddNote = ({ program, enrollment }: AddNoteProps) => {
    const { actions, meta } = useTrackedEntityRecord()
    const engine = useDataEngine()
    const textId = useId()
    const [text, setText] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string>()

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        setSaving(true)
        setError(undefined)
        try {
            await engine.mutate({
                resource: 'tracker',
                type: 'create',
                params: { async: false, importStrategy: 'CREATE_AND_UPDATE' },
                data: {
                    enrollments: [
                        {
                            enrollment: enrollment.id,
                            trackedEntity: meta.trackedEntityId,
                            program: program.id,
                            orgUnit: enrollment.orgUnit,
                            status: enrollment.status,
                            enrolledAt: enrollment.enrolledAt,
                            occurredAt: enrollment.occurredAt,
                            // The server assigns the note id.
                            notes: [{ value: text.trim() }],
                        },
                    ],
                },
            })
            await actions.refresh()
            setText('')
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : i18n.t('The note could not be added.')
            )
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={submit} className="flex flex-col gap-2">
            <label htmlFor={textId} className="text-sm">
                {i18n.t('Add a note to this enrollment')}
            </label>
            <Textarea
                id={textId}
                data-testid="add-note-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
            />
            <div className="flex items-center gap-2">
                <Button
                    type="submit"
                    data-testid="add-note"
                    disabled={saving || text.trim() === ''}
                >
                    {saving && <Spinner aria-label={i18n.t('Saving')} />}
                    {i18n.t('Add note')}
                </Button>
            </div>
            {error && (
                <ErrorAlert title={i18n.t('The note could not be added.')}>
                    {error}
                </ErrorAlert>
            )}
        </form>
    )
}
