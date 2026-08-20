import {
    QueryClient,
    QueryClientContext,
    QueryClientProvider,
} from '@tanstack/react-query'
import React, { useContext, useState, type ReactNode } from 'react'

export const createWorkingListQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnReconnect: true,
                refetchOnWindowFocus: true,
                retry: 2,
                staleTime: 20_000,
            },
            mutations: { retry: false },
        },
    })

export interface WorkingListQueryBoundaryProps {
    children: ReactNode
    /** Supply a shared client when multiple working lists should share cache. */
    client?: QueryClient
}

/**
 * Makes the package usable without requiring a host-level QueryClientProvider.
 * A caller may inject a client, otherwise the boundary owns one for its
 * lifetime and keeps all working-list cache state package-local.
 */
export const WorkingListQueryBoundary = ({
    children,
    client,
}: WorkingListQueryBoundaryProps) => {
    const [ownedClient] = useState(createWorkingListQueryClient)
    const inheritedClient = useContext(QueryClientContext)
    const resolvedClient = client ?? inheritedClient ?? ownedClient

    if (resolvedClient === inheritedClient) {
        return <>{children}</>
    }

    return (
        <QueryClientProvider client={resolvedClient}>
            {children}
        </QueryClientProvider>
    )
}
