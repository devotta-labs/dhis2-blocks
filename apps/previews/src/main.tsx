import { Provider } from '@dhis2/app-runtime'
import {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListViewSwitcher,
} from '@dhis2-blocks/working-list'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { workingListPreviewConfig } from './config'
import './styles.css'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: false,
            staleTime: 20_000,
        },
        mutations: { retry: false },
    },
})
const proxyBaseUrl = `${window.location.origin}/api/dhis2`

type Availability = 'checking' | 'available' | 'unavailable'

const Preview = () => {
    const [availability, setAvailability] = useState<Availability>('checking')

    useEffect(() => {
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 10_000)
        const { apiVersion } = workingListPreviewConfig

        void fetch(`/api/dhis2/api/${apiVersion}/system/info?fields=version`, {
            signal: controller.signal,
        })
            .then((response) => {
                setAvailability(response.ok ? 'available' : 'unavailable')
            })
            .catch(() => setAvailability('unavailable'))
            .finally(() => window.clearTimeout(timeout))

        return () => {
            window.clearTimeout(timeout)
            controller.abort()
        }
    }, [])

    if (availability !== 'available') {
        return (
            <p className="preview-message">
                {availability === 'checking'
                    ? 'Loading preview…'
                    : 'The DHIS2 demo server is unavailable.'}
            </p>
        )
    }

    return (
        <Provider
            config={{
                baseUrl: proxyBaseUrl,
                apiVersion: workingListPreviewConfig.apiVersion,
            }}
            userInfo={undefined}
            plugin={false}
            parentAlertsAdd={undefined}
            showAlertsInPlugin={false}
        >
            <QueryClientProvider client={queryClient}>
                <main className="preview-shell">
                    <WorkingList
                        programId={workingListPreviewConfig.programId}
                        orgUnitId={workingListPreviewConfig.orgUnitId}
                        defaultPagination={{ page: 1, pageSize: 15 }}
                    >
                        <WorkingListViewSwitcher />
                        <WorkingListToolbar>
                            <WorkingListColumnSelector />
                            <WorkingListFilterControls />
                        </WorkingListToolbar>
                        <WorkingListTable />
                    </WorkingList>
                </main>
            </QueryClientProvider>
        </Provider>
    )
}

const root = document.getElementById('root')

if (!root) {
    throw new Error('Preview root element was not found.')
}

createRoot(root).render(
    <React.StrictMode>
        <Preview />
    </React.StrictMode>
)
