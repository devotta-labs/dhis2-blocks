import { Check, Section, SegmentedRow, SelectRow } from '../controls'
import type { LabSettings } from './labData'

/** What every field is given: the rules a host passes, the density and the calendar. */
export const OptionsControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: (changes: Partial<LabSettings>) => void
}) => (
    <Section title="Options">
        <Check
            checked={settings.filled}
            onChange={(filled) => onChange({ filled })}
        >
            Start with values
        </Check>
        <Check
            checked={settings.required}
            onChange={(required) => onChange({ required })}
        >
            Required
        </Check>
        <Check
            checked={settings.readOnly}
            onChange={(readOnly) => onChange({ readOnly })}
        >
            Read-only
        </Check>
        <Check
            checked={settings.hideOption}
            onChange={(hideOption) => onChange({ hideOption })}
        >
            Hide an option
        </Check>
        <SelectRow
            label="Messages"
            value={settings.messages}
            options={[
                ['none', 'None'],
                ['error', 'An error'],
                ['warning', 'A warning'],
            ]}
            onChange={(messages) => onChange({ messages })}
        />
        <Check checked={settings.rtl} onChange={(rtl) => onChange({ rtl })}>
            Right to left
        </Check>
        <SegmentedRow
            label="Density"
            value={settings.density}
            options={[
                ['regular', 'Regular'],
                ['compact', 'Compact'],
            ]}
            onChange={(density) => onChange({ density })}
        />
        <SelectRow
            label="Calendar"
            value={settings.calendar}
            options={[
                ['gregorian', 'Gregorian'],
                ['ethiopian', 'Ethiopian'],
                ['nepali', 'Nepali'],
            ]}
            onChange={(calendar) => onChange({ calendar })}
        />
        <SelectRow
            label="Date format"
            value={settings.dateFormat}
            options={[
                ['YYYY-MM-DD', 'YYYY-MM-DD'],
                ['DD-MM-YYYY', 'DD-MM-YYYY'],
            ]}
            onChange={(dateFormat) => onChange({ dateFormat })}
        />
    </Section>
)
