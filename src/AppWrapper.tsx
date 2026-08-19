import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import App from '@/App'
import '@/index.css'
import '@/locales'
import { ErrorBoundary } from '@/app/ErrorBoundary'

const queryClient = new QueryClient({
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

const AppWrapper = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </QueryClientProvider>
    )
}

export default AppWrapper
