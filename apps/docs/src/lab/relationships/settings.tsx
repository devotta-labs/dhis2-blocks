import { Check, NumberRow, Section, SelectRow } from './controls'
import type { LabData, Spread } from './labData'
import type { LabServer } from './labServer'
import type { LabView } from './presets'

const SPREADS: ReadonlyArray<readonly [Spread, string]> = [
    ['mixed', 'Mixed'],
    ['chains', 'Chains'],
    ['hubs', 'Superspreaders'],
    ['households', 'Households'],
]

type PercentKey =
    | 'attention'
    | 'overdue'
    | 'completed'
    | 'undated'
    | 'outOfProgram'
    | 'failing'

export const DataControls = ({
    data,
    onChange,
}: {
    data: LabData
    onChange: (data: LabData) => void
}) => {
    const set = (patch: Partial<LabData>) => onChange({ ...data, ...patch })
    const percent = (label: string, key: PercentKey) => (
        <NumberRow
            label={label}
            value={data[key]}
            max={100}
            suffix="%"
            onChange={(value) => set({ [key]: value })}
        />
    )
    return (
        <Section title="Outbreak data">
            <SelectRow
                label="Spread"
                value={data.spread}
                options={SPREADS}
                onChange={(spread) => set({ spread })}
            />
            <NumberRow
                label="People"
                value={data.people}
                min={1}
                max={3000}
                onChange={(people) => set({ people })}
            />
            {percent('Marked for follow-up', 'attention')}
            {percent('Follow-up overdue', 'overdue')}
            {percent('Follow-up completed', 'completed')}
            {percent('No enrollment date', 'undated')}
            {percent('Outside the program', 'outOfProgram')}
            {percent('Fail to load', 'failing')}
            <Check
                checked={data.sameDay}
                onChange={(sameDay) => set({ sameDay })}
            >
                Contacts enrolled the same day
            </Check>
            <Check
                checked={data.longNames}
                onChange={(longNames) => set({ longNames })}
            >
                Long names
            </Check>
            <Check checked={data.events} onChange={(events) => set({ events })}>
                Lab results linked to cases
            </Check>
            <div className="flex items-center justify-between gap-2 text-sm">
                Random seed {data.seed}
                <button
                    type="button"
                    className="rounded border border-dhis2-grey-500 px-2 py-0.5"
                    onClick={() => set({ seed: data.seed + 1 })}
                >
                    New outbreak
                </button>
            </div>
        </Section>
    )
}

export const ViewControls = ({
    view,
    live,
    onChange,
}: {
    view: LabView
    live: boolean
    onChange: (view: LabView) => void
}) => {
    const set = (patch: Partial<LabView>) => onChange({ ...view, ...patch })
    return (
        <>
            <Section title="Viewer props">
                {!live && (
                    <SelectRow
                        label="Start from"
                        value={view.start}
                        options={[
                            ['index', 'The index case'],
                            ['cases', 'Every case'],
                            ['query', 'A seed query'],
                        ]}
                        onChange={(start) => set({ start })}
                    />
                )}
                <NumberRow
                    label="hops"
                    value={view.hops}
                    min={1}
                    max={10}
                    onChange={(hops) => set({ hops })}
                />
                <NumberRow
                    label="cap"
                    value={view.cap}
                    min={1}
                    max={5000}
                    onChange={(cap) => set({ cap })}
                />
                <SelectRow
                    label="layout"
                    value={view.layout}
                    options={[
                        ['web', 'Web'],
                        ['trace', 'Trace'],
                    ]}
                    onChange={(layout) => set({ layout })}
                />
                <SelectRow
                    label="dateOf"
                    value={view.dateRule}
                    options={[
                        ['enrolled', 'Default (enrolled)'],
                        ['onset', 'Onset (incident date)'],
                        ['none', 'No dates'],
                    ]}
                    onChange={(dateRule) => set({ dateRule })}
                />
                <SelectRow
                    label="labelOf"
                    value={view.label}
                    options={[
                        ['dataView', 'Default (data view)'],
                        ['village', 'Name and village'],
                        ['uid', 'UID'],
                    ]}
                    onChange={(label) => set({ label })}
                />
            </Section>
            {!live && (
                <Section title="followTypes">
                    {(
                        [
                            ['contact', 'Was in contact with'],
                            ['household', 'Same household'],
                            ['labResult', 'Lab result for'],
                        ] as const
                    ).map(([type, label]) => (
                        <Check
                            key={type}
                            checked={view.follow[type]}
                            onChange={(on) =>
                                set({ follow: { ...view.follow, [type]: on } })
                            }
                        >
                            {label}
                        </Check>
                    ))}
                </Section>
            )}
            <Section title="Status rule">
                <SelectRow
                    label="Needs attention"
                    value={view.attentionRule}
                    options={[
                        ['followUp', 'Marked for follow-up'],
                        ['overdue', 'Follow-up overdue'],
                        ['none', 'Nothing'],
                    ]}
                    onChange={(attentionRule) => set({ attentionRule })}
                />
                {view.attentionRule === 'overdue' && (
                    <NumberRow
                        label="Overdue after"
                        value={view.overdueDays}
                        min={0}
                        max={60}
                        suffix="d"
                        onChange={(overdueDays) => set({ overdueDays })}
                    />
                )}
            </Section>
            <Section title="Parts">
                {(
                    [
                        ['toggle', 'Layout toggle'],
                        ['notices', 'Notices'],
                        ['summary', 'Summary'],
                        ['legend', 'Legend'],
                        ['list', 'List'],
                    ] as const
                ).map(([part, label]) => (
                    <Check
                        key={part}
                        checked={view.parts[part]}
                        onChange={(on) =>
                            set({ parts: { ...view.parts, [part]: on } })
                        }
                    >
                        {label}
                    </Check>
                ))}
                <NumberRow
                    label="Canvas height"
                    value={view.height}
                    min={160}
                    max={1600}
                    suffix="px"
                    onChange={(height) => set({ height })}
                />
            </Section>
        </>
    )
}

export const ServerControls = ({
    server,
    onChange,
}: {
    server: LabServer
    onChange: (server: LabServer) => void
}) => (
    <Section title="Lab server">
        <NumberRow
            label="Latency"
            value={server.latency}
            max={10000}
            suffix="ms"
            onChange={(latency) => onChange({ ...server, latency })}
        />
        <SelectRow
            label="Metadata request"
            value={server.metadata}
            options={[
                ['ok', 'Answers'],
                ['fails', 'Fails (500)'],
            ]}
            onChange={(metadata) => onChange({ ...server, metadata })}
        />
    </Section>
)
