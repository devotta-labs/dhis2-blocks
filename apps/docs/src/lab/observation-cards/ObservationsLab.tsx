import {
    ObservationCard,
    ObservationLabel,
    ObservationRecorded,
    ObservationSparkline,
    ObservationsProvider,
    ObservationValue,
} from '@/components/observation-cards'
import { useMemo, useState } from 'react'
import { LivePreviewHost } from '../../preview/LivePreviewHost'
import { PreviewSpinner } from '../../preview/PreviewShell'
import { PresetControls, Section, Segmented } from '../controls'
import { LabLayout } from '../LabLayout'
import { CanvasBoundary, LabServerScope } from '../LabServer'
import { NetworkControls } from '../NetworkControls'
import type { LabNetwork, RequestLogEntry } from '../network'
import { RequestWaterfall } from '../RequestWaterfall'
import {
    generateLabData,
    LAB_PERSON,
    LAB_PROGRAM,
    NOT_IN_PROGRAM,
    SMOKER,
    SUBJECT,
    subjectLabel,
    WEIGHT,
    type LabSettings,
} from './labData'
import { answer, RESOURCES } from './labServer'
import { SeriesReadout } from './panels'
import { DEFAULT_SETTINGS, PRESETS } from './presets'
import { CardControls, DataControls, ServerControls } from './settings'

interface Live {
    programId: string
    personId: string
    dataElementId: string
}

interface Saved {
    mode: 'lab' | 'live'
    preset?: string
    settings: LabSettings
    live: Live
}

interface CardSpec {
    dataElement: string
    unit?: string
}

const STORAGE_KEY = 'observation-cards-lab'

/** Settings that only change props or the lab's layout, so the cards keep their data. */
const IN_PLACE = new Set([
    'arrangement',
    'staleAfterDays',
    'cardWidth',
    'cardsPerRow',
])

const DEFAULT_SAVED: Saved = {
    mode: 'lab',
    preset: 'Vitals panel',
    settings: PRESETS[0]?.settings ?? DEFAULT_SETTINGS,
    // The docs example's person and program on the Sierra Leone demo.
    live: {
        programId: 'WSGAb5XwJ3Y',
        personId: 'Y8aEiTpHSSQ',
        dataElementId: 'vANAXwtLwcT',
    },
}

const load = (): Saved => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return DEFAULT_SAVED
        const parsed: Partial<Saved> = JSON.parse(stored)
        return {
            ...DEFAULT_SAVED,
            ...parsed,
            settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
            live: { ...DEFAULT_SAVED.live, ...parsed.live },
        }
    } catch {
        return DEFAULT_SAVED
    }
}

const save = (saved: Saved) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    } catch {
        // Storage is a convenience; the lab works without it.
    }
}

/** The cards on a grid of the chosen width, with the first card's series beside them. */
const Cards = ({
    cards,
    settings,
}: {
    cards: CardSpec[]
    settings: LabSettings
}) => (
    <div className="flex flex-wrap items-start gap-4">
        <div
            className="grid gap-4"
            style={{
                gridTemplateColumns: `repeat(${settings.cardsPerRow}, ${settings.cardWidth}px)`,
            }}
        >
            {cards.map(({ dataElement, unit }) => (
                <ObservationCard
                    key={dataElement}
                    dataElement={dataElement}
                    unit={unit}
                    staleAfterDays={settings.staleAfterDays || undefined}
                >
                    {settings.arrangement === 'composed' ? (
                        <>
                            <ObservationLabel />
                            <ObservationValue />
                            <ObservationSparkline points={6} />
                            <ObservationRecorded />
                        </>
                    ) : null}
                </ObservationCard>
            ))}
        </div>
        {cards[0] && <SeriesReadout dataElement={cards[0].dataElement} />}
    </div>
)

/** Settled requests per resource; StrictMode's remount aborts each first request, counted apart. */
const requestCounts = (requests: RequestLogEntry[]) => {
    const settled = requests.filter(({ outcome }) => outcome !== 'aborted')
    const counts = RESOURCES.map(
        (resource) =>
            `${resource} ${settled.filter(({ request }) => request.resource === resource).length}`
    )
    return [...counts, `${requests.length - settled.length} aborted`].join(
        ' · '
    )
}

