import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { lazy, Suspense } from 'react'
import {
    createHashRouter,
    Navigate,
    RouterProvider,
    useLocation,
} from 'react-router-dom'
import App from './App'
import './index.css'
import './locales'
import { ErrorBoundary } from './app/ErrorBoundary'
import { SyncUrlWithGlobalShell } from './app/SyncUrlWithGlobalShell'
import { ContextSelectorShowcase } from './app/ContextSelectorShowcase'
import { EventFormDemo } from './app/EventFormDemo'

// Demo-only, with its own graph layout dependencies: kept out of the main bundle.
const ProgramRulesGraphDemo = lazy(() =>
    import('./app/ProgramRulesGraph').then((module) => ({
        default: module.ProgramRulesGraphDemo,
    }))
)

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

const RedirectToRoot = () => {
    const location = useLocation()
    return <Navigate to={{ pathname: '/', search: location.search }} replace />
}

const router = createHashRouter([
    {
        path: '/',
        element: (
            <ErrorBoundary>
                <SyncUrlWithGlobalShell>
                    <App />
                </SyncUrlWithGlobalShell>
            </ErrorBoundary>
        ),
    },
    {
        path: '/context-selector-showcase',
        element: (
            <ErrorBoundary>
                <ContextSelectorShowcase />
            </ErrorBoundary>
        ),
    },
    {
        path: '/event-form',
        element: (
            <ErrorBoundary>
                <EventFormDemo />
            </ErrorBoundary>
        ),
    },
    {
        path: '/program-rules-graph',
        element: (
            <ErrorBoundary>
                <Suspense fallback={null}>
                    <ProgramRulesGraphDemo />
                </Suspense>
            </ErrorBoundary>
        ),
    },
    {
        path: '*',
        element: <RedirectToRoot />,
    },
])

const AppWrapper = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    )
}

export default AppWrapper
