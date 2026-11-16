import { Check, NumberRow, Section, SegmentedRow, SelectRow } from '../controls'
import { NetworkControls } from '../NetworkControls'
import { type LabData, type LabSettings } from './labData'
import { RESOURCES } from './labServer'
import { UNAVAILABLE, useStored, writeStored } from './labStorage'
import { CORRUPT_VALUE, GONE_VALUE, NOT_UID_VALUE, type Seed } from './presets'

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
            max={2000}
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

const VALUE_OPTIONS: ReadonlyArray<readonly [LabSettings['value'], string]> = [
    ['uncontrolled', 'Uncontrolled'],
    ['valid', 'Controlled, a valid clinic'],
    ['follows', 'Controlled, follows picks'],
    ['outside', 'Controlled, an id outside scope'],
    ['missing', 'Controlled, id that does not exist'],
]

// A live instance has none of the lab's clinics, so only values that need none are offered there.
const LIVE_VALUES: ReadonlySet<string> = new Set([
    'uncontrolled',
    'follows',
    'missing',
])

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
                ([value]) => !live || LIVE_VALUES.has(value)
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

const StoredValue = ({
    stored,
    data,
}: {
    stored: ReturnType<typeof useStored>
    /** The lab's clinics, to name each stored id; none on a live instance. */
    data?: LabData
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
            <p className="m-0 text-xs text-muted-foreground">
                {data
                    ? 'Nothing stored'
                    : 'Nothing stored yet: pick a clinic and the block stores it.'}
            </p>
        )
    }
    return (
        <div className="flex flex-col gap-1">
            <pre className="m-0 font-mono text-[11px] break-all whitespace-pre-wrap">
                {stored}
            </pre>
            {data && (
                <p className="m-0 text-xs whitespace-pre-line text-muted-foreground">
                    {namesIn(stored, data)}
                </p>
            )}
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
    /** The lab's clinics; none on a live instance, where the signed-in user's value shows. */
    data?: LabData
    seed: Seed
    onChange: Change
    /** After the lab writes storage, so the block reads it again. */
    onEdit: () => void
}) => {
    const user = data ? settings.userId : 'live'
    const stored = useStored(user)
    const edit = (raw?: string) => {
        writeStored(user, raw)
        onEdit()
    }
    const seeded = Object.entries(seed)
    // On a live instance the user's key is known only once the block has stored something.
    const editable = data !== undefined || stored !== null
    return (
        <Section title="Remembered">
            {data ? (
                <>
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
                </>
            ) : (
                <span className="text-xs text-muted-foreground">
                    Stored for the signed-in user
                </span>
            )}
            <StoredValue stored={stored} data={data} />
            {seeded.length > 0 && (
                <p className="m-0 text-xs break-all text-muted-foreground">
                    The example stored, before the block started:{' '}
                    {seeded.map(([user, raw]) => `${user} ${raw}`).join('; ')}
                </p>
            )}
            <div className="flex flex-wrap gap-1">
                {(
                    [
                        ['Clear', undefined],
                        ['Remember a clinic that no longer exists', GONE_VALUE],
                        ['Remember an id that is not a uid', NOT_UID_VALUE],
                        ['Corrupt it', CORRUPT_VALUE],
                    ] as const
                ).map(([name, raw]) => (
                    <button
                        key={name}
                        type="button"
                        disabled={!editable}
                        onClick={() => edit(raw)}
                    >
                        {name}
                    </button>
                ))}
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
                Server ignores the scope filter
            </Check>
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
