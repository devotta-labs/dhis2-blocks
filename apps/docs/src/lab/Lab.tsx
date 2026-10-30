import {
    DataEntry,
    DataEntrySummary,
    DataGrid,
    eventSource,
    useDataEntry,
    type EventSourceOptions,
    type OutboxRecord,
} from '@/components/data-entry'
import { useMemo, useState, type ReactNode } from 'react'
import { ComposedGrid } from './ComposedGrid'
import {
    DEFAULT_CONFIG,
    labSource,
    SAVE_MODES,
    VALUE_TYPES,
    type LabConfig,
} from './labForm'

// The docs' live examples, on the DHIS2 Sierra Leone demo database.
const PRESETS = {
    'Event program (inpatient)': {
        programId: 'eBAyeGv0exc',
        orgUnitId: 'DiszpKrYNg8',
        orgUnitMode: 'SELECTED',
    },
    'Tracker stage register': {
        programId: 'WSGAb5XwJ3Y',
        programStageId: 'WZbXY0S00lP',
        orgUnitId: 'ImspTQPwCqd',
        orgUnitMode: 'DESCENDANTS',
    },
    "One person's events": {
        programId: 'WSGAb5XwJ3Y',
        orgUnitId: 'm7fBMpmVpSM',
        enrollmentId: 'PE6abx7Zhn0',
        newRowStageId: 'edqlbukwRfQ',
        order: 'occurredAt:asc',
    },
} satisfies Record<string, EventSourceOptions>

const FLAGS: [keyof LabConfig, string][] = [
    ['groupHeaders', 'Group headers by how cells edit'],
    ['samples', 'Fill sample values'],
    ['closedCells', 'Closed cells'],
    ['required', 'Required fields (every third)'],
    ['readOnlyRow', 'A read-only row'],
    ['completedRow', 'A completed row'],
    ['addRows', 'Add rows at the end'],
    ['paging', 'More rows to load (3 pages)'],
]

interface LogEntry {
    at: string
    records: ReadonlyArray<OutboxRecord>
}

const Status = () => {
    const status = useDataEntry((view) => view.status)
    const error = useDataEntry((view) => view.error)
    return status === 'ready' ? null : (
        <p role="status" className="text-sm text-dhis2-grey-700">
            {status === 'loading' ? 'Loading…' : `Could not load: ${error}`}
        </p>
    )
}

const Section = ({
    title,
    children,
}: {
    title: string
    children: ReactNode
}) => (
    <fieldset className="flex flex-col gap-1.5 border-t border-dhis2-grey-300 pt-3">
        <legend className="pe-2 text-xs font-medium tracking-wide text-dhis2-grey-700 uppercase">
            {title}
        </legend>
        {children}
    </fieldset>
)

const Check = ({
    checked,
    onChange,
    children,
}: {
    checked: boolean
    onChange: (checked: boolean) => void
    children: ReactNode
}) => (
    <label className="flex items-center gap-2 text-sm">
        <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
        />
        {children}
    </label>
)

const LabControls = ({
    config,
    setConfig,
}: {
    config: LabConfig
    setConfig: (config: LabConfig) => void
}) => {
    const set = <K extends keyof LabConfig>(key: K, value: LabConfig[K]) =>
        setConfig({ ...config, [key]: value })
    const toggleType = (id: string, on: boolean) =>
        set(
            'valueTypes',
            VALUE_TYPES.map((type) => type.id).filter((each) =>
                each === id ? on : config.valueTypes.includes(each)
            )
        )

    return (
        <>
            <Section title="Shape">
                <label className="flex items-center justify-between gap-2 text-sm">
                    Rows per table
                    <input
                        type="number"
                        min={1}
                        max={500}
                        value={config.rows}
                        onChange={(event) =>
                            set('rows', Math.max(1, Number(event.target.value)))
                        }
                        className="w-20 rounded border border-dhis2-grey-500 px-1.5 py-0.5"
                    />
                </label>
                <label className="flex items-center justify-between gap-2 text-sm">
                    Tables
                    <input
                        type="number"
                        min={1}
                        max={4}
                        value={config.tables}
                        onChange={(event) =>
                            set(
                                'tables',
                                Math.max(1, Number(event.target.value))
                            )
                        }
                        className="w-20 rounded border border-dhis2-grey-500 px-1.5 py-0.5"
                    />
                </label>
                {FLAGS.map(([key, label]) => (
                    <Check
                        key={key}
                        checked={config[key] === true}
                        onChange={(on) => set(key, on)}
                    >
                        {label}
                    </Check>
                ))}
            </Section>
            <Section title="Saving">
                {SAVE_MODES.map(([mode, label]) => (
                    <label
                        key={mode}
                        className="flex items-center gap-2 text-sm"
                    >
                        <input
                            type="radio"
                            name="save"
                            checked={config.save === mode}
                            onChange={() => set('save', mode)}
                        />
                        {label}
                    </label>
                ))}
            </Section>
            <Section title={`Value types (${config.valueTypes.length})`}>
                <div className="flex gap-3 text-sm">
                    <button
                        type="button"
                        className="text-dhis2-blue-700 underline"
                        onClick={() =>
                            set('valueTypes', DEFAULT_CONFIG.valueTypes)
                        }
                    >
                        All
                    </button>
                    <button
                        type="button"
                        className="text-dhis2-blue-700 underline"
                        onClick={() => set('valueTypes', [])}
                    >
                        None
                    </button>
                </div>
                {VALUE_TYPES.map((type) => (
                    <Check
                        key={type.id}
                        checked={config.valueTypes.includes(type.id)}
                        onChange={(on) => toggleType(type.id, on)}
                    >
                        {type.label}
                        <code className="text-xs text-dhis2-grey-600">
                            {type.field.valueType}
                        </code>
                    </Check>
                ))}
            </Section>
        </>
    )
}

