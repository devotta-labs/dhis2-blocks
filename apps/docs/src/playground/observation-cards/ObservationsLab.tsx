import {
    ObservationCard,
    ObservationLabel,
    ObservationRecorded,
    ObservationSparkline,
    ObservationsProvider,
    ObservationValue,
} from '@/components/observation-cards'
import { Fragment, useMemo, useState } from 'react'
import { LivePreviewHost } from '../../preview/LivePreviewHost'
import { PreviewSpinner } from '../../preview/PreviewShell'
import { PresetControls, Section, Segmented } from '../controls'
import { LabLayout } from '../LabLayout'
import { LogPanel } from '../LogPanel'
import { CanvasBoundary, LabServerScope } from '../LabServer'
import { NetworkControls } from '../NetworkControls'
import type { LabNetwork, RequestLogEntry } from '../network'
import { usePresetParam } from '../usePresetParam'
import {
    CARD_ELEMENTS,
    cardLabel,
    generateLabData,
    isLabElement,
    LAB_PERSON,
    LAB_PROGRAM,
    NOT_IN_PROGRAM,
    type LabCard,
    type LabSettings,
} from './labData'
import { answer, RESOURCES } from './labServer'
import { SeriesReadout } from './panels'
import { cardDefaults, DEFAULT_SETTINGS, PRESETS } from './presets'
import {
    CardControls,
    CardDataControls,
    ServerControls,
    VisitControls,
} from './settings'

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

/** Saved cards over each position's defaults; anything unrecognised falls back to them. */
const savedCards = (cards: ReadonlyArray<Partial<LabCard>> = []): LabCard[] =>
    CARD_ELEMENTS.map((_, index) => {
        const card = cards[index]
        return card && isLabElement(card.element)
            ? { ...cardDefaults(index), ...card }
            : cardDefaults(index)
    })

const stored = (): Saved => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return DEFAULT_SAVED
        const parsed: Partial<Saved> = JSON.parse(stored)
        return {
            ...DEFAULT_SAVED,
            ...parsed,
            settings: {
                ...DEFAULT_SETTINGS,
                ...parsed.settings,
                cards: savedCards(parsed.settings?.cards),
            },
            live: { ...DEFAULT_SAVED.live, ...parsed.live },
        }
    } catch {
        return DEFAULT_SAVED
    }
}

/** The saved settings, or the linked preset's over them. */
const load = (preset?: string): Saved => {
    const saved = stored()
    const linked = PRESETS.find((each) => each.name === preset)
    return linked
        ? {
              ...saved,
              mode: 'lab',
              preset: linked.name,
              settings: linked.settings,
          }
        : saved
}

const save = (saved: Saved) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    } catch {
        // Storage is a convenience; the lab works without it.
    }
}

/** The cards on a grid of the chosen width, each with its `useObservation` readout under it. */
const Cards = ({
    cards,
    settings,
}: {
    cards: CardSpec[]
    settings: LabSettings
}) => (
    <div
        className="grid gap-x-4"
        style={{
            gridTemplateColumns: `repeat(${settings.cardsPerRow}, ${settings.cardWidth}px)`,
        }}
    >
        {cards.map(({ dataElement, unit }, index) => {
            // Each card's row of the grid has a readout row under it, so cards in a row still share a height.
            const column = (index % settings.cardsPerRow) + 1
            const row = Math.floor(index / settings.cardsPerRow) * 2 + 1
            return (
                <Fragment key={dataElement}>
                    <div
                        style={{ gridColumn: column, gridRow: row }}
                        className="grid"
                    >
                        <ObservationCard
                            dataElement={dataElement}
                            unit={unit}
                            staleAfterDays={
                                settings.staleAfterDays || undefined
                            }
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
                    </div>
                    <div
                        style={{ gridColumn: column, gridRow: row + 1 }}
                        className="mt-2 mb-4"
                    >
                        <SeriesReadout dataElement={dataElement} />
                    </div>
                </Fragment>
            )
        })}
    </div>
)

/** The observation cards lab: every card state, one click each, beside the requests it makes. */
export const ObservationsLab = () => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const [saved, setSaved] = useState(() => load(linkedPreset))
    const { mode, settings, live } = saved
    const [run, setRun] = useState(0)
    const [requests, setRequests] = useState<RequestLogEntry[]>([])

    const update = (next: Partial<Saved>) => {
        const merged = { ...saved, ...next }
        setSaved(merged)
        save(merged)
        setLinkedPreset(merged.mode === 'lab' ? merged.preset : undefined)
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
    const labCards: CardSpec[] = settings.cards.map((card, index) => ({
        dataElement:
            (card.notInProgram ? NOT_IN_PROGRAM : CARD_ELEMENTS)[index] ?? '',
        unit: cardLabel(card).unit,
    }))

    return (
        <LabLayout
            panel={
                mode === 'lab'
                    ? {
                          title: 'Logs',
                          children: (
                              <LogPanel
                                  requests={requests}
                                  onClearRequests={() => setRequests([])}
                              />
                          ),
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
                            <VisitControls
                                settings={settings}
                                onChange={change}
                            />
                            <CardDataControls
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
