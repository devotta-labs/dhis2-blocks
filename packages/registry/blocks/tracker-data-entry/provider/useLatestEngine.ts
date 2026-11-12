import { useDataEngine } from '@dhis2/app-runtime'
import { useLayoutEffect, useRef, useState } from 'react'

type DataEngine = ReturnType<typeof useDataEngine>

/** An engine whose every call goes to the engine `latest` holds at that moment. */
const forwardTo = (latest: { current: DataEngine }): DataEngine =>
    new Proxy(latest.current, {
        get: (_, name) => {
            if (name === 'query') {
                return latest.current.query.bind(latest.current)
            }
            if (name === 'mutate') {
                return latest.current.mutate.bind(latest.current)
            }
            return undefined
        },
    })

/**
 * One engine for the mount, which asks the provider's latest engine. It is for the open form, whose sync loop outlives
 * the render that started it: the data provider makes a new engine every render, which is no reason to open the form
 * again; a custom data provider's new engine may answer differently, so it is the one asked.
 */
export const useLatestEngine = () => {
    const latestEngine = useDataEngine()
    const latest = useRef(latestEngine)
    useLayoutEffect(() => {
        latest.current = latestEngine
    })
    const [engine] = useState(() => forwardTo(latest))
    return engine
}
