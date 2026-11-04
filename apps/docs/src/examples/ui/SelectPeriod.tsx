import { Field, FieldLabel } from '@/components/dhis2/ui/field'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/dhis2/ui/select'

const periods = [
    { value: 'THIS_MONTH', label: 'This month' },
    { value: 'LAST_MONTH', label: 'Last month' },
    { value: 'LAST_3_MONTHS', label: 'Last 3 months' },
    { value: 'LAST_12_MONTHS', label: 'Last 12 months' },
    { value: 'THIS_YEAR', label: 'This year' },
]

/** Choose one period from a short list. */
const SelectPeriod = () => (
    <Field className="max-w-xs">
        <FieldLabel htmlFor="period">Period</FieldLabel>
        <Select items={periods} defaultValue="LAST_3_MONTHS">
            <SelectTrigger id="period">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {periods.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                        {period.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    </Field>
)

export default SelectPeriod
