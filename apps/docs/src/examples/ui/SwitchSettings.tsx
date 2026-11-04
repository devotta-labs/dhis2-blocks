import { useState } from 'react'
import { Label } from '@/components/dhis2/ui/label'
import { Switch } from '@/components/dhis2/ui/switch'

/** Settings that apply as soon as they are switched. */
const SwitchSettings = () => {
    const [reminders, setReminders] = useState(true)

    return (
        <div className="flex flex-col gap-3">
            <Label>
                <Switch
                    checked={reminders}
                    onCheckedChange={(checked) => setReminders(checked)}
                />
                Send visit reminders by SMS
            </Label>
            <Label>
                <Switch />
                Show closed facilities
            </Label>
            <Label>
                <Switch size="sm" disabled />
                Sync over mobile data
            </Label>
        </div>
    )
}

export default SwitchSettings
