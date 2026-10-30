import {
    RelationshipViewer,
    RelationshipViewerCanvas,
    RelationshipViewerLayoutToggle,
    RelationshipViewerList,
    RelationshipViewerLegend,
    RelationshipViewerNotices,
    RelationshipViewerSummary,
    type NodeKey,
    type RelationshipNode,
    type RelationshipViewerLayout,
    type RelationshipViewerSeeds,
} from '@/components/relationship-viewer'
import { CustomDataProvider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PanelRightCloseIcon, PanelRightOpenIcon } from 'lucide-react'
import { useMemo, useState, type ComponentProps, type ReactNode } from 'react'
import { LivePreviewHost } from '../../preview/LivePreviewHost'
import { PreviewSpinner } from '../../preview/PreviewShell'
import { box, Section, Segmented } from './controls'
import { generateWorld, LAB_ORG_UNIT, LAB_PROGRAM, type World } from './labData'
import {
    answerLogged,
    type LabRequest,
    type LabServer,
    type RequestLogEntry,
} from './labServer'
import { Changes, HostPanel, RequestLog, StateReadout } from './panels'
import {
    DEFAULT_CONFIG,
    LIVE_PRESETS,
    PRESETS,
    type LabConfig,
    type LabView,
} from './presets'
import {
    dateRule,
    followTypes,
    labelRule,
    statusesFor,
    statusRule,
} from './rules'
import { DataControls, ServerControls, ViewControls } from './settings'

const WIDTHS = [
    ['phone', 'Phone', 'max-w-[380px]'],
    ['narrow', 'Narrow', 'max-w-[640px]'],
    ['wide', 'Wide', 'max-w-[960px]'],
    ['full', 'Full', 'max-w-none'],
] as const

type Width = (typeof WIDTHS)[number][0]

interface Live {
    te: string
    program: string
    orgUnit: string
}

interface Saved {
    mode: 'lab' | 'live'
    config: LabConfig
    live: Live
    width: Width
    panel: boolean
}

const STORAGE_KEY = 'relationship-viewer-lab'

const INITIAL: Saved = {
    mode: 'lab',
    config: DEFAULT_CONFIG,
    live: LIVE_PRESETS[0],
    width: 'full',
    panel: true,
}

// shortcut: trusts whatever this browser saved earlier; Reset clears a broken save.
const load = (): Saved => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw
            ? // SAFETY: only save() below writes this key, with this lab's Saved type; Reset overwrites a stale one.
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

interface ViewerProps {
    view: LabView
    program: string
    seeds: RelationshipViewerSeeds
    selected: NodeKey | undefined
    onSelected: (key: NodeKey | undefined) => void
    onLayout: (layout: RelationshipViewerLayout) => void
    onRecentre: (node: RelationshipNode) => void
    widthClass: string
    readouts: ReactNode
    panel: boolean
    onPanel: (open: boolean) => void
}

