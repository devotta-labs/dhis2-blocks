import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { OrgUnitProvider, OrgUnitSwitcher } from '..'
import { createServer, facility } from './orgUnitServerSupport'

/** A switcher over three clinics, in a navigation-width header. */
export const OrgUnitSwitcherFixture = () => {
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
            <OrgUnitProvider client={server.client}>
                <div className="w-60 bg-dhis2-background px-3 py-4 text-dhis2-foreground">
                    <OrgUnitSwitcher />
                </div>
            </OrgUnitProvider>
        </QueryClientProvider>
    )
}
