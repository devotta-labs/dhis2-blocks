import { Label } from '@/components/dhis2/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/dhis2/ui/radio-group'

const outcomes = [
    { value: 'attended', label: 'Attended' },
    { value: 'missed', label: 'Missed' },
    { value: 'rescheduled', label: 'Rescheduled' },
]

/** One answer from a short list: how the visit went. */
const RadioGroupOutcome = () => (
    <div className="flex flex-col gap-3">
        <p id="visit-outcome" className="m-0 text-sm font-medium">
            Visit outcome
        </p>
        <RadioGroup aria-labelledby="visit-outcome" defaultValue="attended">
            {outcomes.map((outcome) => (
                <Label key={outcome.value}>
                    <RadioGroupItem value={outcome.value} />
                    {outcome.label}
                </Label>
            ))}
        </RadioGroup>
    </div>
)

export default RadioGroupOutcome
