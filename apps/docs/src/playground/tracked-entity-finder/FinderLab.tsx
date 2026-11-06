import type { FinderPerson } from '@/components/tracked-entity-finder'
import { useCallback, useMemo } from 'react'
import { PresetControls, Section, Segmented } from '../controls'
import { LabLayout } from '../LabLayout'
import { LogPanel } from '../LogPanel'
import { LabRun, useLabRun } from '../LabRun'
import { NetworkControls } from '../NetworkControls'
import { LAB_PROGRAM, type LabSettings } from './labData'
import { LabFinder } from './LabFinder'
import canvasSource from './LabFinder.tsx?canvas'
import { answer, RECORDS, RESOURCES } from './labServer'
import { initialLabState, labReducer } from './labState'
import { PRESETS } from './presets'
import { OptionsControls } from './settings'

/** The tracked entity finder lab: its search rules, results and composition, one click each, beside the requests it makes. */
export const FinderLab = () => {
    const [state, dispatch, log] = useLabRun(labReducer, initialLabState)
    const { mode, settings, live, run, requests, callbacks } = state

    const change = (changes: Partial<LabSettings>) =>
        dispatch({ type: 'changeSettings', changes })
    const onSelect = useCallback(
        (person: FinderPerson) => dispatch({ type: 'selected', person }),
        []
    )

    const { program, server } = settings
    const respond = useMemo(
        () => answer({ program, server }),
        [program, server]
    )
    const canvasProps = {
        program: mode === 'lab' ? LAB_PROGRAM : live.programId,
        composition: mode === 'lab' ? settings.composition : undefined,
        onSelect,
    }

    return (
        <LabLayout
            source={{ ...canvasSource, props: canvasProps }}
            panel={{
                title: 'Logs',
                children: (
                    <LogPanel
                        callbacks={callbacks}
                        requests={mode === 'lab' ? requests : undefined}
                        onClearCallbacks={() =>
                            dispatch({ type: 'clearCallbacks' })
                        }
                        onClearRequests={() =>
                            dispatch({ type: 'clearRequests' })
                        }
                    />
                ),
            }}
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
                                server={server}
                                onChange={(next) => change({ server: next })}
                            />
                            <NetworkControls
                                network={settings.network}
                                records={RECORDS}
                                onChange={(network) => change({ network })}
                            />
                        </>
                    ) : (
                        <Section title="Live DHIS2">
                            <label className="flex flex-col gap-0.5">
                                Program
                                <input
                                    value={live.programId}
                                    onChange={(event) =>
                                        dispatch({
                                            type: 'changeLive',
                                            changes: {
                                                programId:
                                                    event.target.value.trim(),
                                            },
                                        })
                                    }
                                />
                            </label>
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
            <div
                dir={mode === 'lab' && settings.rtl ? 'rtl' : 'ltr'}
                className="w-full max-w-2xl rounded-lg bg-white p-4 md:p-6"
            >
                <LabRun
                    run={run}
                    mode={mode}
                    network={settings.network}
                    resources={RESOURCES}
                    respond={respond}
                    log={log}
                >
                    <LabFinder {...canvasProps} />
                </LabRun>
            </div>
        </LabLayout>
    )
}
