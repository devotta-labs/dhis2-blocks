import { useCallback, useContext, useMemo } from 'react'
import { PresetControls, Section, Segmented } from '../../controls'
import { LabLayout } from '../../LabLayout'
import { LogPanel } from '../../LogPanel'
import { LabRun, useLabRun } from '../../LabRun'
import { NetworkControls } from '../../NetworkControls'
import { DisplayChoice } from '../displayChoice'
import { LAB_ORG_UNIT, LAB_PROGRAM, generateWorld } from './labData'
import { createLabServer, RESOURCES } from './labServer'
import { EVENT_VIEW } from './savedViews'
import { initialLabState, labReducer, type Width } from './labState'
import { PRESETS } from './presets'
import { OptionsControls } from './settings'
import { TableCanvas } from './TableCanvas'
import canvasSource from './TableCanvas.tsx?canvas'

const WIDTHS: ReadonlyArray<readonly [Width, string, string]> = [
    ['phone', 'Phone', 'max-w-[375px]'],
    ['tablet', 'Tablet', 'max-w-[768px]'],
    ['desktop', 'Desktop', 'max-w-[1100px]'],
    ['full', 'Full', 'max-w-none'],
]

/** The working list as a table: the table and its toolbar on generated data, beside the requests it makes. */
export const TableLab = () => {
    const displayChoice = useContext(DisplayChoice)
    const [state, dispatch, log] = useLabRun(labReducer, initialLabState)
    const { mode, config, live, width, run, requests, callbacks } = state

    const note = useCallback(
        (entry: string) =>
            dispatch({
                type: 'noteCallback',
                entry: `${new Date().toLocaleTimeString()} ${entry}`,
            }),
        []
    )

    const { data, server } = config
    const world = useMemo(() => generateWorld(data), [data])
    // A fresh server each run, so views saved in one run are gone in the next.
    const respond = useMemo(
        () => createLabServer({ data, server }, world),
        [data, server, world, run]
    )
    const widthClass =
        WIDTHS.find(([option]) => option === width)?.[2] ?? 'max-w-none'

    const canvasProps = {
        view: config.view,
        programId: mode === 'lab' ? LAB_PROGRAM : live.programId,
        orgUnitId: mode === 'lab' ? LAB_ORG_UNIT : live.orgUnitId,
        defaultViewId:
            mode === 'lab' && data.mode === 'event' ? EVENT_VIEW : undefined,
        note,
    }

    return (
        <LabLayout
            source={{
                ...canvasSource,
                props: canvasProps,
            }}
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
                    {displayChoice}
                    {mode === 'lab' ? (
                        <PresetControls
                            presets={PRESETS}
                            selected={state.preset}
                            onPick={(preset) =>
                                dispatch({ type: 'pickPreset', preset })
                            }
                        />
                    ) : (
                        <Section title="Live DHIS2">
                            {(
                                [
                                    ['programId', 'Program'],
                                    ['orgUnitId', 'Organisation unit'],
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
                    <OptionsControls
                        view={config.view}
                        onChange={(view) =>
                            dispatch({ type: 'changeView', view })
                        }
                    />
                    {mode === 'lab' && (
                        <NetworkControls
                            network={config.network}
                            records={[
                                'tracker/trackedEntities',
                                'tracker/events',
                            ]}
                            onChange={(network) =>
                                dispatch({ type: 'changeNetwork', network })
                            }
                        />
                    )}
                    <Section title="Canvas">
                        <Segmented
                            value={width}
                            options={WIDTHS.map(([option, name]) => [
                                option,
                                name,
                            ])}
                            onChange={(next) =>
                                dispatch({ type: 'changeWidth', width: next })
                            }
                        />
                        <button
                            type="button"
                            className="self-start"
                            onClick={() => dispatch({ type: 'restart' })}
                        >
                            Restart
                        </button>
                    </Section>
                </>
            }
        >
            <div className={`w-full ${widthClass} bg-white`}>
                <LabRun
                    run={run}
                    mode={mode}
                    network={config.network}
                    apiVersion={server.apiVersion}
                    resources={RESOURCES}
                    respond={respond}
                    log={log}
                    live={
                        <TableCanvas
                            key={`${live.programId}/${live.orgUnitId}`}
                            {...canvasProps}
                        />
                    }
                >
                    <TableCanvas {...canvasProps} />
                </LabRun>
            </div>
        </LabLayout>
    )
}
