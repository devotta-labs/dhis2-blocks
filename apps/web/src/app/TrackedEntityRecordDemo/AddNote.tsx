import {
    Alert,
    AlertDescription,
    AlertTitle,
    ErrorAlert,
} from '@/components/dhis2/ui/alert'
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
import { useConfig, useDataEngine } from '@dhis2/app-runtime'
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

/** What the last submit came to: the write and the refresh after it are separate. */
type Outcome =
    | { kind: 'idle' }
    | { kind: 'saved' }
    | { kind: 'not-refreshed' }
    | { kind: 'failed'; message: string }

/**
 * Recipe: the smallest real write. It adds a note to the enrollment, then
 * awaits `refresh()` so every view under the provider shows it. A refresh
 * that fails after a saved note is reported as such, so nobody saves it twice.
 */
export const AddNote = ({ program, enrollment }: AddNoteProps) => {
    const { actions, meta } = useTrackedEntityRecord()
    const engine = useDataEngine()
    const { serverVersion } = useConfig()
    const textId = useId()
    const [text, setText] = useState('')
    const [saving, setSaving] = useState(false)
    const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' })

    const writeNote = (value: string) => {
        // 2.42+: a note endpoint that changes nothing else on the enrollment.
        if ((serverVersion?.minor ?? 0) >= 42) {
            return engine.mutate({
                resource: `tracker/enrollments/${enrollment.id}/note`,
                type: 'create',
                data: { value },
            })
        }
        // 2.41 has no note endpoint, and its importer resets what the payload
        // leaves out (followUp), so send every enrollment field the record has.
        // The record has no geometry: a stored enrollment location is cleared.
        return engine.mutate({
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
                        completedAt: enrollment.completedAt,
                        followUp: enrollment.followUp,
                        // The server assigns the note id.
                        notes: [{ value }],
                    },
                ],
            },
        })
    }

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        setSaving(true)
        setOutcome({ kind: 'idle' })
        try {
            await writeNote(text.trim())
        } catch (cause) {
            setOutcome({
                kind: 'failed',
                message:
                    cause instanceof Error
                        ? cause.message
                        : i18n.t('The note could not be added.'),
            })
            setSaving(false)
            return
        }
        // The note is saved: never offer to save it again.
        setText('')
        try {
            await actions.refresh()
            setOutcome({ kind: 'saved' })
        } catch {
            setOutcome({ kind: 'not-refreshed' })
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
            {outcome.kind === 'saved' && (
                <p role="status" className="m-0 text-sm">
                    {i18n.t('Note added.')}
                </p>
            )}
            {outcome.kind === 'not-refreshed' && (
                <Alert variant="warning" data-testid="add-note-not-refreshed">
                    <AlertTitle>
                        {i18n.t(
                            'Saved, but the record could not be refreshed.'
                        )}
                    </AlertTitle>
                    <AlertDescription>
                        {i18n.t(
                            'The note is saved. Refresh the record to see it.'
                        )}
                    </AlertDescription>
                </Alert>
            )}
            {outcome.kind === 'failed' && (
                <ErrorAlert title={i18n.t('The note could not be added.')}>
                    {outcome.message}
                </ErrorAlert>
            )}
        </form>
    )
}
