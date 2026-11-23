import {
    Field,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'

/** Fields that belong together under one legend, two of them side by side. */
const FieldFieldset = () => (
    <FieldSet className="max-w-md">
        <FieldLegend>Home location</FieldLegend>
        <FieldGroup>
            <Field>
                <FieldLabel htmlFor="village">Village or street</FieldLabel>
                <Input id="village" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
                <Field>
                    <FieldLabel htmlFor="chiefdom">Chiefdom</FieldLabel>
                    <Input id="chiefdom" />
                </Field>
                <Field>
                    <FieldLabel htmlFor="district">District</FieldLabel>
                    <Input id="district" />
                </Field>
            </div>
        </FieldGroup>
    </FieldSet>
)

export default FieldFieldset
