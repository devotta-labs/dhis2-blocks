import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/* The DHIS2 Global Shell tracks the app URL by listening for "popstate"
   events, but react-router@6+ inlined the history library and no longer
   emits "popstate" on pushState/replaceState. Re-dispatch a "popstate"
   event on every router location change so the shell stays in sync. */
export const SyncUrlWithGlobalShell = ({
    children,
}: {
    children?: React.ReactNode
}) => {
    const location = useLocation()

    useEffect(() => {
        dispatchEvent(new PopStateEvent('popstate'))
    }, [location.key])

    return <>{children}</>
}
