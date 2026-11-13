import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { ClinicProvider, ClinicSelector } from '..'
import { createServer, facility } from './clinicServerSupport'

/** A selector over three clinics, in a sidebar-coloured header. */
export const ClinicSelectorFixture = () => {
    const [queryClient] = React.useState(() => new QueryClient())
    const [server] = React.useState(() =>
        createServer({
            assigned: [
                facility('Ocean Beach Clinic'),
                facility('Bristol Clinic'),
                facility('Harbour Clinic'),
            ],
        })
    )
    return (
        <QueryClientProvider client={queryClient}>
            <ClinicProvider client={server.client}>
                <div className="w-60 bg-dhis2-sidebar px-3 py-4 text-dhis2-sidebar-foreground">
                    <ClinicSelector />
                </div>
            </ClinicProvider>
        </QueryClientProvider>
    )
}
