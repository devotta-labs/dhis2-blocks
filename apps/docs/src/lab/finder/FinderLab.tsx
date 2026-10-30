import { useDataEngine } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
    createTrackedEntityFinderClient,
    useFinderProgram,
    type DataEngineLike,
    type FinderPerson,
} from '@/components/tracked-entity-finder'
import { LivePreviewHost } from '../../preview/LivePreviewHost'
import { PreviewSpinner } from '../../preview/PreviewShell'
import {
    Check,
    ProgramControls,
    Section,
    ServerControls,
    type KnownAttribute,
} from './controls'
import { CompositionControls } from './CompositionControls'
import type { LabComposition, LabConfig } from './labConfig'
import { DEFAULT_CONFIG, LIVE_PRESETS, PRESETS } from './presets'
import { LabFinder } from './LabFinder'
import { labEngine, loggingEngine, type RequestLogEntry } from './labServer'

const WIDTHS = [
    ['phone', 'Phone', 'max-w-[360px]'],
    ['narrow', 'Narrow', 'max-w-[480px]'],
    ['wide', 'Wide', 'max-w-[800px]'],
    ['full', 'Full', 'max-w-none'],
] as const

type Width = (typeof WIDTHS)[number][0]

interface Live {
    program: string
    composition: LabComposition
}

interface Saved {
    mode: 'lab' | 'live'
    config: LabConfig
    live: Live
}

const STORAGE_KEY = 'tracked-entity-finder-lab'

const liveComposition = (forms: LabComposition['forms']): LabComposition => ({
    ...DEFAULT_CONFIG.composition,
    forms,
    formLayout: 'swap',
    rowAttributes: [],
})

const FIRST_LIVE = LIVE_PRESETS[0]

const INITIAL: Saved = {
    mode: 'lab',
    config: DEFAULT_CONFIG,
    live: {
        program: FIRST_LIVE.program,
        composition: liveComposition(FIRST_LIVE.forms),
    },
}

// shortcut: trusts whatever this browser saved earlier; Reset clears a broken save.
const load = (): Saved => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw
            ? // SAFETY: only save() below writes this key, with this lab's Saved shape; Reset overwrites a stale one.
              { ...INITIAL, ...(JSON.parse(raw) as Partial<Saved>) }
            : INITIAL
    } catch {
        return INITIAL
    }
}

const save = (saved: Saved) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    } catch {
        // Private windows can refuse storage; the lab still works without it.
    }
}

type Log = (update: (entries: RequestLogEntry[]) => RequestLogEntry[]) => void

/** A fresh cache per run (key it by the run), so metadata is never stale. */
const RunScope = ({ children }: { children: ReactNode }) => {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: { queries: { refetchOnWindowFocus: false } },
            })
    )
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

interface CanvasProps {
    composition: LabComposition
    readouts: boolean
    onSelect: (person: FinderPerson) => void
    log: Log
    run: number
}

const LabCanvas = ({
    config,
    ...props
}: CanvasProps & { config: LabConfig }) => {
    const { program, server } = config
    const { log, run } = props
    const client = useMemo(
        () =>
            createTrackedEntityFinderClient(
                loggingEngine(
                    labEngine({ ...DEFAULT_CONFIG, program, server }),
                    log
                )
            ),
        [program, server, log]
    )
    // Any program or server change is a new run: fresh cache, fresh finder.
    return (
        <RunScope key={`${run}:${JSON.stringify([program, server])}`}>
            <LabFinder
                program="labProgram"
                client={client}
                composition={props.composition}
                readouts={props.readouts}
                onSelect={props.onSelect}
            />
        </RunScope>
    )
}

/** Hands the live program's searchable attributes to the composer. */
const LiveAttributes = ({
    onChange,
}: {
    onChange: (attributes: KnownAttribute[]) => void
}) => {
    const { searchableAttributes } = useFinderProgram()
    useEffect(() => {
        onChange([...searchableAttributes])
    }, [searchableAttributes, onChange])
    return null
}

