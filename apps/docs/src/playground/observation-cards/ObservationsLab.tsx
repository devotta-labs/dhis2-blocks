import {
    ObservationCard,
    ObservationLabel,
    ObservationRecorded,
    ObservationSparkline,
    ObservationsProvider,
    ObservationValue,
} from '@/components/observation-cards'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { LivePreviewHost } from '../../preview/LivePreviewHost'
import { PreviewSpinner } from '../../preview/PreviewShell'
import { PresetControls, Section, Segmented } from '../controls'
import { LabLayout } from '../LabLayout'
import { LogPanel } from '../LogPanel'
import { CanvasBoundary, LabServerScope } from '../LabServer'
import { NetworkControls } from '../NetworkControls'
import type { Log } from '../network'
import { usePresetParam } from '../usePresetParam'
import {
    CARD_ELEMENTS,
    cardLabel,
    generateLabData,
    LAB_PERSON,
    LAB_PROGRAM,
    NOT_IN_PROGRAM,
    type LabSettings,
} from './labData'
import { answer, RESOURCES } from './labServer'
import { initialLabState, labReducer } from './labState'
import { PRESETS } from './presets'
import { OptionsControls } from './settings'

interface CardSpec {
    dataElement: string
    unit?: string
}

/** The cards on a grid of the chosen width. */
const Cards = ({
    cards,
    settings,
}: {
    cards: CardSpec[]
    settings: LabSettings
}) => (
    <div
        className="grid gap-4"
        style={{
            gridTemplateColumns: `repeat(${settings.cardsPerRow}, ${settings.cardWidth}px)`,
        }}
    >
        {cards.map(({ dataElement, unit }) => (
            <div key={dataElement} className="grid">
                <ObservationCard
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
            </div>
        ))}
    </div>
)

/** The observation cards lab: every card state, one click each, beside the requests it makes. */
export const ObservationsLab = () => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const [state, dispatch] = useReducer(
        labReducer,
        linkedPreset,
        initialLabState
    )
    const { mode, settings, live, run, requests } = state
    const linked = mode === 'lab' ? state.preset : undefined
    useEffect(() => setLinkedPreset(linked), [linked, setLinkedPreset])

    const change = (changes: Partial<LabSettings>) =>
        dispatch({ type: 'changeSettings', changes })
    // Stable, so the lab server is not rebuilt on every request it logs.
    const log: Log = useCallback(
        (update) => dispatch({ type: 'logRequests', update }),
        []
    )

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
                                  onClearRequests={() =>
                                      dispatch({ type: 'clearRequests' })
                                  }
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
                        onChange={(next) =>
                            dispatch({ type: 'switchMode', mode: next })
                        }
                    />
                    {mode === 'lab' ? (
                        <>
                            <PresetControls
                                presets={PRESETS}
                                selected={state.preset}
                                onPick={(preset) =>
                                    dispatch({ type: 'pickPreset', preset })
                                }
                            />
                            <OptionsControls
                                settings={settings}
                                onChange={change}
                            />
                            <NetworkControls
                                network={settings.network}
                                records={['tracker/events']}
                                onChange={(network) => change({ network })}
                            />
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
                                            dispatch({
                                                type: 'changeLive',
                                                changes: {
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
                    <button
                        type="button"
                        className="self-start"
                        onClick={() => dispatch({ type: 'restart' })}
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
                        log={log}
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
