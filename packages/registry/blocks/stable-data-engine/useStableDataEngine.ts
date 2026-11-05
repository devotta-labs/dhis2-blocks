import { useDataEngine } from '@dhis2/app-runtime'
import { useLayoutEffect, useMemo, useRef } from 'react'

type DataEngine = ReturnType<typeof useDataEngine>

/** The data engine's requests, without its link. */
export type StableDataEngine = Pick<DataEngine, 'query' | 'mutate'>

/**
 * The data engine as one object for the component's lifetime. Before app-runtime 3.17.4 the data provider makes a new
 * engine every time it renders, and from 3.17.4 whenever its config object changes. An engine holds only its
 * configuration, so each request goes to the provider's latest engine instead. Anything that must reset when the
 * server changes keys on `useConfig().baseUrl`, not on this.
 */
export const useStableDataEngine = (): StableDataEngine => {
    const engine = useDataEngine()
    const latest = useRef(engine)
    useLayoutEffect(() => {
        latest.current = engine
    }, [engine])
    return useMemo(
        () => ({
            // SAFETY: every argument goes on to the same method of the latest engine, so it answers to each of the method's overloads as that method does.
            query: ((...request: Parameters<DataEngine['query']>) =>
                latest.current.query(...request)) as DataEngine['query'],
            mutate: (...request) => latest.current.mutate(...request),
        }),
        []
    )
}