const LiveControls = ({
    options,
    setOptions,
}: {
    options: EventSourceOptions
    setOptions: (options: EventSourceOptions) => void
}) => {
    const [draft, setDraft] = useState(options)
    const fields: [keyof EventSourceOptions, string][] = [
        ['programId', 'Program'],
        ['programStageId', 'Program stage'],
        ['orgUnitId', 'Org unit'],
        ['enrollmentId', 'Enrollment'],
        ['newRowStageId', 'Stage for new rows'],
    ]
    return (
        <>
            <Section title="Presets">
                {Object.entries(PRESETS).map(([name, preset]) => (
                    <button
                        key={name}
                        type="button"
                        className="text-start text-sm text-dhis2-blue-700 underline"
                        onClick={() => {
                            setDraft(preset)
                            setOptions(preset)
                        }}
                    >
                        {name}
                    </button>
                ))}
            </Section>
            <Section title="Any program">
                <form
                    className="flex flex-col gap-1.5"
                    onSubmit={(event) => {
                        event.preventDefault()
                        setOptions(draft)
                    }}
                >
                    {fields.map(([key, label]) => (
                        <label key={key} className="flex flex-col text-sm">
                            {label}
                            <input
                                value={String(draft[key] ?? '')}
                                onChange={(event) =>
                                    setDraft({
                                        ...draft,
                                        [key]: event.target.value || undefined,
                                    })
                                }
                                className="rounded border border-dhis2-grey-500 px-1.5 py-0.5 font-mono"
                            />
                        </label>
                    ))}
                    <button
                        type="submit"
                        className="mt-1 rounded bg-dhis2-blue-700 px-3 py-1 text-sm text-white"
                    >
                        Load
                    </button>
                </form>
            </Section>
        </>
    )
}

const SaveLog = ({ log, clear }: { log: LogEntry[]; clear: () => void }) => (
    <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">What the grid sent</h2>
            <button
                type="button"
                className="text-sm text-dhis2-blue-700 underline"
                onClick={clear}
            >
                Clear
            </button>
        </div>
        {log.length === 0 ? (
            <p className="text-sm text-dhis2-grey-700">Nothing saved yet.</p>
        ) : (
            <ol className="flex flex-col gap-2 font-mono text-xs">
                {log.map(({ at, records }, index) => (
                    <li
                        key={log.length - index}
                        className="rounded bg-dhis2-grey-100 p-2"
                    >
                        <span className="text-dhis2-grey-600">{at}</span>
                        {records.map((record) => (
                            <div key={record.key} className="break-all">
                                {record.key} = {JSON.stringify(record.value)}
                            </div>
                        ))}
                    </li>
                ))}
            </ol>
        )}
    </section>
)

/** Try every grid shape and value type, or any program on the connected DHIS2. */
export const Lab = () => {
    const [mode, setMode] = useState<'lab' | 'live'>('lab')
    const [config, setConfig] = useState(DEFAULT_CONFIG)
    const [live, setLive] = useState<EventSourceOptions>(
        PRESETS['Event program (inpatient)']
    )
    const [rtl, setRtl] = useState(false)
    const [composed, setComposed] = useState(false)
    const [log, setLog] = useState<LogEntry[]>([])

    // Made once per config or program: a source with a new key loads the form again.
    const source = useMemo(
        () =>
            mode === 'lab'
                ? labSource(config, (records) =>
                      setLog((entries) =>
                          [
                              {
                                  at: new Date().toLocaleTimeString(),
                                  records,
                              },
                              ...entries,
                          ].slice(0, 50)
                      )
                  )
                : eventSource(live),
        [mode, config, live]
    )

    return (
        <div className="flex min-h-screen [font-family:Roboto,Helvetica,Arial,sans-serif] text-dhis2-grey-900">
            <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col gap-4 overflow-y-auto border-e border-dhis2-grey-300 bg-dhis2-grey-050 p-4">
                <h1 className="text-base font-medium">Data entry lab</h1>
                <div className="flex rounded border border-dhis2-grey-500 text-sm">
                    {(['lab', 'live'] as const).map((each) => (
                        <button
                            key={each}
                            type="button"
                            aria-pressed={mode === each}
                            onClick={() => setMode(each)}
                            className="flex-1 px-2 py-1 aria-pressed:bg-dhis2-blue-700 aria-pressed:text-white"
                        >
                            {each === 'lab' ? 'Lab form' : 'Live DHIS2'}
                        </button>
                    ))}
                </div>
                <Check checked={rtl} onChange={setRtl}>
                    Right to left
                </Check>
                <Check checked={composed} onChange={setComposed}>
                    Your own layout
                </Check>
                {mode === 'lab' ? (
                    <LabControls config={config} setConfig={setConfig} />
                ) : (
                    <LiveControls options={live} setOptions={setLive} />
                )}
            </aside>
            <main
                dir={rtl ? 'rtl' : 'ltr'}
                className="flex min-w-0 flex-1 flex-col gap-4 p-6"
            >
                <DataEntry key={source.cacheKey ?? source.key} source={source}>
                    <Status />
                    {composed ? <ComposedGrid /> : <DataGrid />}
                    <DataEntrySummary />
                </DataEntry>
                {mode === 'lab' ? (
                    <SaveLog log={log} clear={() => setLog([])} />
                ) : null}
            </main>
        </div>
    )
}
