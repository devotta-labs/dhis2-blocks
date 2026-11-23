import {
    OrgUnitProvider,
    OrgUnitSwitcher,
    useOrgUnit,
    type OrgUnitSwitcherTexts,
} from '@/components/org-unit-switcher'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { stubClient, type Scenario } from './stubClient'

const queryClient = new QueryClient()
const clients = { one: stubClient('one'), three: stubClient('three') }

const CLINICS: Partial<OrgUnitSwitcherTexts> = {
    label: 'Clinic',
    choose: 'Choose a clinic',
    noneAssigned: 'No clinic assigned',
    loadFailed: 'Clinics could not be loaded',
    changed: (name) => `Clinic changed to ${name}`,
}

function Current() {
    const { orgUnit } = useOrgUnit()
    return (
        <p className="mt-3 text-sm text-muted-foreground">
            Working in {orgUnit?.displayName}
        </p>
    )
}

const Case = ({ scenario, title }: { scenario: Scenario; title: string }) => (
    <div className="min-w-0">
        <h3 className="mb-2 text-sm font-medium">{title}</h3>
        <OrgUnitProvider client={clients[scenario]}>
            <div className="rounded-md border border-border bg-background px-3 py-4">
                <OrgUnitSwitcher texts={CLINICS} />
            </div>
            <Current />
        </OrgUnitProvider>
    </div>
)

/** A user with one clinic gets a plain label; a user with a few gets a menu. */
export default function OrgUnitSwitcherStates() {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="grid gap-6 sm:grid-cols-2">
                <Case scenario="one" title="One clinic" />
                <Case scenario="three" title="Three clinics" />
            </div>
        </QueryClientProvider>
    )
}