/** The block exactly as a host composes it, with every prop from the lab's controls. */
const Viewer = ({
    view,
    program,
    seeds,
    selected,
    onSelected,
    onLayout,
    onRecentre,
    widthClass,
    readouts,
    panel,
    onPanel,
}: ViewerProps) => {
    const statuses = useMemo(
        () => statusesFor(view.attentionRule),
        [view.attentionRule]
    )
    const statusOf = useMemo(() => statusRule(view, program), [view, program])
    const dateOf = useMemo(() => dateRule(view.dateRule), [view.dateRule])
    const labelOf = useMemo(() => labelRule(view.label), [view.label])
    const follow = useMemo(() => followTypes(view), [view])
    const { parts } = view
    return (
        <RelationshipViewer
            seeds={seeds}
            program={program}
            hops={view.hops}
            cap={view.cap}
            followTypes={follow}
            statuses={statuses}
            statusOf={statusOf}
            dateOf={dateOf}
            labelOf={labelOf}
            layout={view.layout}
            onLayoutChange={onLayout}
            selected={selected}
            onSelectedChange={onSelected}
        >
            {/* Its own flex row: live DHIS2 wraps the viewer in the app adapter's plain blocks. */}
            <div className="flex min-h-screen min-w-0 flex-1">
                <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
                    <div
                        className={`flex w-full ${widthClass} flex-col gap-4 rounded border border-dhis2-grey-300 bg-white p-4`}
                    >
                        {parts.toggle && <RelationshipViewerLayoutToggle />}
                        {parts.notices && <RelationshipViewerNotices />}
                        <div className="flex flex-wrap items-start gap-4">
                            <div
                                className="min-w-[280px] flex-1 rounded border border-dhis2-grey-200"
                                style={{ height: view.height }}
                            >
                                <RelationshipViewerCanvas className="h-full" />
                            </div>
                            {(parts.summary || parts.legend) && (
                                <div className="flex w-56 flex-col gap-4">
                                    {parts.summary && (
                                        <RelationshipViewerSummary />
                                    )}
                                    {parts.legend && (
                                        <RelationshipViewerLegend />
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Its own scroll area: selecting in the canvas scrolls the list, never the page. */}
                        {parts.list && (
                            <div className="max-h-[360px] overflow-auto rounded border border-dhis2-grey-300">
                                <RelationshipViewerList className="border-0" />
                            </div>
                        )}
                    </div>
                </main>
                {panel ? (
                    <aside className="sticky top-0 flex h-screen w-80 shrink-0 flex-col gap-6 overflow-y-auto border-s border-dhis2-grey-300 p-4">
                        <button
                            type="button"
                            aria-expanded
                            aria-label="Hide the side panel"
                            title="Hide the side panel"
                            className="self-end rounded p-1 text-dhis2-grey-700 hover:bg-dhis2-grey-100"
                            onClick={() => onPanel(false)}
                        >
                            <PanelRightCloseIcon
                                aria-hidden
                                className="size-4"
                            />
                        </button>
                        <HostPanel onRecentre={onRecentre} />
                        <StateReadout />
                        {readouts}
                    </aside>
                ) : (
                    <aside className="sticky top-0 flex h-screen w-10 shrink-0 justify-center border-s border-dhis2-grey-300 bg-dhis2-grey-050 py-4">
                        <button
                            type="button"
                            aria-expanded={false}
                            aria-label="Show the side panel"
                            title="Show the side panel"
                            className="h-fit rounded p-1 text-dhis2-grey-700 hover:bg-dhis2-grey-100"
                            onClick={() => onPanel(true)}
                        >
                            <PanelRightOpenIcon
                                aria-hidden
                                className="size-4"
                            />
                        </button>
                    </aside>
                )}
            </div>
        </RelationshipViewer>
    )
}

const RESOURCES = [
    'relationshipTypes',
    'trackedEntityTypes',
    'tracker/trackedEntities',
    'tracker/events',
    'tracker/relationships',
]

/** A fake DHIS2 under the block: the shipped fetch and traversal code, answered from the lab's world. */
const LabServerScope = ({
    world,
    server,
    log,
    children,
}: {
    world: World
    server: LabServer
    log: Log
    children: ReactNode
}) => {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: { refetchOnWindowFocus: false, retry: false },
                },
            })
    )
    const data = useMemo(() => {
        const respond = (
            _type: string,
            query: LabRequest,
            options?: { signal?: AbortSignal }
        ) => answerLogged(world, server, query, log, options?.signal)
        // SAFETY: answer() returns plain JSON objects shaped like DHIS2's responses.
        return Object.fromEntries(
            RESOURCES.map((resource) => [resource, respond])
        ) as ComponentProps<typeof CustomDataProvider>['data']
    }, [world, server, log])
    return (
        <QueryClientProvider client={queryClient}>
            <CustomDataProvider data={data}>{children}</CustomDataProvider>
        </QueryClientProvider>
    )
}

const presetGroups = [...new Set(PRESETS.map(({ group }) => group))]

const seedsFor = (
    view: LabView,
    world: World,
    recentred: string | undefined
): RelationshipViewerSeeds => {
    const ref = (id: string) => ({ kind: 'trackedEntity' as const, id })
    if (recentred) return { refs: [ref(recentred)] }
    if (view.start === 'query') {
        return { query: { program: LAB_PROGRAM, orgUnits: LAB_ORG_UNIT } }
    }
    if (view.start === 'cases') {
        return {
            refs: [...world.people.values()]
                .filter((person) => person.classification !== 'Contact')
                .map((person) => ref(person.id)),
        }
    }
    return { refs: [ref(world.indexCase)] }
}