/** The observation cards lab: every card state, one click each, beside the requests it makes. */
export const ObservationsLab = () => {
    const [saved, setSaved] = useState(load)
    const { mode, settings, live } = saved
    const [run, setRun] = useState(0)
    const [requests, setRequests] = useState<RequestLogEntry[]>([])

    const update = (next: Partial<Saved>) => {
        const merged = { ...saved, ...next }
        setSaved(merged)
        save(merged)
    }
    const restart = () => {
        setRequests([])
        setRun((count) => count + 1)
    }
    const change = (changes: Partial<LabSettings>) => {
        update({ preset: undefined, settings: { ...settings, ...changes } })
        if (Object.keys(changes).some((key) => !IN_PLACE.has(key))) restart()
    }

    const data = useMemo(() => generateLabData(settings), [settings])
    const respond = useMemo(() => answer(settings, data), [settings, data])
    const { label, unit } = subjectLabel(settings)
    const labCards: CardSpec[] = [
        {
            dataElement: settings.notInProgram ? NOT_IN_PROGRAM : SUBJECT,
            unit,
        },
        { dataElement: WEIGHT, unit: 'kg' },
        { dataElement: SMOKER },
    ]

    return (
        <LabLayout
            title="Observation cards lab"
            status={
                <span className="truncate">
                    {mode === 'lab'
                        ? `${(saved.preset ?? 'Custom').toUpperCase()} · ${label} · ${requestCounts(requests)}`
                        : `LIVE · ${live.programId} / ${live.personId} / ${live.dataElementId}`}
                </span>
            }
            panel={
                mode === 'lab'
                    ? {
                          title: 'Requests',
                          children: <RequestWaterfall requests={requests} />,
                      }
                    : undefined
            }
            sidebar={
                <>
                    <Segmented
                        value={mode}
                        options={[
                            ['lab', 'Lab data'],
                            ['live', 'Live DHIS2'],
                        ]}
                        onChange={(next) => {
                            update({ mode: next })
                            restart()
                        }}
                    />
                    {mode === 'lab' ? (
                        <>
                            <PresetControls
                                presets={PRESETS}
                                selected={saved.preset}
                                onPick={(each) => {
                                    update({
                                        preset: each.name,
                                        settings: each.settings,
                                    })
                                    restart()
                                }}
                            />
                            <DataControls
                                settings={settings}
                                onChange={change}
                            />
                            <ServerControls
                                settings={settings}
                                onChange={change}
                            />
                            <Section title="Network">
                                <NetworkControls
                                    network={settings.network}
                                    endpoints={RESOURCES}
                                    onChange={(network: LabNetwork) =>
                                        change({ network })
                                    }
                                />
                            </Section>
                        </>
                    ) : (
                        <Section title="Live DHIS2">
                            {(
                                [
                                    ['programId', 'Program'],
                                    ['personId', 'Person (tracked entity)'],
                                    ['dataElementId', 'Data element'],
                                ] as const
                            ).map(([field, name]) => (
                                <label
                                    key={field}
                                    className="flex flex-col gap-0.5"
                                >
                                    {name}
                                    <input
                                        value={live[field]}
                                        onChange={(event) =>
                                            update({
                                                live: {
                                                    ...live,
                                                    [field]:
                                                        event.target.value.trim(),
                                                },
                                            })
                                        }
                                    />
                                </label>
                            ))}
                        </Section>
                    )}
                    <CardControls settings={settings} onChange={change} />
                    <button
                        type="button"
                        className="self-start"
                        onClick={restart}
                    >
                        Restart
                    </button>
                </>
            }
        >
            <CanvasBoundary key={run}>
                {mode === 'lab' ? (
                    <LabServerScope
                        key={run}
                        network={settings.network}
                        resources={RESOURCES}
                        respond={respond}
                        log={setRequests}
                        systemInfo={data.systemInfo}
                    >
                        <ObservationsProvider
                            trackedEntity={LAB_PERSON}
                            program={LAB_PROGRAM}
                        >
                            <Cards cards={labCards} settings={settings} />
                        </ObservationsProvider>
                    </LabServerScope>
                ) : (
                    <LivePreviewHost
                        key={run}
                        placeholder={<PreviewSpinner className="h-96" />}
                    >
                        <ObservationsProvider
                            trackedEntity={live.personId}
                            program={live.programId}
                        >
                            <Cards
                                cards={[{ dataElement: live.dataElementId }]}
                                settings={settings}
                            />
                        </ObservationsProvider>
                    </LivePreviewHost>
                )}
            </CanvasBoundary>
        </LabLayout>
    )
}
