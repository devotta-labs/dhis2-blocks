import AppAdapter from '@dhis2/app-adapter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCallback, useLayoutEffect, useState } from 'react'

/**
 * Shared live preview host.
 *
 * The adapter owns the DHIS2 session for every live preview: it discovers the
 * server version and API version, loads the current user and locale, renders
 * the sign-in dialog when credentials are needed, and reloads the page when
 * the authenticated identity changes — which also discards the query cache
 * below. The adapter's data engine strips leading slashes when joining
 * paths, so `url` carries the absolute same-origin `/dhis2` prefix —
 * the host still never talks to an arbitrary server.
 *
 * Previews always run in plugin mode: no DHIS2 header bar and no page-wide
 * loading mask, so the docs own the loading UI. `fallback` shows while the
 * adapter starts the session (it renders nothing meanwhile); pass the same
 * placeholder the example suspends with, and the hand-over is invisible.
 */
const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnReconnect: true,
                refetchOnWindowFocus: false,
                retry: 2,
                staleTime: 20_000,
            },
            mutations: { retry: false },
        },
    })

const SessionReady = ({ onReady }: { onReady: () => void }) => {
    // Layout effect: the outer fallback is removed before the browser paints
    // the example's own fallback in its place.
    useLayoutEffect(onReady, [onReady])

    return null
}

export const LivePreviewHost = ({
    children,
    fallback,
}: {
    children: ReactNode
    fallback: ReactNode
}) => {
    const [queryClient] = useState(createQueryClient)
    const [sessionReady, setSessionReady] = useState(false)
    const handleSessionReady = useCallback(() => setSessionReady(true), [])

    return (
        <>
            {!sessionReady && fallback}
            <AppAdapter
                appName="DHIS2 Blocks documentation"
                appVersion="1.0.0"
                url={`${window.location.origin}/dhis2`}
                pwaEnabled={false}
                plugin
            >
                <QueryClientProvider client={queryClient}>
                    <SessionReady onReady={handleSessionReady} />
                    {children}
                </QueryClientProvider>
            </AppAdapter>
        </>
    )
}
