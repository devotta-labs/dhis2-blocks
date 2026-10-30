import { Button } from '@/components/dhis2/ui/button'
import {
    isMarkedForFollowUp,
    RelationshipViewer,
    RelationshipViewerCanvas,
    RelationshipViewerLayoutToggle,
    RelationshipViewerLegend,
    RelationshipViewerList,
    RelationshipViewerNotices,
    RelationshipViewerSummary,
    useRelationshipViewerMeta,
    useRelationshipViewerState,
    type RelationshipNode,
    type RelationshipStatus,
    type RelationshipViewerSeeds,
} from '@/components/relationship-viewer'
import type { ResourceRequest } from '@/components/relationship-viewer/api/client'
import { fakeEngine } from '@/components/relationship-viewer/ui/__tests__/fakeEngine'
import { FIXTURE_PROGRAM } from '@/components/relationship-viewer/__tests__/fixtures'
import { CustomDataProvider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, {
    useMemo,
    useState,
    type ComponentProps,
    type ReactNode,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import i18n from '../../i18n'
import { readLabState, writeLabState, type LabState } from './labUrlState'
import { SCENARIO_IDS, scenario, type Scenario } from './scenarios'

// The seeded e2e "Contact tracing" program and its hub case.
const LIVE_PROGRAM = 'RvE2ePrg001'
const LIVE_CASE = 'RvE2eTei010'

const FIXTURE_RESOURCES = [
    'tracker/trackedEntities',
    'tracker/relationships',
    'relationshipTypes',
    'trackedEntityTypes',
]

// Declared outside the component so they keep their identity across renders.
const statuses: RelationshipStatus[] = [
    {
        key: 'case',
        label: 'Case',
        color: 'var(--color-dhis2-red-600)',
        size: 'large',
    },
    {
        key: 'followUp',
        label: 'Marked for follow-up',
        color: 'var(--color-dhis2-yellow-600)',
        attention: true,
    },
    { key: 'contact', label: 'Contact', color: 'var(--color-dhis2-blue-600)' },
]

const statusRule = (program: string) => (node: RelationshipNode) => {
    if (node.seed) return 'case'
    if (isMarkedForFollowUp(node, program)) return 'followUp'
    return 'contact'
}

/** Fixture people carry their name in a `name` attribute; real ones use the block's label. */
const labelOf = (node: RelationshipNode, defaultLabel: string) =>
    (node.state.status === 'loaded' &&
        node.state.record.attributes.find((a) => a.attribute === 'name')
            ?.value) ||
    defaultLabel

const FIELD =
    'h-9 rounded-md border border-[#a0adba] bg-white px-2 text-sm text-[#212934]'

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
    <label className="flex flex-col gap-1 text-sm text-[#4a5768]">
        {label}
        {children}
    </label>
)

/** The fake server: the block's real fetch and traversal code over fixture records, with its own cache so a scenario never sees another's records. */
const FixtureServer = ({
    fixture,
    children,
}: {
    fixture: Scenario
    children: ReactNode
}) => {
    const [client] = useState(
        () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
    )
    const data = useMemo(() => {
        const { engine } = fakeEngine(fixture.records, { fail: fixture.fail })
        const respond = async (_type: string, query: ResourceRequest) =>
            (await engine.query({ result: query })).result
        // SAFETY: fakeEngine answers with plain JSON objects built from fixture records.
        return Object.fromEntries(
            FIXTURE_RESOURCES.map((resource) => [resource, respond])
        ) as ComponentProps<typeof CustomDataProvider>['data']
    }, [fixture])
    return (
        <QueryClientProvider client={client}>
            <CustomDataProvider data={data}>{children}</CustomDataProvider>
        </QueryClientProvider>
    )
}

/** What a host does with the selection: show it, and re-centre on it. */
const HostPanel = ({ onRecentre }: { onRecentre(id: string): void }) => {
    const { graph, selected } = useRelationshipViewerState()
    const { labelOf: label, statusOf } = useRelationshipViewerMeta()
    const node = selected && graph?.nodes.get(selected)
    if (!node) {
        return (
            <p className="m-0 text-sm text-[#6c7787]">
                {i18n.t('Select a record to see what the host receives.')}
            </p>
        )
    }
    const rows: [string, string | number][] = [
        [i18n.t('Label'), label(node)],
        [i18n.t('Key'), node.key],
        [i18n.t('Hop'), node.hop],
        [
            i18n.t('Status'),
            (node.state.status === 'loaded' && statusOf(node)?.label) ||
                i18n.t('None'),
        ],
        [i18n.t('Unloaded links'), node.stubCount],
        [i18n.t('Other links'), node.otherLinkCount],
    ]
    return (
        <section aria-label={i18n.t('Selected record')} className="grid gap-2">
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {rows.map(([term, value]) => (
                    <div key={term} className="contents">
                        <dt className="text-[#6c7787]">{term}</dt>
                        <dd className="m-0 break-all">{value}</dd>
                    </div>
                ))}
            </dl>
            <Button
                variant="secondary"
                size="sm"
                className="justify-self-start"
                onClick={() => onRecentre(node.ref.id)}
            >
                {i18n.t('Re-centre here')}
            </Button>
        </section>
    )
}

const Controls = ({
    state,
    apply,
}: {
    state: LabState
    apply(next: LabState): void
}) => {
    const [draft, setDraft] = useState(state)
    const set = (patch: Partial<LabState>) => setDraft({ ...draft, ...patch })
    const number = (value: string) => (value === '' ? undefined : Number(value))
    return (
        <form
            aria-label={i18n.t('Lab controls')}
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
                event.preventDefault()
                apply(draft)
            }}
        >
            <Field label={i18n.t('Source')}>
                <select
                    className={FIELD}
                    value={draft.source}
                    onChange={(e) =>
                        set({
                            source:
                                e.target.value === 'live' ? 'live' : 'fixture',
                        })
                    }
                >
                    <option value="fixture">{i18n.t('Fixture')}</option>
                    <option value="live">{i18n.t('Live DHIS2')}</option>
                </select>
            </Field>
            {draft.source === 'fixture' ? (
                <>
                    <Field label={i18n.t('Scenario')}>
                        <select
                            className={FIELD}
                            value={draft.scenario}
                            onChange={(e) =>
                                set({
                                    scenario:
                                        SCENARIO_IDS.find(
                                            (id) => id === e.target.value
                                        ) ?? draft.scenario,
                                    seed: undefined,
                                })
                            }
                        >
                            {SCENARIO_IDS.map((id) => (
                                <option key={id} value={id}>
                                    {scenario(id, 10).label()}
                                </option>
                            ))}
                        </select>
                    </Field>
                    {draft.scenario === 'outbreak' && (
                        <Field label={i18n.t('People')}>
                            <input
                                className={FIELD}
                                type="number"
                                value={draft.size}
                                onChange={(e) =>
                                    set({ size: Number(e.target.value) })
                                }
                            />
                        </Field>
                    )}
                </>
            ) : (
                <>
                    <Field label={i18n.t('Tracked entity')}>
                        <input
                            className={FIELD}
                            value={draft.te ?? ''}
                            placeholder={LIVE_CASE}
                            onChange={(e) => set({ te: e.target.value })}
                        />
                    </Field>
                    <Field label={i18n.t('Program')}>
                        <input
                            className={FIELD}
                            value={draft.program ?? ''}
                            placeholder={LIVE_PROGRAM}
                            onChange={(e) => set({ program: e.target.value })}
                        />
                    </Field>
                    <Field label={i18n.t('Or seeds from org unit')}>
                        <input
                            className={FIELD}
                            value={draft.orgUnit ?? ''}
                            onChange={(e) => set({ orgUnit: e.target.value })}
                        />
                    </Field>
                </>
            )}
            <Field label={i18n.t('Hops')}>
                <input
                    className={`${FIELD} w-20`}
                    type="number"
                    value={draft.hops ?? ''}
                    placeholder={i18n.t('Default')}
                    onChange={(e) => set({ hops: number(e.target.value) })}
                />
            </Field>
            <Field label={i18n.t('Cap')}>
                <input
                    className={`${FIELD} w-24`}
                    type="number"
                    value={draft.cap}
                    onChange={(e) => set({ cap: Number(e.target.value) })}
                />
            </Field>
            <Button type="submit">{i18n.t('Apply')}</Button>
        </form>
    )
}