/** The relationship viewer lab: every prop, part and kind of data, beside the requests it makes. */
export const RelationshipLab = () => {
    const [saved, setSaved] = useState(load)
    const { mode, config, live, width } = saved
    const [preset, setPreset] = useState<string>()
    const [run, setRun] = useState(0)
    const [requests, setRequests] = useState<RequestLogEntry[]>([])
    const [changes, setChanges] = useState<string[]>([])
    const [selected, setSelected] = useState<NodeKey>()
    const [recentred, setRecentred] = useState<string>()

    const update = (next: Partial<Saved>) => {
        const merged = { ...saved, ...next }
        setSaved(merged)
        save(merged)
    }
    const setConfig = (next: LabConfig) => update({ config: next })
    const setView = (view: LabView) => update({ config: { ...config, view } })
    const restart = () => {
        setRequests([])
        setSelected(undefined)
        setRecentred(undefined)
        setRun((count) => count + 1)
    }
    const note = (entry: string) =>
        setChanges((entries) => [entry, ...entries].slice(0, 50))

    const world = useMemo(() => generateWorld(config.data), [config.data])
    const widthClass =
        WIDTHS.find(([option]) => option === width)?.[2] ?? 'max-w-none'

    const readouts = (
        <>
            <Changes entries={changes} onClear={() => setChanges([])} />
            {mode === 'lab' && (
                <RequestLog
                    entries={requests}
                    onClear={() => setRequests([])}
                />
            )}
        </>
    )
    const viewer = {
        view: config.view,
        panel: saved.panel,
        onPanel: (open: boolean) => update({ panel: open }),
        selected,
        onSelected: (key: NodeKey | undefined) => {
            note(`onSelectedChange(${key ?? 'undefined'})`)
            setSelected(key)
        },
        onLayout: (layout: RelationshipViewerLayout) => {
            note(`onLayoutChange('${layout}')`)
            setView({ ...config.view, layout })
        },
        widthClass,
        readouts,
    }

    let liveSeeds: RelationshipViewerSeeds | undefined
    if (live.orgUnit && live.program) {
        liveSeeds = { query: { program: live.program, orgUnits: live.orgUnit } }
    } else if (recentred || live.te) {
        liveSeeds = {
            refs: [{ kind: 'trackedEntity', id: recentred ?? live.te }],
        }
    }
    const recentre = (node: RelationshipNode) => {
        note(`re-centre on ${node.ref.id}`)
        setSelected(undefined)
        setRecentred(node.ref.id)
    }

    return (
        <div className="flex min-h-screen [font-family:Roboto,Helvetica,Arial,sans-serif] text-dhis2-grey-900">
            <aside className="sticky top-0 flex h-screen w-80 shrink-0 flex-col gap-4 overflow-y-auto border-e border-dhis2-grey-300 bg-dhis2-grey-050 p-4">
                <h1 className="text-base font-medium">
                    Relationship viewer lab
                </h1>
                <Segmented
                    value={mode}
                    options={[
                        ['lab', 'Lab outbreak'],
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
                        <DataControls
                            data={config.data}
                            onChange={(data) => {
                                setConfig({ ...config, data })
                                setRecentred(undefined)
                            }}
                        />
                        <ViewControls
                            view={config.view}
                            live={false}
                            onChange={setView}
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
                        <Section title="Live starting points">
                            {LIVE_PRESETS.map((each) => (
                                <button
                                    key={each.name}
                                    type="button"
                                    aria-pressed={
                                        live.te === each.te &&
                                        live.orgUnit === each.orgUnit
                                    }
                                    className="rounded px-1.5 py-0.5 text-start text-sm text-dhis2-blue-700 hover:bg-dhis2-blue-050 aria-pressed:bg-dhis2-blue-700 aria-pressed:text-white"
                                    onClick={() => {
                                        update({ live: each })
                                        restart()
                                    }}
                                >
                                    {each.name}
                                </button>
                            ))}
                            <form
                                className="flex flex-col gap-1"
                                onSubmit={(event) => {
                                    event.preventDefault()
                                    const form = new FormData(
                                        event.currentTarget
                                    )
                                    const field = (name: string) =>
                                        String(form.get(name) ?? '').trim()
                                    update({
                                        live: {
                                            te: field('te'),
                                            program: field('program'),
                                            orgUnit: field('orgUnit'),
                                        },
                                    })
                                    restart()
                                }}
                            >
                                {(
                                    [
                                        ['te', 'Tracked entity uid'],
                                        ['program', 'Program uid'],
                                        [
                                            'orgUnit',
                                            'Or seeds from org unit uid',
                                        ],
                                    ] as const
                                ).map(([name, label]) => (
                                    <input
                                        key={`${name}:${live[name]}`}
                                        name={name}
                                        defaultValue={live[name]}
                                        placeholder={label}
                                        aria-label={label}
                                        className={`${box} font-mono`}
                                    />
                                ))}
                                <button
                                    type="submit"
                                    className="self-start rounded border border-dhis2-grey-500 px-2 text-sm"
                                >
                                    Load
                                </button>
                            </form>
                        </Section>
                        <ViewControls
                            view={config.view}
                            live
                            onChange={setView}
                        />
                    </>
                )}
                <Section title="Frame">
                    <Segmented
                        value={width}
                        options={WIDTHS}
                        onChange={(next) => update({ width: next })}
                    />
                    <button
                        type="button"
                        className="self-start rounded border border-dhis2-grey-500 px-2 py-0.5 text-sm"
                        onClick={restart}
                    >
                        Remount
                    </button>
                </Section>
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
            {mode === 'lab' ? (
                <LabServerScope
                    key={`${run}:${JSON.stringify(config.data)}:${JSON.stringify(config.server)}`}
                    world={world}
                    server={config.server}
                    log={setRequests}
                >
                    <Viewer
                        {...viewer}
                        program={LAB_PROGRAM}
                        seeds={seedsFor(config.view, world, recentred)}
                        onRecentre={recentre}
                    />
                </LabServerScope>
            ) : (
                <div
                    key={run}
                    className="docs-preview-surface flex min-w-0 flex-1"
                >
                    {liveSeeds ? (
                        <LivePreviewHost placeholder={<PreviewSpinner />}>
                            <Viewer
                                {...viewer}
                                program={live.program}
                                seeds={liveSeeds}
                                onRecentre={recentre}
                            />
                        </LivePreviewHost>
                    ) : (
                        <p className="p-6 text-sm text-dhis2-grey-700">
                            Name a tracked entity, or a program and an org unit.
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
