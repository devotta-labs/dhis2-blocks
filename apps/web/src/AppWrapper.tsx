import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import {
    createHashRouter,
    Navigate,
    RouterProvider,
    useLocation,
} from 'react-router-dom'
import App from './App'
import './index.css'
import './applyApplicationTheme'
import './locales'
import { ErrorBoundary } from './app/ErrorBoundary'
import { ContextSelectorShowcase } from './app/ContextSelectorShowcase'

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
                <App />
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
        path: '*',
        element: <RedirectToRoot />,
    },
])

/* The DHIS2 Global Shell tracks the app URL by listening for "popstate"
   events, but react-router@6+ inlined the history library and no longer
   emits "popstate" on pushState/replaceState. Re-dispatch a "popstate"
   event whenever the router commits a new location so the shell stays in
   sync. The key check also absorbs the router's own handling of that event. */
let shellLocationKey = router.state.location.key

router.subscribe(({ location }) => {
    if (location.key === shellLocationKey) return
    shellLocationKey = location.key
    dispatchEvent(new PopStateEvent('popstate'))
})

const AppWrapper = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    )
}

export default AppWrapper
