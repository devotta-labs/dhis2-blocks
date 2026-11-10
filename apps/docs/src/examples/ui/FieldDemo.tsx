import { Button } from '@/components/dhis2/ui/button'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSeparator,
    FieldSet,
} from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/dhis2/ui/select'
import { Textarea } from '@/components/dhis2/ui/textarea'

const sexes = [
    { value: 'FEMALE', label: 'Female' },
    { value: 'MALE', label: 'Male' },
]

/** A registration form: fieldsets with a legend and a description, fields in groups, and the form's buttons. */
const FieldDemo = () => (
    <form
        className="w-full max-w-md"
        onSubmit={(event) => event.preventDefault()}
    >
        <FieldGroup>
            <FieldSet>
                <FieldLegend>Patient</FieldLegend>
                <FieldDescription>
                    As written on the patient&apos;s health card.
                </FieldDescription>
                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor="demo-name">Full name</FieldLabel>
                        <Input id="demo-name" autoComplete="off" />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                        <Field>
                            <FieldLabel htmlFor="demo-birth">
                                Date of birth
                            </FieldLabel>
                            <Input id="demo-birth" autoComplete="off" />
                            <FieldDescription>YYYY-MM-DD</FieldDescription>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="demo-sex">Sex</FieldLabel>
                            <Select items={sexes}>
                                <SelectTrigger id="demo-sex">
                                    <SelectValue placeholder="Choose" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sexes.map((sex) => (
                                        <SelectItem
                                            key={sex.value}
                                            value={sex.value}
                                        >
                                            {sex.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                    </div>
                    <Field>
                        <FieldLabel htmlFor="demo-phone">
                            Phone number
                        </FieldLabel>
                        <Input id="demo-phone" type="tel" autoComplete="off" />
                        <FieldDescription>
                            For visit reminders by SMS.
                        </FieldDescription>
                    </Field>
                </FieldGroup>
            </FieldSet>
            <FieldSeparator />
            <FieldSet>
                <FieldLegend>Home</FieldLegend>
                <FieldDescription>
                    Where a community health worker can find the patient.
                </FieldDescription>
                <FieldGroup>
                    <Field orientation="horizontal">
                        <Checkbox id="demo-catchment" defaultChecked />
                        <FieldLabel htmlFor="demo-catchment">
                            In this facility&apos;s catchment area
                        </FieldLabel>
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="demo-directions">
                            Directions
                        </FieldLabel>
                        <Textarea id="demo-directions" />
                    </Field>
                </FieldGroup>
            </FieldSet>
            <Field orientation="horizontal">
                <Button type="submit">Register</Button>
                <Button type="button" variant="outline">
                    Cancel
                </Button>
            </Field>
        </FieldGroup>
    </form>
)

export default FieldDemo
