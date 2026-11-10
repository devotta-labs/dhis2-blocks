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
 * One engine per server, which asks the provider's latest engine. The data provider makes a new engine every render,
 * which is no reason to reload; a custom data provider's new engine may answer differently, so it is the one asked.
 */
export const useServerEngine = (serverUrl: string) => {
    const latestEngine = useDataEngine()
    const latest = useRef(latestEngine)
    useLayoutEffect(() => {
        latest.current = latestEngine
    })
    const [pinned, setPinned] = useState(() => ({
        serverUrl,
        engine: forwardTo(latest),
    }))
    if (pinned.serverUrl !== serverUrl) {
        setPinned({ serverUrl, engine: forwardTo(latest) })
    }
    return pinned.engine
}