const LiveCanvas = ({
    program,
    onAttributes,
    ...props
}: CanvasProps & {
    program: string
    onAttributes: (attributes: KnownAttribute[]) => void
}) => {
    const engine = useDataEngine()
    const { log, run } = props
    const client = useMemo(
        () =>
            createTrackedEntityFinderClient(
                loggingEngine(
                    {
                        query: (query, options) =>
                            // SAFETY: the finder query is app-runtime's data-query shape; the finder validates every response.
                            engine.query(
                                query as Parameters<typeof engine.query>[0],
                                options
                            ) as ReturnType<DataEngineLike['query']>,
                    },
                    log
                )
            ),
        [engine, log]
    )
    return (
        <RunScope key={`${run}:${program}`}>
            <LabFinder
                program={program}
                client={client}
                composition={props.composition}
                readouts={props.readouts}
                onSelect={props.onSelect}
            >
                <LiveAttributes onChange={onAttributes} />
            </LabFinder>
        </RunScope>
    )
}

const outcomeClass = {
    pending: 'text-dhis2-grey-700',
    ok: 'text-dhis2-green-800',
    failed: 'text-dhis2-red-700',
    aborted: 'text-dhis2-yellow-800',
} satisfies Record<RequestLogEntry['outcome'], string>

const Panel = ({
    title,
    onClear,
    children,
}: {
    title: string
    onClear: () => void
    children: ReactNode
}) => (
    <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">{title}</h2>
            <button
                type="button"
                className="text-sm text-dhis2-blue-700 underline"
                onClick={onClear}
            >
                Clear
            </button>
        </div>
        {children}
    </section>
)

const RequestLog = ({
    entries,
    onClear,
}: {
    entries: RequestLogEntry[]
    onClear: () => void
}) => (
    <Panel title="Requests" onClear={onClear}>
        {entries.length === 0 ? (
            <p className="text-sm text-dhis2-grey-700">No requests yet.</p>
        ) : (
            <ol className="flex flex-col gap-1.5 font-mono text-[11px] leading-4">
                {entries.map((entry) => {
                    const filters = entry.params?.filter
                    return (
                        <li
                            key={entry.id}
                            className="rounded bg-dhis2-grey-100 p-1.5"
                        >
                            <div className="flex justify-between gap-2">
                                <span>
                                    {entry.resource}
                                    {entry.params?.page
                                        ? ` p${String(entry.params.page)}`
                                        : ''}
                                </span>
                                <span className={outcomeClass[entry.outcome]}>
                                    {entry.outcome}
                                    {entry.ms === undefined
                                        ? ''
                                        : ` ${entry.ms}ms`}
                                </span>
                            </div>
                            {Array.isArray(filters)
                                ? filters.map((filter) => (
                                      <div
                                          key={String(filter)}
                                          className="break-all text-dhis2-grey-800"
                                      >
                                          {String(filter)}
                                      </div>
                                  ))
                                : null}
                            {entry.detail ? (
                                <div className="break-all text-dhis2-red-700">
                                    {entry.detail}
                                </div>
                            ) : null}
                            <div className="text-dhis2-grey-600">
                                {entry.at}
                            </div>
                        </li>
                    )
                })}
            </ol>
        )}
    </Panel>
)

const Selections = ({
    people,
    onClear,
}: {
    people: FinderPerson[]
    onClear: () => void
}) => (
    <Panel title="onSelect" onClear={onClear}>
        {people.length === 0 ? (
            <p className="text-sm text-dhis2-grey-700">Nobody selected yet.</p>
        ) : (
            <ol className="flex flex-col gap-1.5">
                {people.map((person, index) => (
                    <li key={people.length - index}>
                        <pre className="overflow-x-auto rounded bg-dhis2-grey-100 p-1.5 text-[11px] leading-4">
                            {JSON.stringify(person, null, 1)}
                        </pre>
                    </li>
                ))}
            </ol>
        )}
    </Panel>
)