/** A bench for the relationship viewer: real or fixture data, every part, and the host's view of the selection. */
export const RelationshipViewerLab = () => {
    const [params, setParams] = useSearchParams()
    const state = readLabState(params)
    // Round-trip through the URL so bad values are clamped the same way on reload.
    const apply = (next: LabState) =>
        setParams(writeLabState(readLabState(writeLabState(next))))

    const fixture = useMemo(
        () =>
            state.source === 'fixture'
                ? scenario(state.scenario, state.size)
                : undefined,
        [state.source, state.scenario, state.size]
    )
    const program = fixture ? FIXTURE_PROGRAM : (state.program ?? LIVE_PROGRAM)
    let seeds: RelationshipViewerSeeds
    if (fixture) {
        seeds = {
            refs: (state.seed ? [state.seed] : fixture.seeds).map((id) => ({
                kind: 'trackedEntity' as const,
                id,
            })),
        }
    } else if (state.orgUnit) {
        seeds = { query: { program, orgUnits: state.orgUnit } }
    } else {
        seeds = { refs: [{ kind: 'trackedEntity', id: state.te ?? LIVE_CASE }] }
    }
    const hops = state.hops ?? fixture?.hops ?? 1
    const statusOf = useMemo(() => statusRule(program), [program])

    const recentre = (id: string) =>
        apply(
            fixture
                ? { ...state, seed: id }
                : { ...state, te: id, orgUnit: undefined }
        )

    const viewer = (
        <RelationshipViewer
            key={JSON.stringify(seeds)}
            seeds={seeds}
            program={program}
            hops={hops}
            cap={state.cap}
            statuses={statuses}
            statusOf={statusOf}
            labelOf={labelOf}
            layout={state.layout}
            onLayoutChange={(layout) => apply({ ...state, layout })}
        >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="grid min-w-0 content-start gap-3">
                    <RelationshipViewerLayoutToggle />
                    <RelationshipViewerNotices />
                    <RelationshipViewerCanvas className="h-[70vh] rounded-md border border-[#d5dde5] bg-white" />
                </div>
                <aside className="grid content-start gap-4">
                    <HostPanel onRecentre={recentre} />
                    <RelationshipViewerSummary />
                    <RelationshipViewerLegend />
                </aside>
            </div>
            <RelationshipViewerList className="mt-4" />
        </RelationshipViewer>
    )

    return (
        <main className="grid gap-4 p-4">
            <div>
                <h1 className="m-0 text-lg font-medium">
                    {i18n.t('Relationship viewer lab')}
                </h1>
                <p className="m-0 max-w-3xl text-sm leading-6 text-[#4a5768]">
                    {i18n.t(
                        'Try the block on real or deliberately awkward data. Every control is in the URL, so a case can be reloaded and shared.'
                    )}
                </p>
            </div>
            <Controls key={params.toString()} state={state} apply={apply} />
            {fixture ? (
                <FixtureServer
                    key={`${state.scenario}:${state.size}`}
                    fixture={fixture}
                >
                    {viewer}
                </FixtureServer>
            ) : (
                viewer
            )}
        </main>
    )
}
