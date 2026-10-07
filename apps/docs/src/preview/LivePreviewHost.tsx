import AppAdapter from '@dhis2/app-adapter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useState } from 'react'

/**
 * Shared live preview host.
 *
 * The adapter owns the DHIS2 session for every live preview: it discovers the
 * server version and API version, loads the current user and locale, renders
 * the sign-in dialog when credentials are needed, and reloads the frame when
 * the authenticated identity changes — which also discards the query cache
 * below. `REACT_APP_DHIS2_BASE_URL` pins the base URL to the same-origin
 * `/dhis2` proxy, so the host never talks to an arbitrary server.
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

export const LivePreviewHost = ({ children }: { children: ReactNode }) => {
    const [queryClient] = useState(createQueryClient)

    return (
        <AppAdapter
            appName="DHIS2 Blocks documentation"
            appVersion="1.0.0"
            url="/dhis2"
            pwaEnabled={false}
        >
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </AppAdapter>
    )
}
