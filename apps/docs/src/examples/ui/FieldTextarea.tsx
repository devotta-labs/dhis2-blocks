import {
    Field,
    FieldDescription,
    FieldLabel,
} from '@/components/dhis2/ui/field'
import { Textarea } from '@/components/dhis2/ui/textarea'

/** A few lines of free text, with a line on who reads it. */
const FieldTextarea = () => (
    <Field className="max-w-md">
        <FieldLabel htmlFor="clinical-notes">Clinical notes</FieldLabel>
        <Textarea
            id="clinical-notes"
            placeholder="For example, mild dehydration, given ORS"
        />
        <FieldDescription>
            Shown to the next health worker who opens this record.
        </FieldDescription>
    </Field>
)

export default FieldTextarea
