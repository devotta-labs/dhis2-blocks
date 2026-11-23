import { Check, NumberRow, Section, SegmentedRow, SelectRow } from '../controls'
import { NetworkControls } from '../NetworkControls'
import { type LabData, type LabSettings } from './labData'
import { RESOURCES } from './labServer'
import { UNAVAILABLE, useStored, writeStored } from './labStorage'

type Change = (changes: Partial<LabSettings>) => void

export const OrgUnitsControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: Change
}) => (
    <Section title="Clinics">
        <NumberRow
            label="Assigned clinics"
            value={settings.assignedOrgUnits}
            max={20}
            onChange={(assignedOrgUnits) => onChange({ assignedOrgUnits })}
        />
        <NumberRow
            label="Assigned districts"
            value={settings.assignedDistricts}
            max={3}
            onChange={(assignedDistricts) => onChange({ assignedDistricts })}
        />
        <NumberRow
            label="Clinics per district"
            value={settings.orgUnitsPerDistrict}
            max={2000}
            onChange={(orgUnitsPerDistrict) =>
                onChange({ orgUnitsPerDistrict })
            }
        />
        <Check
            checked={settings.longNames}
            onChange={(longNames) => onChange({ longNames })}
        >
            120-character names
        </Check>
    </Section>
)

const VALUE_OPTIONS: ReadonlyArray<readonly [LabSettings['value'], string]> = [
    ['uncontrolled', 'Uncontrolled'],
    ['valid', 'Controlled, a valid clinic'],
    ['follows', 'Controlled, follows picks'],
]

export const SidebarControls = ({
    settings,
    live,
    onChange,
}: {
    settings: LabSettings
    live: boolean
    onChange: Change
}) => (
    <Section title="Sidebar">
        <Check
            checked={settings.collapsed}
            onChange={(collapsed) => onChange({ collapsed })}
        >
            Collapsed
        </Check>
        <Check checked={settings.rtl} onChange={(rtl) => onChange({ rtl })}>
            Right to left
        </Check>
        <SelectRow
            label="Value"
            value={settings.value}
            options={VALUE_OPTIONS.filter(
                ([value]) => !live || value !== 'valid'
            )}
            onChange={(value) => onChange({ value })}
        />
        {settings.value === 'uncontrolled' ? null : (
            <p className="m-0 text-xs text-muted-foreground">
                {settings.value === 'follows'
                    ? 'The host holds the value and passes back each clinic onValueChange gives it.'
                    : 'The host keeps its value: a pick calls onValueChange, and the selector stays where the host says.'}
            </p>
        )}
        <SegmentedRow
            label="Texts"
            value={settings.texts}
            options={[
                ['default', 'Default'],
                ['clinics', 'Clinics'],
                ['schools', 'Schools'],
            ]}
            onChange={(texts) => onChange({ texts })}
        />
    </Section>
)

const namesIn = (raw: string, data: LabData) =>
    [...new Set(raw.match(/\b[A-Za-z][A-Za-z0-9]{10}\b/g) ?? [])]
        .map(
            (id) =>
                `${id}: ${data.units.find((unit) => unit.id === id)?.displayName ?? 'no such clinic'}`
        )
        .join('\n')

const StoredValue = ({
    stored,
    data,
}: {
    stored: ReturnType<typeof useStored>
    data: LabData
}) => {
    if (stored === UNAVAILABLE) {
        return (
            <p className="m-0 text-xs text-(--lab-fault)">
                Storage unavailable
            </p>
        )
    }
    if (stored === null) {
        return (
            <p className="m-0 text-xs text-muted-foreground">Nothing stored</p>
        )
    }
    return (
        <div className="flex flex-col gap-1">
            <pre className="m-0 font-mono text-[11px] break-all whitespace-pre-wrap">
                {stored}
            </pre>
            <p className="m-0 text-xs whitespace-pre-line text-muted-foreground">
                {namesIn(stored, data)}
            </p>
        </div>
    )
}

export const RememberedControls = ({
    data,
    seed,
    onEdit,
}: {
    /** The lab's clinics; none on a live instance, where nobody's stored value shows. */
    data?: LabData
    seed?: string
    /** After the lab writes storage, so the block reads it again. */
    onEdit: () => void
}) => {
    const stored = useStored()
    const clear = () => {
        writeStored()
        onEdit()
    }
    if (!data) {
        return (
            <Section title="Remembered">
                <p className="m-0 text-xs text-muted-foreground">
                    Stored values show for lab data only. On a live instance the
                    block still remembers the unit you pick.
                </p>
            </Section>
        )
    }
    return (
        <Section title="Remembered">
            <StoredValue stored={stored} data={data} />
            {seed !== undefined && (
                <p className="m-0 text-xs break-all text-muted-foreground">
                    The example stored, before the block started: {seed}
                </p>
            )}
            <button type="button" className="self-start" onClick={clear}>
                Clear
            </button>
        </Section>
    )
}

export const ServerControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: Change
}) => (
    <>
        <Section title="Server">
            <Check
                checked={settings.failSearch}
                onChange={(failSearch) => onChange({ failSearch })}
            >
                Search fails
            </Check>
            <Check
                checked={settings.failValidity}
                onChange={(failValidity) => onChange({ failValidity })}
            >
                Validity check fails
            </Check>
        </Section>
        <NetworkControls
            network={settings.network}
            records={RESOURCES}
            onChange={(network) => onChange({ network })}
        />
    </>
)
