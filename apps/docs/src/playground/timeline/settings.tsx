import type { EventTimeField } from '@/components/timeline/dhis2'
import { Section, SelectRow } from '../controls'
import type { LabSettings } from './labData'

const TIME_FIELDS: ReadonlyArray<readonly [EventTimeField, string]> = [
    ['occurredAt', 'Event date'],
    ['scheduledAt', 'Due date'],
    ['completedAt', 'Completed'],
    ['createdAt', 'Created'],
    ['updatedAt', 'Updated'],
]

/** The few settings worth changing by hand; the examples cover the rest. Calendar is left out on live DHIS2, whose server sets it. */
export const OptionsControls = ({
    settings,
    onChange,
    live = false,
}: {
    settings: LabSettings
    onChange: (changes: Partial<LabSettings>) => void
    live?: boolean
}) => (
    <Section title="Options">
        <SelectRow
            label="Time field"
            value={settings.timeField}
            options={TIME_FIELDS}
            onChange={(timeField) => onChange({ timeField })}
        />
        {live ? null : (
            <SelectRow
                label="Calendar"
                value={settings.calendar}
                options={[
                    ['gregorian', 'Gregorian'],
                    ['ethiopian', 'Ethiopian'],
                    ['nepali', 'Nepali'],
                    ['islamic', 'Islamic'],
                    ['persian', 'Persian'],
                    ['thai', 'Thai'],
                ]}
                onChange={(calendar) => onChange({ calendar })}
            />
        )}
        <SelectRow
            label="Language"
            value={settings.locale}
            options={[
                ['en', 'English'],
                ['fr', 'French'],
                ['ar', 'Arabic'],
            ]}
            onChange={(locale) => onChange({ locale })}
        />
    </Section>
)
