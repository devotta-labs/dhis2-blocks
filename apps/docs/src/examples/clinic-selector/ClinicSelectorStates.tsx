import {
    ClinicProvider,
    ClinicSelector,
    useClinic,
} from '@/components/clinic-selector'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { stubClient, type Scenario } from './stubClient'

// Only for this example: your app already has its own QueryClientProvider.
const queryClient = new QueryClient()
// Created once, outside render: each client caches its own results.
const clients = { one: stubClient('one'), three: stubClient('three') }

function Current() {
    const { clinic } = useClinic()
    return (
        <p className="mt-3 text-sm text-muted-foreground">
            Working in {clinic?.displayName}
        </p>
    )
}

const Case = ({ scenario, title }: { scenario: Scenario; title: string }) => (
    <div className="min-w-0">
        <h3 className="mb-2 text-sm font-medium">{title}</h3>
        <ClinicProvider client={clients[scenario]}>
            <div className="rounded-md bg-dhis2-sidebar px-3 py-4 text-dhis2-sidebar-foreground">
                <ClinicSelector />
            </div>
            <Current />
        </ClinicProvider>
    </div>
)

/** A user with one clinic gets a plain label; a user with a few gets a menu. */
export default function ClinicSelectorStates() {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="grid gap-6 sm:grid-cols-2">
                <Case scenario="one" title="One clinic" />
                <Case scenario="three" title="Three clinics" />
            </div>
        </QueryClientProvider>
    )
}
