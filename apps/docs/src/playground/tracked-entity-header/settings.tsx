import { Check, SegmentedRow, Section, SelectRow } from '../controls'
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
        <SelectRow
            label="Person"
            value={settings.person}
            options={[
                ['pregnancy', 'Pregnancy'],
                ['child', 'Child'],
                ['adult', 'Adult'],
            ]}
            onChange={(person) => onChange({ person })}
        />
        <Check
            checked={settings.inactive}
            onChange={(inactive) => onChange({ inactive })}
        >
            Inactive
        </Check>
        <Check
            checked={settings.potentialDuplicate}
            onChange={(potentialDuplicate) => onChange({ potentialDuplicate })}
        >
            Possible duplicate
        </Check>
        <Check
            checked={settings.restricted}
            onChange={(restricted) => onChange({ restricted })}
        >
            No access (403)
        </Check>
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
        <SegmentedRow
            label="Banner"
            value={settings.arrangement}
            options={[
                ['composed', 'Composed'],
                ['default', 'Default'],
            ]}
            onChange={(arrangement) => onChange({ arrangement })}
        />
        <SegmentedRow
            label="Width"
            value={settings.width}
            options={[
                ['narrow', 'Narrow'],
                ['wide', 'Wide'],
            ]}
            onChange={(width) => onChange({ width })}
        />
    </Section>
)
