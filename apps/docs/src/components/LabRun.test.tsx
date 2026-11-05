import { useDataEngine } from '@dhis2/app-runtime'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { act, useMemo, useState } from 'react'
import { MemoryRouter, useLocation, useSearchParams } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LabRun, useLabRun } from '../playground/LabRun'
import {
    throughNetwork,
    type Log,
    type NetworkRequest,
} from '../playground/network'
import {
    initialLabState,
    labReducer,
} from '../playground/working-list/table/labState'
import { PRESETS } from '../playground/working-list/table/presets'

// app-adapter reads PWA environment flags at module load; Vite defines process.env in the app build.
vi.hoisted(() => vi.stubGlobal('process', { env: { PUBLIC_URL: '' } }))

const resources = ['probe']
const network = { delay: 0, endpoints: {} }
const readQuery = { result: { resource: 'probe' } }

const Probe = ({
    crash,
    label,
    controls,
}: {
    crash: boolean
    label: string
    controls: HarnessControls
}) => {
    const engine = useDataEngine()
    controls.engine = engine
    const cache = useQueryClient()
    const query = useQuery({
        queryKey: ['probe'],
        queryFn: () => engine.query(readQuery),
        staleTime: Infinity,
    })
    const [local, setLocal] = useState('initial')
    if (crash) throw new Error('test canvas crash')
    return (
        <>
            <output aria-label="child label">{label}</output>
            <output aria-label="answer">{JSON.stringify(query.data)}</output>
            <button onClick={() => setLocal('changed')}>Local {local}</button>
            <button
                onClick={async () => {
                    await engine.mutate({
                        resource: 'probe',
                        type: 'create',
                        data: {},
                    })
                    await cache.invalidateQueries({ queryKey: ['probe'] })
                }}
            >
                Write
            </button>
        </>
    )
}

interface HarnessControls {
    engine?: ReturnType<typeof useDataEngine>
    log?: Log
    restart?: () => void
    switchMode?: () => void
}

const Harness = ({
    controls,
    reads,
}: {
    controls: HarnessControls
    reads: () => void
}) => {
    const [state, dispatch, log] = useLabRun(labReducer, initialLabState)
    const [crash, setCrash] = useState(false)
    const [label, setLabel] = useState('initial')
    const [params, setParams] = useSearchParams()
    const location = useLocation()
    controls.log = log
    controls.restart = () => dispatch({ type: 'restart' })
    controls.switchMode = () =>
        dispatch({
            type: 'switchMode',
            mode: state.mode === 'lab' ? 'live' : 'lab',
        })
    const respond = useMemo(() => {
        let value = 0
        return (_request: NetworkRequest, type: string) => {
            if (type === 'create') value++
            else reads()
            return { value }
        }
    }, [state.run, reads])
    return (
        <>
            <output aria-label="url">{location.search}</output>
            <output aria-label="run">{state.run}</output>
            <output aria-label="requests">
                {JSON.stringify(
                    state.requests.map(({ request, outcome }) => [
                        request.resource,
                        outcome,
                    ])
                )}
            </output>
            <button
                onClick={() =>
                    dispatch({
                        type: 'changeView',
                        view: { ...state.config.view },
                    })
                }
            >
                View only
            </button>
            <button onClick={() => dispatch({ type: 'restart' })}>
                Restart
            </button>
            <button
                onClick={() =>
                    dispatch({
                        type: 'switchMode',
                        mode: state.mode === 'lab' ? 'live' : 'lab',
                    })
                }
            >
                Switch mode
            </button>
            <button
                onClick={() =>
                    dispatch({ type: 'pickPreset', preset: PRESETS[1] })
                }
            >
                Pick preset
            </button>
            <button
                onClick={() =>
                    setParams({
                        ...Object.fromEntries(params),
                        preset: PRESETS[2].name,
                    })
                }
            >
                External URL
            </button>
            <button onClick={() => setCrash(!crash)}>Toggle crash</button>
            <button onClick={() => setLabel('updated')}>Update child</button>
            <LabRun
                run={state.run}
                mode={state.mode}
                network={network}
                resources={resources}
                respond={respond}
                log={log}
            >
                <Probe crash={crash} label={label} controls={controls} />
            </LabRun>
        </>
    )
}

const setup = async (search = '') => {
    const controls: HarnessControls = {}
    const reads = vi.fn()
    const view = await render(
        <MemoryRouter initialEntries={[`/playground/working-list${search}`]}>
            <Harness controls={controls} reads={reads} />
        </MemoryRouter>
    )
    await expect
        .element(view.getByRole('status', { name: 'answer' }))
        .toHaveTextContent('"value":0')
    return { view, controls, reads }
}

