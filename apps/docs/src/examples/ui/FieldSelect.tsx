import {
    Field,
    FieldDescription,
    FieldLabel,
} from '@/components/dhis2/ui/field'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/dhis2/ui/select'

const visitTypes = [
    { value: 'FIRST', label: 'First visit' },
    { value: 'FOLLOW_UP', label: 'Follow-up' },
    { value: 'REFERRAL', label: 'Referred in' },
]

/** One choice from a list that stays closed until it is needed. */
const FieldSelect = () => (
    <Field className="max-w-xs">
        <FieldLabel htmlFor="visit-type">Visit type</FieldLabel>
        <Select items={visitTypes} defaultValue="FIRST">
            <SelectTrigger id="visit-type">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {visitTypes.map((visitType) => (
                    <SelectItem key={visitType.value} value={visitType.value}>
                        {visitType.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
        <FieldDescription>
            For a referral, keep the note from the other facility.
        </FieldDescription>
    </Field>
)

export default FieldSelect
