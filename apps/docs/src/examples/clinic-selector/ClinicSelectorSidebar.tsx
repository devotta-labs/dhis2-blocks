import {
    ClinicProvider,
    ClinicSelector,
    useClinic,
} from '@/components/clinic-selector'
import { Button } from '@/components/dhis2/ui/button'
import { useState } from 'react'

/** Any page under the provider can scope its data to the current clinic. */
function ClinicPage() {
    const { clinic, status } = useClinic()
    return (
        <section aria-label="Selected page" className="min-w-0 flex-1 p-6">
            <h3 className="text-xl font-medium">
                {clinic?.displayName ?? 'No clinic'}
            </h3>
            <p className="mt-3 text-sm text-muted-foreground">
                Status: {status}
            </p>
        </section>
    )
}

export default function ClinicSelectorSidebar() {
    const [collapsed, setCollapsed] = useState(false)
    return (
        <ClinicProvider>
            <div className="flex min-h-80 flex-col overflow-hidden rounded-md border border-border bg-background md:flex-row">
                <aside
                    className={`flex shrink-0 flex-col gap-2 border-b border-border p-3 md:border-e md:border-b-0 ${collapsed ? 'md:w-13' : 'md:w-60'}`}
                >
                    {/* At the top of the navigation, where it stays while the links below collapse. */}
                    <ClinicSelector collapsed={collapsed} />
                    <nav
                        aria-label="Workspace navigation"
                        className={`flex flex-col gap-1 text-sm ${collapsed ? 'md:hidden' : ''}`}
                    >
                        <a href="#visits" className="rounded-md px-2 py-1.5">
                            Visits
                        </a>
                        <a href="#stock" className="rounded-md px-2 py-1.5">
                            Stock
                        </a>
                    </nav>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mt-auto self-start max-md:hidden"
                        aria-expanded={!collapsed}
                        onClick={() => setCollapsed(!collapsed)}
                    >
                        {collapsed ? '»' : '« Collapse'}
                    </Button>
                </aside>
                <ClinicPage />
            </div>
        </ClinicProvider>
    )
}
