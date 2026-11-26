import { Check, NumberRow, Section, SegmentedRow, SelectRow } from '../controls'
import {
    HOST_DELAYS,
    OTHER_DEVICE,
    OTHER_DEVICE_TAPS,
    type LabSettings,
} from './labData'

type Change = (changes: Partial<LabSettings>) => void

export const SheetControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: Change
}) => (
    <Section title="Sheet">
        <SelectRow
            label="Sheet"
            value={settings.sheet}
            options={[
                ['vitaminA', 'Vitamin A'],
                ['vaccinations', 'Vaccinations'],
                ['large', '30 by 8'],
            ]}
            onChange={(sheet) => onChange({ sheet })}
        />
        <NumberRow
            label="Marks already tallied"
            value={settings.seeded}
            max={100_000}
            onChange={(seeded) => onChange({ seeded })}
        />
        <Check
            checked={settings.joined}
            onChange={(joined) => onChange({ joined })}
        >
            Half of them from the {OTHER_DEVICE.toLowerCase()}
        </Check>
        <SegmentedRow
            label="Direction"
            value={settings.rtl ? 'rtl' : 'ltr'}
            options={[
                ['ltr', 'LTR'],
                ['rtl', 'RTL'],
            ]}
            onChange={(direction) => onChange({ rtl: direction === 'rtl' })}
        />
    </Section>
)

export const HostControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: Change
}) => (
    <Section title="Host">
        <SegmentedRow
            label="Host delay"
            value={String(settings.hostDelay)}
            options={HOST_DELAYS.map(
                (delay) => [String(delay), `${delay} ms`] as const
            )}
            onChange={(delay) =>
                onChange({
                    hostDelay:
                        HOST_DELAYS.find((each) => String(each) === delay) ?? 0,
                })
            }
        />
    </Section>
)

export const OtherDeviceControls = ({
    onOtherDevice,
}: {
    onOtherDevice: () => void
}) => (
    <Section title="Second device">
        <button type="button" className="self-start" onClick={onOtherDevice}>
            Join {OTHER_DEVICE_TAPS} taps from the {OTHER_DEVICE.toLowerCase()}
        </button>
    </Section>
)
