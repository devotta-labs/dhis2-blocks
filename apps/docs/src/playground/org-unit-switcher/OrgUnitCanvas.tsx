import {
    OrgUnitProvider,
    OrgUnitSwitcher,
    useOrgUnit,
    type OrgUnit,
    type OrgUnitSwitcherTexts,
} from '@/components/org-unit-switcher'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'

interface Props {
    collapsed: boolean
    texts?: Partial<OrgUnitSwitcherTexts>
    value?: string
    onCollapsedChange: (collapsed: boolean) => void
    onValueChange: (orgUnit: OrgUnit) => void
}

/** What the rest of the app sees through `useOrgUnit()`. */
const OrgUnitPage = () => {
    const { status, orgUnit, retry } = useOrgUnit()
    return (
        <section
            aria-label="Page"
            className="flex min-w-0 flex-1 flex-col gap-3 bg-background p-6 text-sm text-foreground"
        >
            <h3 className="m-0 text-xl font-medium break-words">
                {orgUnit?.displayName ?? 'No clinic'}
            </h3>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted-foreground">
                <dt>Status</dt>
                <dd className="m-0 font-mono">{status}</dd>
                <dt>Id</dt>
                <dd className="m-0 font-mono">{orgUnit?.id ?? '–'}</dd>
                <dt>Path</dt>
                <dd className="m-0 font-mono break-all">
                    {orgUnit?.path ?? '–'}
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

export const OrgUnitCanvas = ({
    collapsed,
    texts,
    value,
    onCollapsedChange,
    onValueChange,
}: Props) => {
    return (
        <OrgUnitProvider value={value} onValueChange={onValueChange}>
            <div className="flex min-h-96 w-full flex-col overflow-hidden rounded-md border border-border bg-background md:flex-row">
                {/* A plain navigation rail: the selector at the top, narrowed to its tile when collapsed. */}
                <aside
                    className={cn(
                        'flex shrink-0 flex-col gap-2 border-b border-border p-3 md:border-e md:border-b-0',
                        collapsed ? 'md:w-12' : 'md:w-60'
                    )}
                >
                    <OrgUnitSwitcher collapsed={collapsed} texts={texts} />
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
                <OrgUnitPage />
            </div>
        </OrgUnitProvider>
    )
}
