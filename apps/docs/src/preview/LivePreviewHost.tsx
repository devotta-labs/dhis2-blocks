import AppAdapter from '@dhis2/app-adapter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCallback, useLayoutEffect, useState } from 'react'
import { Link } from 'react-router-dom'

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

const ContentReady = ({ onReady }: { onReady: () => void }) => {
    useLayoutEffect(onReady, [onReady])

    return null
}

export const LivePreviewHost = ({
    children,
    placeholder,
    signInUrl,
}: {
    children: ReactNode
    placeholder: ReactNode
    signInUrl?: string
}) => {
    const [queryClient] = useState(createQueryClient)
    const [contentReady, setContentReady] = useState(false)
    const [attempt, setAttempt] = useState(0)
    const handleContentReady = useCallback(() => setContentReady(true), [])

    return (
        <>
            {!contentReady && placeholder}
            <AppAdapter
                key={attempt}
                appName="DHIS2 Blocks documentation"
                appVersion="1.0.0"
                url={`${window.location.origin}/dhis2`}
                pwaEnabled={false}
                plugin
                connectionErrorFallback={
                    signInUrl ? (
                        <>
                            <ContentReady onReady={handleContentReady} />
                            <div
                                role="status"
                                className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground"
                            >
                                <p>Live preview unavailable.</p>
                                <p>
                                    Check the DHIS2 connection or open the
                                    full-screen preview to sign in.
                                </p>
                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        className="rounded-md border border-border px-3 py-1.5 font-medium hover:bg-muted"
                                        onClick={() => {
                                            setContentReady(false)
                                            setAttempt((value) => value + 1)
                                        }}
                                    >
                                        Retry preview
                                    </button>
                                    <Link
                                        to={signInUrl}
                                        className="text-primary underline-offset-4 hover:underline"
                                    >
                                        Open full screen
                                    </Link>
                                </div>
                            </div>
                        </>
                    ) : undefined
                }
            >
                <QueryClientProvider client={queryClient}>
                    <ContentReady onReady={handleContentReady} />
                    {children}
                </QueryClientProvider>
            </AppAdapter>
        </>
    )
}
