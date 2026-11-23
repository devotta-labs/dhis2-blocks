import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Keeps the DHIS2 Global Shell in sync with the router. The shell listens for
 * popstate, which React Router does not dispatch for pushState or replaceState.
 */
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
