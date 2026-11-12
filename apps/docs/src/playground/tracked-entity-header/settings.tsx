import { Check, SegmentedRow, Section, SelectRow } from '../controls'
import type { LabSettings } from './labData'

type Flags = 'none' | 'inactive' | 'duplicate' | 'both'
type Access = 'allowed' | 'restricted' | 'missing'

const flagsOf = ({ inactive, potentialDuplicate }: LabSettings): Flags => {
    if (inactive && potentialDuplicate) return 'both'
    if (inactive) return 'inactive'
    return potentialDuplicate ? 'duplicate' : 'none'
}

const accessOf = ({ restricted, missing }: LabSettings): Access => {
    if (restricted) return 'restricted'
    return missing ? 'missing' : 'allowed'
}

/** Four settings that make sense on any example; the examples cover the rest. */
export const OptionsControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: (changes: Partial<LabSettings>) => void
}) => (
    <Section title="Options">
        <SegmentedRow
            label="Width"
            value={settings.width}
            options={[
                ['narrow', 'Narrow'],
                ['wide', 'Wide'],
            ]}
            onChange={(width) => onChange({ width })}
        />
        <SelectRow
            label="Flags"
            value={flagsOf(settings)}
            options={[
                ['none', 'None'],
                ['inactive', 'Inactive'],
                ['duplicate', 'Possible duplicate'],
                ['both', 'Both'],
            ]}
            onChange={(flags) =>
                onChange({
                    inactive: flags === 'inactive' || flags === 'both',
                    potentialDuplicate:
                        flags === 'duplicate' || flags === 'both',
                })
            }
        />
        <SelectRow
            label="Access"
            value={accessOf(settings)}
            options={[
                ['allowed', 'Allowed'],
                ['restricted', 'No access (403)'],
                ['missing', "Doesn't exist (404)"],
            ]}
            onChange={(access) =>
                onChange({
                    restricted: access === 'restricted',
                    missing: access === 'missing',
                })
            }
        />
        <Check checked={settings.rtl} onChange={(rtl) => onChange({ rtl })}>
            Right to left
        </Check>
    </Section>
)
