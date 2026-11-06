import { PresetControls, Section, Segmented } from '../controls'
import { LabLayout } from '../LabLayout'
import { LogPanel } from '../LogPanel'
import { LabRun, useLabRun } from '../LabRun'
import { NetworkControls } from '../NetworkControls'
import {
    CARD_ELEMENTS,
    cardLabel,
    LAB_PERSON,
    LAB_PROGRAM,
    NOT_IN_PROGRAM,
    type LabSettings,
} from './labData'
import { RESOURCES } from './labServer'
import { initialLabState, labReducer } from './labState'
import { PRESETS } from './presets'
import { OptionsControls } from './settings'
import { ObservationsCanvas } from './ObservationsCanvas'
import canvasSource from './ObservationsCanvas.tsx?canvas'

/** The observation cards lab: every card state, one click each, beside the requests it makes. */
export const ObservationsLab = () => {
    const [state, dispatch, log] = useLabRun(labReducer, initialLabState)
    const { mode, settings, backend, live, run, requests } = state

    const change = (changes: Partial<LabSettings>) =>
        dispatch({ type: 'changeSettings', changes })

    const labCards = settings.cards.map((card, index) => ({
        dataElement:
            (card.notInProgram ? NOT_IN_PROGRAM : CARD_ELEMENTS)[index] ?? '',
        unit: cardLabel(card).unit,
    }))

    const canvasProps = {
        trackedEntity: mode === 'lab' ? LAB_PERSON : live.personId,
        program: mode === 'lab' ? LAB_PROGRAM : live.programId,
        cards:
            mode === 'lab' ? labCards : [{ dataElement: live.dataElementId }],
        settings: {
            cardsPerRow: settings.cardsPerRow,
            cardWidth: settings.cardWidth,
            staleAfterDays: settings.staleAfterDays,
            arrangement: settings.arrangement,
        },
    }

    return (
        <LabLayout
            source={{
                ...canvasSource,
                props: canvasProps,
            }}
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
            <LabRun
                run={run}
                mode={mode}
                network={settings.network}
                resources={RESOURCES}
                respond={backend.respond}
                log={log}
                systemInfo={backend.data.systemInfo}
            >
                <ObservationsCanvas {...canvasProps} />
            </LabRun>
        </LabLayout>
    )
}
