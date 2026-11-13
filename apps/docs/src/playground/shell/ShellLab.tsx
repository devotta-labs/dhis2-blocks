import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PresetControls, Section, Segmented } from '../controls'
import { LabLayout } from '../LabLayout'
import { LogPanel } from '../LogPanel'
import { CanvasBoundary, LabServerScope } from '../LabServer'
import type { Log } from '../network'
import { usePresetParam } from '../usePresetParam'
import {
    ATTRIBUTES,
    generateWorld,
    LAB_ORG_UNIT,
    LAB_PROGRAM,
} from '../working-list/table/labData'
import { createLabServer, RESOURCES } from '../working-list/table/labServer'
import { DEFAULT_CONFIG } from '../working-list/table/presets'
import { AppCanvas } from './AppCanvas'
import appSource from './AppCanvas.tsx?canvas'
import { createAppServer, HEADER_RESOURCES } from './appServer'
import { EXAMPLES } from './examples'
import { initialLabState, labReducer, type Width } from './labState'
import { PersonHistory } from './PersonHistory'
import { ShellCanvas } from './ShellCanvas'
import shellSource from './ShellCanvas.tsx?canvas'

const WIDTHS: ReadonlyArray<readonly [Width, string, string]> = [
    ['phone', 'Phone', 'max-w-[375px]'],
    ['tablet', 'Tablet', 'max-w-[768px]'],
    ['full', 'Full', 'max-w-none'],
]

const APP_RESOURCES = [...RESOURCES, ...HEADER_RESOURCES]
const FACTS: ReadonlyArray<readonly [string, keyof typeof ATTRIBUTES]> = [
    ['First name', 'firstName'],
    ['Last name', 'lastName'],
    ['National ID', 'nationalId'],
    ['Sex', 'sex'],
    ['Date of birth', 'birthDate'],
    ['Phone', 'phone'],
    ['Village', 'village'],
]

/**
 * The shell primitives: each on its own in a narrow and a wide pane, and
 * together as an app with the DHIS2 header bar, a working list and a timeline.
 * The side panes resize and collapse.
 * `?full` shows the app alone, filling the page.
 */
export const ShellLab = () => {
    const [linkedExample, setLinkedExample] = usePresetParam()
    const [params] = useSearchParams()
    const full = params.has('full')
    const [state, dispatch] = useReducer(
        labReducer,
        linkedExample,
        initialLabState
    )
    const { example, density, width, requests } = state
    useEffect(() => setLinkedExample(example), [example, setLinkedExample])

    const log: Log = useCallback(
        (update) => dispatch({ type: 'logRequests', update }),
        []
    )
    const world = useMemo(() => generateWorld(DEFAULT_CONFIG.data), [])
    const respond = useMemo(
        () => createAppServer(createLabServer(DEFAULT_CONFIG, world)),
        [world]
    )
    const factsOf = useCallback(
        (trackedEntityId: string) => {
            const person = world.people.find(({ id }) => id === trackedEntityId)
            return [
                ...FACTS.map(([label, attribute]) => ({
                    label,
                    value: person?.attributes[ATTRIBUTES[attribute]],
                })),
                { label: 'Enrolled', value: person?.enrolledAt.slice(0, 10) },
            ]
        },
        [world]
    )
    const history = useMemo(() => <PersonHistory log={log} />, [log])

    const appProps = {
        density,
        programId: LAB_PROGRAM,
        orgUnitId: LAB_ORG_UNIT,
        factsOf,
        history,
    }
    const app = (
        <LabServerScope
            network={DEFAULT_CONFIG.network}
            apiVersion={DEFAULT_CONFIG.server.apiVersion}
            resources={APP_RESOURCES}
            respond={respond}
            log={log}
        >
            <AppCanvas {...appProps} />
        </LabServerScope>
    )

    if (full) {
        return (
            <div className="h-full bg-dhis2-background [color-scheme:light]">
                {app}
            </div>
        )
    }

    const widthClass =
        WIDTHS.find(([option]) => option === width)?.[2] ?? 'max-w-none'
    const shellProps = {
        example: example === 'App' ? 'Layout' : example,
        density,
    } as const

    return (
        <LabLayout
            source={
                example === 'App'
                    ? { ...appSource, props: appProps }
                    : { ...shellSource, props: shellProps }
            }
            panel={
                example === 'App'
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
                    <PresetControls
                        presets={EXAMPLES}
                        selected={example}
                        onPick={({ name }) =>
                            dispatch({ type: 'pickExample', example: name })
                        }
                    />
                    <Section title="Density">
                        <Segmented
                            value={density}
                            options={[
                                ['compact', 'Compact'],
                                ['mixed', 'Mixed'],
                                ['comfortable', 'Comfortable'],
                            ]}
                            onChange={(next) =>
                                dispatch({
                                    type: 'changeDensity',
                                    density: next,
                                })
                            }
                        />
                    </Section>
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
                        <Link to="?full">Open the app full screen</Link>
                    </Section>
                </>
            }
        >
            {/* The frame stands in for the browser window; the panes fill it. */}
            <div
                className={`h-[680px] w-full ${widthClass} border border-dhis2-border-strong bg-dhis2-background`}
            >
                <CanvasBoundary key={example}>
                    {example === 'App' ? app : <ShellCanvas {...shellProps} />}
                </CanvasBoundary>
            </div>
        </LabLayout>
    )
}