const Segmented = <T extends string>({
    value,
    options,
    onChange,
}: {
    value: T
    options: ReadonlyArray<readonly [T, string, ...unknown[]]>
    onChange: (value: T) => void
}) => (
    <div className="flex rounded border border-dhis2-grey-500 text-sm">
        {options.map(([option, label]) => (
            <button
                key={option}
                type="button"
                aria-pressed={value === option}
                onClick={() => onChange(option)}
                className="flex-1 px-2 py-1 aria-pressed:bg-dhis2-blue-700 aria-pressed:text-white"
            >
                {label}
            </button>
        ))}
    </div>
)

const presetGroups = [...new Set(PRESETS.map(({ group }) => group))]

/** The tracked entity finder lab: every rule, answer and composition, side by side with what it sent. */
export const FinderLab = () => {
    const [saved, setSaved] = useState(load)
    const { mode, config, live } = saved
    const [preset, setPreset] = useState<string>()
    const [rtl, setRtl] = useState(false)
    const [width, setWidth] = useState<Width>('narrow')
    const [readouts, setReadouts] = useState(true)
    const [run, setRun] = useState(0)
    const [requests, setRequests] = useState<RequestLogEntry[]>([])
    const [selected, setSelected] = useState<FinderPerson[]>([])
    const [liveAttributes, setLiveAttributes] = useState<KnownAttribute[]>([])

    const update = (next: Partial<Saved>) => {
        const merged = { ...saved, ...next }
        setSaved(merged)
        save(merged)
    }
    const setConfig = (next: LabConfig) => update({ config: next })
    const setComposition = (composition: LabComposition) =>
        mode === 'lab'
            ? setConfig({ ...config, composition })
            : update({ live: { ...live, composition } })
    const restart = () => {
        setRequests([])
        setRun((count) => count + 1)
    }

    const onSelect = (person: FinderPerson) =>
        setSelected((people) => [person, ...people].slice(0, 20))

    const known: KnownAttribute[] =
        mode === 'lab' ? config.program.attributes : liveAttributes
    const composition = mode === 'lab' ? config.composition : live.composition
    const widthClass =
        WIDTHS.find(([option]) => option === width)?.[2] ?? 'max-w-none'
    const canvas = {
        composition,
        readouts,
        onSelect,
        log: setRequests,
        run,
    }

    return (
        <div className="flex min-h-screen [font-family:Roboto,Helvetica,Arial,sans-serif] text-dhis2-grey-900">
            <aside className="sticky top-0 flex h-screen w-80 shrink-0 flex-col gap-4 overflow-y-auto border-e border-dhis2-grey-300 bg-dhis2-grey-050 p-4">
                <h1 className="text-base font-medium">
                    Tracked entity finder lab
                </h1>
                <Segmented
                    value={mode}
                    options={[
                        ['lab', 'Lab program'],
                        ['live', 'Live DHIS2'],
                    ]}
                    onChange={(next) => {
                        update({ mode: next })
                        restart()
                    }}
                />
                {mode === 'lab' ? (
                    <>
                        <Section title="Presets">
                            {presetGroups.map((group) => (
                                <div
                                    key={group}
                                    className="flex flex-col gap-0.5"
                                >
                                    <span className="text-xs text-dhis2-grey-700">
                                        {group}
                                    </span>
                                    {PRESETS.filter(
                                        (each) => each.group === group
                                    ).map((each) => (
                                        <button
                                            key={each.name}
                                            type="button"
                                            aria-pressed={preset === each.name}
                                            className="rounded px-1.5 py-0.5 text-start text-sm text-dhis2-blue-700 hover:bg-dhis2-blue-050 aria-pressed:bg-dhis2-blue-700 aria-pressed:text-white"
                                            onClick={() => {
                                                setPreset(each.name)
                                                setConfig(each.config)
                                                restart()
                                            }}
                                        >
                                            {each.name}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </Section>
                        <CompositionControls
                            composition={composition}
                            known={known}
                            onChange={setComposition}
                        />
                        <ProgramControls
                            program={config.program}
                            onChange={(program) =>
                                setConfig({ ...config, program })
                            }
                        />
                        <ServerControls
                            server={config.server}
                            onChange={(server) =>
                                setConfig({ ...config, server })
                            }
                        />
                    </>
                ) : (
                    <>
                        <Section title="Live programs">
                            {LIVE_PRESETS.map((each) => (
                                <button
                                    key={each.name}
                                    type="button"
                                    aria-pressed={live.program === each.program}
                                    className="rounded px-1.5 py-0.5 text-start text-sm text-dhis2-blue-700 hover:bg-dhis2-blue-050 aria-pressed:bg-dhis2-blue-700 aria-pressed:text-white"
                                    onClick={() =>
                                        update({
                                            live: {
                                                program: each.program,
                                                composition: liveComposition(
                                                    each.forms
                                                ),
                                            },
                                        })
                                    }
                                >
                                    {each.name}
                                </button>
                            ))}
                            <form
                                className="flex gap-1"
                                onSubmit={(event) => {
                                    event.preventDefault()
                                    const program = String(
                                        new FormData(event.currentTarget).get(
                                            'program'
                                        ) ?? ''
                                    ).trim()
                                    if (program) {
                                        update({
                                            live: {
                                                program,
                                                composition: liveComposition([
                                                    [],
                                                ]),
                                            },
                                        })
                                    }
                                }}
                            >
                                <input
                                    name="program"
                                    placeholder="Any program uid"
                                    aria-label="Program uid"
                                    className="min-w-0 flex-1 rounded border border-dhis2-grey-500 bg-white px-1.5 py-0.5 font-mono text-sm"
                                />
                                <button
                                    type="submit"
                                    className="rounded border border-dhis2-grey-500 px-2 text-sm"
                                >
                                    Load
                                </button>
                            </form>
                        </Section>
                        <CompositionControls
                            composition={composition}
                            known={known}
                            onChange={setComposition}
                        />
                    </>
                )}
                <button
                    type="button"
                    className="self-start text-sm text-dhis2-red-700 underline"
                    onClick={() => {
                        setPreset(undefined)
                        update(INITIAL)
                        restart()
                    }}
                >
                    Reset the lab
                </button>
            </aside>
            <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
                <div className="flex flex-wrap items-center gap-4">
                    <Segmented
                        value={width}
                        options={WIDTHS}
                        onChange={setWidth}
                    />
                    <Check checked={rtl} onChange={setRtl}>
                        Right to left
                    </Check>
                    <Check checked={readouts} onChange={setReadouts}>
                        State readouts
                    </Check>
                    <button
                        type="button"
                        className="rounded border border-dhis2-grey-500 px-2 py-1 text-sm"
                        onClick={restart}
                    >
                        Remount
                    </button>
                </div>
                <div
                    dir={rtl ? 'rtl' : 'ltr'}
                    className={`w-full ${widthClass} rounded border border-dhis2-grey-300 bg-white p-6`}
                >
                    {mode === 'lab' ? (
                        <LabCanvas config={config} {...canvas} />
                    ) : (
                        // The docs' preview surface sizes the adapter to this frame.
                        <div className="docs-preview-surface">
                            <LivePreviewHost placeholder={<PreviewSpinner />}>
                                <LiveCanvas
                                    program={live.program}
                                    onAttributes={setLiveAttributes}
                                    {...canvas}
                                />
                            </LivePreviewHost>
                        </div>
                    )}
                </div>
            </main>
            <aside className="sticky top-0 flex h-screen w-80 shrink-0 flex-col gap-6 overflow-y-auto border-s border-dhis2-grey-300 p-4">
                <Selections people={selected} onClear={() => setSelected([])} />
                <RequestLog
                    entries={requests}
                    onClear={() => setRequests([])}
                />
            </aside>
        </div>
    )
}
