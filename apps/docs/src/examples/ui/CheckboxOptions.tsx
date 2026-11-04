import { useState } from 'react'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import { Label } from '@/components/dhis2/ui/label'

/** A few on-or-off choices, each with its label to click. */
const CheckboxOptions = () => {
    const [followUp, setFollowUp] = useState(true)

    return (
        <div className="flex flex-col gap-3">
            <Label>
                <Checkbox
                    checked={followUp}
                    onCheckedChange={(checked) => setFollowUp(checked)}
                />
                Only people marked for follow-up
            </Label>
            <Label>
                <Checkbox />
                Include completed enrollments
            </Label>
            <Label>
                <Checkbox disabled />
                Include deleted records
            </Label>
        </div>
    )
}

export default CheckboxOptions
