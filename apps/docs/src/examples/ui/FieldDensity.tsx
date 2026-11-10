import { Button } from '@/components/dhis2/ui/button'
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'

/** One visit form at each density: regular, and compact inside `data-density="compact"`. */
const Visit = ({ id, legend }: { id: string; legend: string }) => (
    <FieldSet>
        <FieldLegend>{legend}</FieldLegend>
        <FieldGroup>
            <Field>
                <FieldLabel htmlFor={`${id}-weight`}>Weight (kg)</FieldLabel>
                <Input id={`${id}-weight`} inputMode="decimal" />
            </Field>
            <Field>
                <FieldLabel htmlFor={`${id}-height`}>Height (cm)</FieldLabel>
                <Input id={`${id}-height`} inputMode="decimal" />
                <FieldDescription>Standing, without shoes.</FieldDescription>
            </Field>
            <Field orientation="horizontal">
                <Button type="button">Save</Button>
            </Field>
        </FieldGroup>
    </FieldSet>
)

const FieldDensity = () => (
    <div className="grid w-full gap-8 sm:grid-cols-2">
        <Visit id="regular" legend="Regular" />
        <div data-density="compact">
            <Visit id="compact" legend="Compact" />
        </div>
    </div>
)

export default FieldDensity