describe('lab run boundary', () => {
    it('keeps the runtime engine across log and child updates, replacing it only on a new run', async () => {
        const { view, controls, reads } = await setup()
        const engine = controls.engine
        expect(engine).toBeDefined()
        await act(() => controls.log!((entries) => [...entries]))
        expect(controls.engine).toBe(engine)
        await view.getByRole('button', { name: 'Update child' }).click()
        await expect
            .element(view.getByRole('status', { name: 'child label' }))
            .toHaveTextContent('updated')
        expect(controls.engine).toBe(engine)
        expect(reads).toHaveBeenCalledTimes(1)
        await view.getByRole('button', { name: 'Restart', exact: true }).click()
        await expect
            .element(view.getByRole('status', { name: 'requests' }))
            .toHaveTextContent('[["probe","ok"]]')
        expect(controls.engine).not.toBe(engine)
        expect(reads).toHaveBeenCalledTimes(2)
    })

    it('clears the preset in live mode and starts a fresh lab cache on return', async () => {
        const { view, reads, controls } = await setup()
        await view.getByRole('button', { name: 'Switch mode' }).click()
        await expect
            .element(view.getByRole('status', { name: 'run' }))
            .toHaveTextContent('1')
        await expect
            .element(view.getByRole('status', { name: 'url' }))
            .toBeEmptyDOMElement()
        await expect
            .element(view.getByRole('button', { name: 'Local initial' }))
            .not.toBeInTheDocument()
        // The unauthenticated live host owns a sign-in dialog; exercise the return dispatch directly.
        await act(() => controls.switchMode!())
        await expect
            .element(view.getByRole('status', { name: 'run' }))
            .toHaveTextContent('2')
        await expect
            .element(view.getByRole('status', { name: 'answer' }))
            .toHaveTextContent('"value":0')
        expect(reads).toHaveBeenCalledTimes(2)
    })
    it('opens a linked preset once, normalizes unknown presets and preserves other URL choices', async () => {
        const { view } = await setup(
            `?display=calendar&preset=${encodeURIComponent(PRESETS[1].name)}`
        )
        await expect
            .element(view.getByRole('status', { name: 'url' }))
            .toHaveTextContent('display=calendar')
        await view.getByRole('button', { name: 'External URL' }).click()
        await expect
            .poll(() =>
                new URLSearchParams(
                    view.getByRole('status', { name: 'url' }).element()
                        .textContent ?? ''
                ).get('preset')
            )
            .toBe(PRESETS[1].name)
        await view.getByRole('button', { name: 'View only' }).click()
        await expect
            .element(view.getByRole('status', { name: 'url' }))
            .toHaveTextContent('?display=calendar')
        await view.unmount()
        const unknown = await setup('?preset=unknown')
        await expect
            .poll(() =>
                new URLSearchParams(
                    unknown.view.getByRole('status', { name: 'url' }).element()
                        .textContent ?? ''
                ).get('preset')
            )
            .toBe(PRESETS[0].name)
    })

    it('preserves cache, server writes and canvas state for view-only changes, but resets them on restart', async () => {
        const { view, reads, controls } = await setup()
        const log = controls.log
        await view.getByRole('button', { name: 'Local initial' }).click()
        await view.getByRole('button', { name: 'Write', exact: true }).click()
        await expect
            .element(view.getByRole('status', { name: 'answer' }))
            .toHaveTextContent('"value":1')
        const before = reads.mock.calls.length
        await view.getByRole('button', { name: 'View only' }).click()
        expect(controls.log).toBe(log)
        expect(reads).toHaveBeenCalledTimes(before)
        await expect
            .element(view.getByRole('button', { name: 'Local changed' }))
            .toBeVisible()
        await expect
            .element(view.getByRole('status', { name: 'answer' }))
            .toHaveTextContent('"value":1')
        await view.getByRole('button', { name: 'Restart', exact: true }).click()
        await expect
            .element(view.getByRole('status', { name: 'answer' }))
            .toHaveTextContent('"value":0')
        await expect
            .element(view.getByRole('button', { name: 'Local initial' }))
            .toBeVisible()
        await expect
            .element(view.getByRole('status', { name: 'requests' }))
            .toHaveTextContent('[["probe","ok"]]')
        expect(reads).toHaveBeenCalledTimes(before + 1)
    })

    it.each(['complete', 'abort'] as const)(
        'does not attribute an old request to the restarted run on %s',
        async (settlement) => {
            const { view, controls } = await setup()
            const oldLog = controls.log!
            let finish = () => {}
            const answer = new Promise<object>((resolve) => {
                finish = () => resolve({ old: true })
            })
            const abort = new AbortController()
            const pending = throughNetwork(
                settlement === 'abort'
                    ? { delay: 0, endpoints: { old: { behaviour: 'hangs' } } }
                    : network,
                { resource: 'old' },
                () => answer,
                oldLog,
                abort.signal
            ).catch((error: Error) => error.name)
            await expect
                .element(view.getByRole('status', { name: 'requests' }))
                .toHaveTextContent('old')
            await view
                .getByRole('button', { name: 'Restart', exact: true })
                .click()
            if (settlement === 'complete') finish()
            else abort.abort()
            await pending
            // A request can also be issued by an old callback after the restart.
            await throughNetwork(
                network,
                { resource: 'late' },
                () => ({}),
                oldLog
            )
            await expect
                .element(view.getByRole('status', { name: 'requests' }))
                .toHaveTextContent('[["probe","ok"]]')
        }
    )

    it('recovers a crashed canvas with a fresh run', async () => {
        const { view } = await setup()
        await view.getByRole('button', { name: 'Toggle crash' }).click()
        await expect
            .element(view.getByRole('alert'))
            .toHaveTextContent('test canvas crash')
        await view.getByRole('button', { name: 'Toggle crash' }).click()
        await expect.element(view.getByRole('alert')).toBeVisible()
        await view.getByRole('button', { name: 'Restart', exact: true }).click()
        await expect
            .element(view.getByRole('status', { name: 'answer' }))
            .toHaveTextContent('"value":0')
        await expect.element(view.getByRole('alert')).not.toBeInTheDocument()
    })
})
