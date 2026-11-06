import { useDataEngine } from '@dhis2/app-runtime'
import { useQueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LabRun, useLabRun } from '../playground/LabRun'
import {
    CARD_ELEMENTS,
    LAB_PERSON,
    LAB_PROGRAM,
    type LabSettings,
} from '../playground/observation-cards/labData'
import { RESOURCES } from '../playground/observation-cards/labServer'
import {
    initialLabState,
    labReducer,
    type LabAction,
    type LabState,
} from '../playground/observation-cards/labState'
import { ObservationsCanvas } from '../playground/observation-cards/ObservationsCanvas'

// app-adapter reads PWA environment flags at module load; Vite defines them in the app build.
vi.hoisted(() => vi.stubGlobal('process', { env: { PUBLIC_URL: '' } }))

interface Controls {
    engine?: ReturnType<typeof useDataEngine>
    cache?: ReturnType<typeof useQueryClient>
    state?: LabState
    dispatch?: (action: Exclude<LabAction, { type: 'logRequests' }>) => void
}

const Probe = ({ controls }: { controls: Controls }) => {
    controls.engine = useDataEngine()
    controls.cache = useQueryClient()
    return null
}

const Harness = ({ controls }: { controls: Controls }) => {
    const [state, dispatch, log] = useLabRun(labReducer, initialLabState)
    controls.state = state
    controls.dispatch = dispatch
    return (
        <LabRun
            run={state.run}
            mode={state.mode}
            network={state.settings.network}
            resources={RESOURCES}
            respond={state.backend.respond}
            systemInfo={state.backend.data.systemInfo}
            log={log}
        >
            <Probe controls={controls} />
            <ObservationsCanvas
                trackedEntity={LAB_PERSON}
                program={LAB_PROGRAM}
                cards={[{ dataElement: CARD_ELEMENTS[0] }]}
                settings={state.settings}
            />
        </LabRun>
    )
}

describe('observation lab backend lifecycle', () => {
    it('keeps loaded queries across every view-only change, but replaces the backend and cache on new data or restart', async () => {
        const controls: Controls = {}
        await render(
            <MemoryRouter>
                <Harness controls={controls} />
            </MemoryRouter>
        )
        const loaded = () =>
            expect
                .poll(() =>
                    controls.state?.requests.map(({ outcome }) => outcome)
                )
                .toEqual(['ok', 'ok', 'ok'])
        await loaded()
        const { engine, cache } = controls
        const backend = controls.state!.backend
        const queries = cache!.getQueryCache().getAll()
        expect(queries).toHaveLength(3)
        expect(queries.every((query) => query.state.status === 'success')).toBe(
            true
        )

        // These settings have reducer support but are not exposed by OptionsControls.
        const changes: Partial<LabSettings>[] = [
            { cardWidth: 200 },
            { cardsPerRow: 2 },
            { arrangement: 'composed' },
            { staleAfterDays: 1 },
        ]
        for (const change of changes) {
            await act(() =>
                controls.dispatch!({ type: 'changeSettings', changes: change })
            )
            expect(controls.state!.settings).toMatchObject(change)
            expect(controls.state!.backend).toBe(backend)
            expect(controls.state!.run).toBe(0)
            expect(controls.engine).toBe(engine)
            expect(controls.cache).toBe(cache)
            expect(cache!.getQueryCache().getAll()).toEqual(queries)
            expect(controls.state!.requests).toHaveLength(3)
        }

        await act(() =>
            controls.dispatch!({
                type: 'changeSettings',
                changes: { visits: 1 },
            })
        )
        await loaded()
        expect(controls.state!.backend.data.events).not.toEqual(
            backend.data.events
        )
        expect(controls.engine).not.toBe(engine)
        expect(controls.cache).not.toBe(cache)
        const restartedEngine = controls.engine
        await act(() => controls.dispatch!({ type: 'restart' }))
        await loaded()
        expect(controls.engine).not.toBe(restartedEngine)
    })
})
