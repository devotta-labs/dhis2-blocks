import {
    useFinderProgram,
    type FinderPerson,
} from '@/components/tracked-entity-finder'
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
import { LAB_PROGRAM, type LabSettings } from './labData'
import { LabFinder } from './LabFinder'
import { answer, RECORDS, RESOURCES } from './labServer'
import { initialLabState, labReducer, type KnownAttribute } from './labState'
import { LIVE_PRESETS, PRESETS } from './presets'
import {
    CanvasControls,
    CompositionControls,
    ProgramControls,
    ServerControls,
} from './settings'

const WIDTH_CLASS = {
    phone: 'max-w-[360px]',
    narrow: 'max-w-[480px]',
    wide: 'max-w-[800px]',
    full: 'max-w-none',
} satisfies Record<LabSettings['width'], string>

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

/** The tracked entity finder lab: every search rule, server answer and composition, beside the requests it makes. */
export const FinderLab = () => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const [state, dispatch] = useReducer(
        labReducer,
        linkedPreset,
        initialLabState
    )
    const { mode, settings, live, run, requests, callbacks } = state
    const linked = mode === 'lab' ? state.preset : undefined
    useEffect(() => setLinkedPreset(linked), [linked, setLinkedPreset])

    const change = (changes: Partial<LabSettings>) =>
        dispatch({ type: 'changeSettings', changes })
    // Stable, so the lab server is not rebuilt on every request it logs.
    const log: Log = useCallback(
        (update) => dispatch({ type: 'logRequests', update }),
        []
    )
    const onSelect = useCallback(
        (person: FinderPerson) => dispatch({ type: 'selected', person }),
        []
    )
    const onLiveAttributes = useCallback(
        (attributes: KnownAttribute[]) =>
            dispatch({ type: 'liveAttributes', attributes }),
        []
    )

    const { program, server } = settings
    const respond = useMemo(
        () => answer({ program, server }),
        [program, server]
    )
    const known: KnownAttribute[] =
        mode === 'lab' ? program.attributes : live.attributes
    const composition = mode === 'lab' ? settings.composition : live.composition

    return (
        <LabLayout
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
                        <PresetControls
                            presets={PRESETS}
                            selected={state.preset}
                            onPick={(preset) =>
                                dispatch({ type: 'pickPreset', preset })
                            }
                        />
                    ) : (
                        <Section title="Live programs">
                            {LIVE_PRESETS.map((preset) => (
                                <button
                                    key={preset.name}
                                    type="button"
                                    className="text-start"
                                    aria-pressed={
                                        live.program === preset.program
                                    }
                                    onClick={() =>
                                        dispatch({
                                            type: 'pickLiveProgram',
                                            preset,
                                        })
                                    }
                                >
                                    {preset.name}
                                </button>
                            ))}
                            <form
                                className="flex gap-1"
                                onSubmit={(event) => {
                                    event.preventDefault()
                                    const uid = String(
                                        new FormData(event.currentTarget).get(
                                            'program'
                                        ) ?? ''
                                    ).trim()
                                    if (uid) {
                                        dispatch({
                                            type: 'pickLiveProgram',
                                            preset: {
                                                program: uid,
                                                forms: [[]],
                                            },
                                        })
                                    }
                                }}
                            >
                                <input
                                    name="program"
                                    placeholder="Any program uid"
                                    aria-label="Program uid"
                                    className="min-w-0 flex-1 font-mono"
                                />
                                <button type="submit">Load</button>
                            </form>
                        </Section>
                    )}
                    <CanvasControls settings={settings} onChange={change} />
                    <CompositionControls
                        composition={composition}
                        known={known}
                        onChange={(next) =>
                            dispatch({
                                type: 'changeComposition',
                                composition: next,
                            })
                        }
                    />
                    {mode === 'lab' && (
                        <>
                            <ProgramControls
                                program={program}
                                onChange={(next) => change({ program: next })}
                            />
                            <ServerControls
                                server={server}
                                onChange={(next) => change({ server: next })}
                            />
                            <NetworkControls
                                network={settings.network}
                                records={RECORDS}
                                onChange={(network) => change({ network })}
                            />
                        </>
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
                dir={settings.rtl ? 'rtl' : 'ltr'}
                className={`w-full ${WIDTH_CLASS[settings.width]} rounded border border-dhis2-grey-300 bg-white p-6`}
            >
                <CanvasBoundary key={run}>
                    {mode === 'lab' ? (
                        <LabServerScope
                            key={run}
                            network={settings.network}
                            resources={RESOURCES}
                            respond={respond}
                            log={log}
                        >
                            <LabFinder
                                program={LAB_PROGRAM}
                                composition={composition}
                                onSelect={onSelect}
                            />
                        </LabServerScope>
                    ) : (
                        <LivePreviewHost
                            key={run}
                            placeholder={<PreviewSpinner className="h-96" />}
                        >
                            <LabFinder
                                program={live.program}
                                composition={composition}
                                onSelect={onSelect}
                            >
                                <LiveAttributes onChange={onLiveAttributes} />
                            </LabFinder>
                        </LivePreviewHost>
                    )}
                </CanvasBoundary>
            </div>
        </LabLayout>
    )
}
