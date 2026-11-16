import {
    ClinicProvider,
    ClinicSelector,
    useClinic,
    type Clinic,
} from '@/components/clinic-selector'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { useState } from 'react'

interface Props {
    collapsed: boolean
    label: string
    value?: string
    /** Holds the menu open, for looking at it while changing something else. */
    keepOpen: boolean
    onCollapsedChange: (collapsed: boolean) => void
    onValueChange: (clinic: Clinic) => void
}

/** What the rest of the app sees through `useClinic()`. */
const ClinicPage = () => {
    const { status, clinic, retry } = useClinic()
    return (
        <section
            aria-label="Page"
            className="flex min-w-0 flex-1 flex-col gap-3 bg-background p-6 text-sm text-foreground"
        >
            <h3 className="m-0 text-xl font-medium break-words">
                {clinic?.displayName ?? 'No clinic'}
            </h3>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted-foreground">
                <dt>Status</dt>
                <dd className="m-0 font-mono">{status}</dd>
                <dt>Id</dt>
                <dd className="m-0 font-mono">{clinic?.id ?? '–'}</dd>
                <dt>Path</dt>
                <dd className="m-0 font-mono break-all">
                    {clinic?.path ?? '–'}
                </dd>
            </dl>
            <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={retry}
            >
                Retry
            </Button>
        </section>
    )
}

const LINKS = ['Visits', 'Patients', 'Stock']

export const ClinicCanvas = ({
    collapsed,
    label,
    value,
    keepOpen,
    onCollapsedChange,
    onValueChange,
}: Props) => {
    const [open, setOpen] = useState(false)
    return (
        <ClinicProvider value={value} onValueChange={onValueChange}>
            <div className="flex min-h-96 w-full flex-col overflow-hidden rounded-md border border-border bg-background md:flex-row">
                {/* A plain navigation rail: the selector at the top, narrowed to its tile when collapsed. */}
                <aside
                    className={cn(
                        'flex shrink-0 flex-col gap-2 border-b border-border p-3 md:border-e md:border-b-0',
                        collapsed ? 'md:w-13' : 'md:w-60'
                    )}
                >
                    <ClinicSelector
                        collapsed={collapsed}
                        label={label}
                        open={keepOpen || open}
                        onOpenChange={setOpen}
                    />
                    <nav
                        aria-label="Workspace navigation"
                        className={cn(
                            'flex flex-col gap-1 text-sm',
                            collapsed && 'md:hidden'
                        )}
                    >
                        {LINKS.map((link) => (
                            <a
                                key={link}
                                href={`#${link.toLowerCase()}`}
                                className="rounded-md px-2 py-1.5 text-foreground no-underline hover:bg-accent"
                            >
                                {link}
                            </a>
                        ))}
                    </nav>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mt-auto self-start max-md:hidden"
                        aria-expanded={!collapsed}
                        onClick={() => onCollapsedChange(!collapsed)}
                    >
                        {collapsed ? '»' : '« Collapse'}
                    </Button>
                </aside>
                <ClinicPage />
            </div>
        </ClinicProvider>
    )
}
