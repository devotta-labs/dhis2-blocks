import { Check, Section } from '../controls'
import type { LabSettings } from './labData'

/** The few settings worth changing by hand; the examples cover the rest. */
export const OptionsControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: (changes: Partial<LabSettings>) => void
}) =>
    settings.example === 'immunisation' ? null : (
        <Section title="Options">
            <Check
                checked={settings.rules}
                onChange={(rules) => onChange({ rules })}
            >
                Program rules
            </Check>
        </Section>
    )
