import { Check, NumberRow, Section, SegmentedRow, SelectRow } from '../controls'
import { NetworkControls } from '../NetworkControls'
import { type LabData, type LabSettings, type LabUser } from './labData'
import { RESOURCES } from './labServer'
import { UNAVAILABLE, useStored, writeStored } from './labStorage'
import { CORRUPT_VALUE, GONE_VALUE, type Seed } from './presets'

type Change = (changes: Partial<LabSettings>) => void

export const ClinicsControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: Change
}) => (
    <Section title="Clinics">
        <NumberRow
            label="Assigned clinics"
            value={settings.assignedClinics}
            max={20}
            onChange={(assignedClinics) => onChange({ assignedClinics })}
        />
        <NumberRow
            label="Assigned districts"
            value={settings.assignedDistricts}
            max={3}
            onChange={(assignedDistricts) => onChange({ assignedDistricts })}
        />
        <NumberRow
            label="Clinics per district"
            value={settings.clinicsPerDistrict}
            max={200}
            onChange={(clinicsPerDistrict) => onChange({ clinicsPerDistrict })}
        />
        <Check
            checked={settings.longNames}
            onChange={(longNames) => onChange({ longNames })}
        >
            120-character names
        </Check>
        <Check
            checked={settings.sameInitials}
            onChange={(sameInitials) => onChange({ sameInitials })}
        >
            Every name starts with B
        </Check>
    </Section>
)

export const SidebarControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: Change
}) => (
    <Section title="Sidebar">
        <Check
            checked={settings.collapsed}
            onChange={(collapsed) => onChange({ collapsed })}
        >
            Collapsed
        </Check>
        <SelectRow
            label="Controlled value"
            value={settings.value}
            options={[
                ['uncontrolled', 'Uncontrolled'],
                ['valid', 'A valid clinic'],
                ['outside', 'An id outside scope'],
            ]}
            onChange={(value) => onChange({ value })}
        />
        {settings.value === 'uncontrolled' ? null : (
            <p className="m-0 text-xs text-muted-foreground">
                The host keeps its value: a pick calls onValueChange, and the
                selector stays where the host says.
            </p>
        )}
        <SegmentedRow
            label="Label"
            value={settings.label}
            options={[
                ['Clinic', 'Clinic'],
                ['Facility', 'Facility'],
            ]}
            onChange={(label) => onChange({ label })}
        />
    </Section>
)

/** Each uid in a stored value with its clinic's name, so it reads without looking them up. */
const namesIn = (raw: string, data: LabData) =>
    [...new Set(raw.match(/\b[A-Za-z][A-Za-z0-9]{10}\b/g) ?? [])]
        .map(
            (id) =>
                `${id}: ${data.units.find((unit) => unit.id === id)?.displayName ?? 'no such clinic'}`
        )
        .join('\n')

const StoredValue = ({ user, data }: { user: LabUser; data: LabData }) => {
    const stored = useStored(user)
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
    settings,
    data,
    seed,
    onChange,
    onEdit,
}: {
    settings: LabSettings
    data: LabData
    seed: Seed
    onChange: Change
    /** After the lab writes storage, so the block reads it again. */
    onEdit: () => void
}) => {
    const edit = (raw?: string) => {
        writeStored(settings.userId, raw)
        onEdit()
    }
    const seeded = Object.entries(seed)
    return (
        <Section title="Remembered">
            <SegmentedRow
                label="User"
                value={settings.userId}
                options={[
                    ['u1', 'u1'],
                    ['u2', 'u2'],
                ]}
                onChange={(userId) => onChange({ userId })}
            />
            <span className="text-xs text-muted-foreground">
                Stored for {settings.userId}
            </span>
            <StoredValue user={settings.userId} data={data} />
            {seeded.length > 0 && (
                <p className="m-0 text-xs break-all text-muted-foreground">
                    The example stored, before the block started:{' '}
                    {seeded.map(([user, raw]) => `${user} ${raw}`).join('; ')}
                </p>
            )}
            <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => edit()}>
                    Clear
                </button>
                <button type="button" onClick={() => edit(GONE_VALUE)}>
                    Remember a clinic that no longer exists
                </button>
                <button type="button" onClick={() => edit(CORRUPT_VALUE)}>
                    Corrupt it
                </button>
            </div>
            <Check
                checked={settings.storageThrows}
                onChange={(storageThrows) => onChange({ storageThrows })}
            >
                Storage throws
            </Check>
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
                checked={settings.ignoreScopeFilter}
                onChange={(ignoreScopeFilter) =>
                    onChange({ ignoreScopeFilter })
                }
            >
                Validity check ignores the scope filter
            </Check>
        </Section>
        <NetworkControls
            network={settings.network}
            records={RESOURCES}
            onChange={(network) => onChange({ network })}
        />
    </>
)
