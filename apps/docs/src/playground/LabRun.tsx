import { useCallback, useEffect, useReducer, type ReactNode } from 'react'
import { LivePreviewHost } from '../preview/LivePreviewHost'
import { PreviewSpinner } from '../preview/PreviewShell'
import {
    CanvasBoundary,
    LabServerScope,
    type LabServerProps,
} from './LabServer'
import type { Log, NetworkRequest } from './network'
import { usePresetParam } from './usePresetParam'

interface RunState {
    run: number
    mode: 'lab' | 'live'
    preset?: string
}

interface LogAction {
    type: 'logRequests'
    update: Parameters<Log>[0]
}

type RunAction<Action> =
    | { type: 'local'; action: Action }
    | { type: 'request'; run: number; update: Parameters<Log>[0] }

/** Reducers own reset policy; this envelope keeps requests attached to the run that issued them. */
export const useLabRun = <State extends RunState, Action>(
    reducer: (state: State, action: Action | LogAction) => State,
    initialState: (preset?: string) => State
) => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const [state, send] = useReducer(
        (current: State, event: RunAction<Action>) => {
            if (event.type === 'local') return reducer(current, event.action)
            return event.run === current.run
                ? reducer(current, {
                      type: 'logRequests',
                      update: event.update,
                  })
                : current
        },
        linkedPreset,
        initialState
    )
    const dispatch = useCallback(
        (action: Action) => send({ type: 'local', action }),
        []
    )
    const run = state.run
    const log: Log = useCallback(
        (update) => send({ type: 'request', run, update }),
        [run]
    )
    const linked = state.mode === 'lab' ? state.preset : undefined
    useEffect(() => setLinkedPreset(linked), [linked, setLinkedPreset])
    return [state, dispatch, log] as const
}

/** One key resets the crash boundary, runtime provider and both query caches together. */
export const LabRun = <Request extends NetworkRequest>({
    run,
    mode,
    children,
    live = children,
    ...server
}: LabServerProps<Request> & {
    run: number
    mode: RunState['mode']
    live?: ReactNode
}) => (
    <CanvasBoundary key={run}>
        {mode === 'lab' ? (
            <LabServerScope {...server}>{children}</LabServerScope>
        ) : (
            <LivePreviewHost placeholder={<PreviewSpinner className="h-96" />}>
                {live}
            </LivePreviewHost>
        )}
    </CanvasBoundary>
)
