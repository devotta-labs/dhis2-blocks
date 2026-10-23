import { Result } from 'better-result'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import {
    applyError,
    applyPage,
    initialMergeState,
    isAwaitingFirstAnswer,
    limitingSources,
    retainSources,
    startLoading,
    visibleEntries,
    type MergeState,
} from './merge'
import type {
    SourceError,
    SourcePage,
    SourceState,
    TimelineSource,
    TimelineSourcesResult,
} from './types'

export interface TimelineSourcesOptions {
    /** How long a first page may take before it fails as timed out. */
    firstPageTimeoutMs?: number
}

type Action<TData> =
    | { type: 'retain'; keys: string[] }
    | {
          type: 'start'
          key: string
          mode: 'restart' | 'fresh' | 'more' | 'retry'
      }
    | { type: 'page'; key: string; page: SourcePage<TData> }
    | { type: 'error'; key: string; error: SourceError }

const reduce = <TData>(
    state: MergeState<TData>,
    action: Action<TData>
): MergeState<TData> => {
    switch (action.type) {
        case 'retain':
            return retainSources(state, action.keys)
        case 'start':
            return startLoading(state, action.key, action.mode)
        case 'page':
            return applyPage(state, action.key, action.page)
        case 'error':
            return applyError(state, action.key, action.error)
    }
}

const sameKeys = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((key, i) => key === b[i])

const asError = (cause: unknown) =>
    cause instanceof Error ? cause : new Error(String(cause))

/**
 * Pages several sources into one newest-first feed. An entry is shown only
 * once every source that still has pages has returned everything newer, so
 * `loadMore` only ever appends below what is already shown.
 */
export const useTimelineSources = <TData>(
    sources: ReadonlyArray<TimelineSource<TData>>,
    options: TimelineSourcesOptions = {}
): TimelineSourcesResult<TData> => {
    const [state, dispatch] = useReducer(
        reduce<TData>,
        sources,
        (initial): MergeState<TData> =>
            initialMergeState(initial.map((source) => source.key))
    )
    const latest = useRef({ sources, state, options })
    latest.current = { sources, state, options }
    /** One controller per in-flight request, by source key. */
    const requests = useRef(new Map<string, AbortController>())
    /** The revision and subject each source was last started at. */
    const started = useRef(
        new Map<string, { revision: unknown; subject?: string }>()
    )

    const request = useCallback(
        (
            source: TimelineSource<TData>,
            cursor: unknown | undefined,
            firstPage: boolean
        ) => {
            const { key } = source
            requests.current.get(key)?.abort()
            const controller = new AbortController()
            requests.current.set(key, controller)
            let timer: ReturnType<typeof setTimeout> | undefined
            const finish = (action: Action<TData>) => {
                if (requests.current.get(key) !== controller) {
                    return
                }
                requests.current.delete(key)
                clearTimeout(timer)
                dispatch(action)
            }
            if (firstPage) {
                timer = setTimeout(() => {
                    finish({
                        type: 'error',
                        key,
                        error: {
                            kind: 'failed',
                            error: new Error('Timed out'),
                        },
                    })
                    controller.abort()
                }, latest.current.options.firstPageTimeoutMs ?? 30_000)
            }
            source.fetchPage(cursor, controller.signal).then(
                (result) =>
                    finish(
                        Result.isOk(result)
                            ? { type: 'page', key, page: result.value }
                            : { type: 'error', key, error: result.error }
                    ),
                (cause: unknown) =>
                    finish({
                        type: 'error',
                        key,
                        error: { kind: 'failed', error: asError(cause) },
                    })
            )
        },
        []
    )

    useEffect(() => {
        const inFlight = requests.current
        const known = started.current
        return () => {
            for (const controller of inFlight.values()) {
                controller.abort()
            }
            inFlight.clear()
            known.clear()
        }
    }, [])

    // Every render: start sources that are new or whose revision or subject
    // changed, and forget the ones that are gone.
    useEffect(() => {
        const keys = sources.map((source) => source.key)
        for (const key of started.current.keys()) {
            if (!keys.includes(key)) {
                requests.current.get(key)?.abort()
                requests.current.delete(key)
                started.current.delete(key)
            }
        }
        if (!sameKeys(keys, latest.current.state.keys)) {
            dispatch({ type: 'retain', keys })
        }
        for (const source of sources) {
            const known = started.current.get(source.key)
            const sameSubject = known?.subject === source.subject
            if (
                known !== undefined &&
                sameSubject &&
                Object.is(known.revision, source.revision)
            ) {
                continue
            }
            started.current.set(source.key, {
                revision: source.revision,
                subject: source.subject,
            })
            dispatch({
                type: 'start',
                key: source.key,
                mode: known === undefined || sameSubject ? 'restart' : 'fresh',
            })
            request(source, undefined, true)
        }
    })

    const loadMore = useCallback(() => {
        const { sources: current, state: merge } = latest.current
        for (const key of limitingSources(merge)) {
            const source = current.find((s) => s.key === key)
            if (source === undefined || requests.current.has(key)) {
                continue
            }
            dispatch({ type: 'start', key, mode: 'more' })
            request(source, merge.sources.get(key)?.cursor, false)
        }
    }, [request])

    const retry = useCallback(
        (sourceKey: string) => {
            const { sources: current, state: merge } = latest.current
            const source = current.find((s) => s.key === sourceKey)
            const status = merge.sources.get(sourceKey)
            const failed =
                status?.status === 'error' || status?.status === 'unsupported'
            if (
                source === undefined ||
                status === undefined ||
                !failed ||
                requests.current.has(sourceKey)
            ) {
                return
            }
            dispatch({ type: 'start', key: sourceKey, mode: 'retry' })
            request(
                source,
                status.hasPage ? status.cursor : undefined,
                !status.hasPage
            )
        },
        [request]
    )

    const entries = useMemo(() => visibleEntries(state), [state])
    const sourceStates = useMemo(
        () =>
            state.keys.flatMap((key): SourceState[] => {
                const source = state.sources.get(key)
                if (source === undefined) {
                    return []
                }
                return [
                    {
                        key,
                        label: sources.find((s) => s.key === key)?.label ?? key,
                        status: source.status,
                        partial: source.partial,
                        loadingMore: source.loadingMore,
                        completeUntil: source.completeUntil,
                        error: source.error,
                        notice: source.notice,
                    },
                ]
            }),
        [state, sources]
    )

    const all = [...state.sources.values()]
    return {
        entries,
        status: all.some(isAwaitingFirstAnswer) ? 'loading' : 'ready',
        sources: sourceStates,
        hasMore: limitingSources(state).length > 0,
        loadingMore: all.some((s) => s.loadingMore),
        loadMore,
        retry,
    }
}
