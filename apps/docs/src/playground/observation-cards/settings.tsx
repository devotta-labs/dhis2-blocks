import { NumberRow, Section, SelectRow } from '../controls'
import type { LabSettings } from './labData'

/** The few settings worth changing by hand; the examples cover the rest. */
export const OptionsControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: (changes: Partial<LabSettings>) => void
}) => (
    <Section title="Options">
        <NumberRow
            label="Visits"
            value={settings.visits}
            max={500}
            onChange={(visits) => onChange({ visits })}
        />
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
    </Section>
)
