import { Check, NumberRow, Section, SelectRow } from '../controls'
import type { LabSettings } from './labData'

type Change = (changes: Partial<LabSettings>) => void

/** What the lab's DHIS2 holds: the readings and the data element's metadata. */
export const DataControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: Change
}) => (
    <Section title="Data">
        <NumberRow
            label="Readings"
            value={settings.readings}
            max={500}
            onChange={(readings) => onChange({ readings })}
        />
        <SelectRow
            label="Value spread"
            value={settings.spread}
            options={[
                ['steady', 'Steady'],
                ['flat', 'Flat'],
                ['crossing', 'Crossing legend ranges'],
                ['jumpy', 'Jumpy, irregular visits'],
            ]}
            onChange={(spread) => onChange({ spread })}
        />
        <SelectRow
            label="Value type"
            value={settings.valueType}
            options={[
                ['NUMBER', 'NUMBER'],
                ['INTEGER_POSITIVE', 'INTEGER_POSITIVE'],
                ['PERCENTAGE', 'PERCENTAGE'],
                ['BOOLEAN', 'BOOLEAN'],
                ['TRUE_ONLY', 'TRUE_ONLY'],
                ['TEXT', 'TEXT'],
                ['DATE', 'DATE'],
                ['COORDINATE', 'COORDINATE (unsupported)'],
            ]}
            onChange={(valueType) => onChange({ valueType })}
        />
        <Check
            checked={settings.legendSet}
            onChange={(legendSet) => onChange({ legendSet })}
        >
            Legend set (numbers)
        </Check>
        <SelectRow
            label="Option set"
            value={settings.optionSet}
            options={[
                ['none', 'None'],
                ['plain', 'Without colours'],
                ['coloured', 'With style colours'],
            ]}
            onChange={(optionSet) => onChange({ optionSet })}
        />
        <NumberRow
            label="Days since last reading"
            value={settings.daysSinceLast}
            max={3650}
            onChange={(daysSinceLast) => onChange({ daysSinceLast })}
        />
        <NumberRow
            label="Enrollments"
            value={settings.enrollments}
            min={1}
            max={3}
            onChange={(enrollments) => onChange({ enrollments })}
        />
        <Check
            checked={settings.unreadableStage}
            onChange={(unreadableStage) => onChange({ unreadableStage })}
        >
            Unreadable stage
        </Check>
        <Check
            checked={settings.scheduledSkipped}
            onChange={(scheduledSkipped) => onChange({ scheduledSkipped })}
        >
            Scheduled and skipped events mixed in
        </Check>
        <Check
            checked={settings.trueOnlyUntick}
            onChange={(trueOnlyUntick) => onChange({ trueOnlyUntick })}
        >
            TRUE_ONLY: latest unticked
        </Check>
        <Check
            checked={settings.longLabel}
            onChange={(longLabel) => onChange({ longLabel })}
        >
            Long label and unit
        </Check>
        <Check
            checked={settings.notInProgram}
            onChange={(notInProgram) => onChange({ notInProgram })}
        >
            First card: data element not in program
        </Check>
    </Section>
)

export const ServerControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: Change
}) => (
    <Section title="Server">
        <SelectRow
            label="System calendar"
            value={settings.calendar}
            options={[
                ['gregorian', 'Gregorian'],
                ['iso8601', 'ISO 8601'],
                ['ethiopian', 'Ethiopian'],
                ['nepali', 'Nepali'],
                ['coptic', 'Coptic'],
                ['islamic', 'Islamic'],
                ['persian', 'Persian'],
                ['thai', 'Thai'],
            ]}
            onChange={(calendar) => onChange({ calendar })}
        />
    </Section>
)

/** The cards' props and the lab's layout around them; the block keeps its own look. */
export const CardControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: Change
}) => (
    <Section title="Cards">
        <SelectRow
            label="Card"
            value={settings.arrangement}
            options={[
                ['default', 'Default arrangement'],
                ['composed', 'Composed parts'],
            ]}
            onChange={(arrangement) => onChange({ arrangement })}
        />
        <NumberRow
            label="staleAfterDays (0 off)"
            value={settings.staleAfterDays}
            max={3650}
            onChange={(staleAfterDays) => onChange({ staleAfterDays })}
        />
        <NumberRow
            label="Card width"
            value={settings.cardWidth}
            min={160}
            max={480}
            suffix="px"
            onChange={(cardWidth) => onChange({ cardWidth })}
        />
        <NumberRow
            label="Cards per row"
            value={settings.cardsPerRow}
            min={1}
            max={4}
            onChange={(cardsPerRow) => onChange({ cardsPerRow })}
        />
    </Section>
)
