import { Section, SegmentedRow, SelectRow } from '../controls'
import type { LabSettings } from './labData'

/** The example on show, what a host sets (blame, the saved status, the location's distance check) and the user's authority. */
export const OptionsControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: (changes: Partial<LabSettings>) => void
}) => (
    <Section title="Options">
        <SelectRow
            label="Example"
            value={settings.example}
            options={[
                ['newVisit', 'New child visit'],
                ['savedVisit', 'Saved child visit'],
                ['rulesChangedVisit', 'Saved visit the rules changed'],
                ['fundedVisit', 'New visit with categories'],
                ['savedFundedVisit', 'Saved visit with categories'],
                ['locked', 'Completed, locked'],
                ['noWrite', 'No write access'],
                ['valueTypes', 'Every value type'],
                ['rmnch', 'RMNCH First ANC'],
                ['longForm', 'Long form'],
                ['refused', 'Refused save'],
                ['rulesFail', 'Rules fail'],
                ['noSections', 'No sections'],
                ['onComplete', 'Checks on complete'],
                ['pointVisit', 'New visit with a location'],
                ['savedPointVisit', 'Saved visit with a location'],
                ['areaVisit', 'Location in an area'],
            ]}
            onChange={(example) => onChange({ example })}
        />
        <SegmentedRow
            label="Blame"
            value={settings.blame}
            options={[
                ['markers', 'Markers'],
                ['off', 'Off'],
            ]}
            onChange={(blame) => onChange({ blame })}
        />
        <SegmentedRow
            label="Saved status"
            value={settings.confirmSaved}
            options={[
                ['status', 'Status'],
                ['off', 'Off'],
            ]}
            onChange={(confirmSaved) => onChange({ confirmSaved })}
        />
        <SegmentedRow
            label="Location distance"
            value={String(settings.locationWarnKm ?? 'off')}
            options={[
                ['off', 'Off'],
                ['25', '25 km'],
                ['100', '100 km'],
            ]}
            onChange={(km) =>
                onChange({
                    locationWarnKm: km === 'off' ? undefined : Number(km),
                })
            }
        />
        <SegmentedRow
            label="Reopen"
            value={settings.mayUncomplete ? 'may' : 'mayNot'}
            options={[
                ['may', 'May'],
                ['mayNot', 'May not'],
            ]}
            onChange={(may) => onChange({ mayUncomplete: may === 'may' })}
        />
    </Section>
)
