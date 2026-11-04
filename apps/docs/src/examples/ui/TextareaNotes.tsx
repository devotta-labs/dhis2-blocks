import { useState } from 'react'
import {
    Field,
    FieldDescription,
    FieldLabel,
} from '@/components/dhis2/ui/field'
import { Textarea } from '@/components/dhis2/ui/textarea'

const LIMIT = 500

/** A note of a few lines, with a count of the characters left. */
const TextareaNotes = () => {
    const [note, setNote] = useState('')

    return (
        <Field className="max-w-md">
            <FieldLabel htmlFor="visit-note">
                Note for the next visit
            </FieldLabel>
            <Textarea
                id="visit-note"
                maxLength={LIMIT}
                placeholder="For example, check the blood pressure again"
                value={note}
                onChange={(event) => setNote(event.target.value)}
            />
            <FieldDescription>
                {LIMIT - note.length} characters left
            </FieldDescription>
        </Field>
    )
}

export default TextareaNotes
