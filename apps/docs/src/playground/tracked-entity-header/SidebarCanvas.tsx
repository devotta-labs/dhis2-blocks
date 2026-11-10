import {
    ObservationInline,
    ObservationsProvider,
} from '@/components/observation-cards'
import {
    TrackedEntityActions,
    TrackedEntityAttribute,
    TrackedEntityDate,
    TrackedEntityDetails,
    TrackedEntityEnrollment,
    TrackedEntityFacts,
    TrackedEntityHeaderProvider,
    TrackedEntityName,
    TrackedEntityOwner,
    TrackedEntityStatus,
    useTrackedEntityHeader,
} from '@/components/tracked-entity-header'
import { Button } from '@/components/dhis2/ui/button'
import type { ReactNode } from 'react'
import type { LabSettings } from './labData'
import type { Parts } from './labSubjects'

interface Props {
    trackedEntity: string
    program: string
    parts: Parts
    settings: Pick<LabSettings, 'width'>
}

const Section = ({
    title,
    children,
}: {
    title: string
    children: ReactNode
}) => (
    <section className="flex flex-col gap-1.5 border-t border-dhis2-border pt-3">
        <h3 className="m-0 text-xs font-medium tracking-wide text-dhis2-muted-foreground uppercase">
            {title}
        </h3>
        {children}
    </section>
)

const Sidebar = ({ parts }: { parts: Parts }) => {
    const { status, retry } = useTrackedEntityHeader()
    if (status === 'loading') return <p className="m-0 text-sm">Loading</p>
    if (status === 'restricted') {
        return (
            <p className="m-0 text-sm">You don't have access to this record</p>
        )
    }
    if (status === 'not-found') {
        return <p className="m-0 text-sm">This record doesn't exist</p>
    }
    if (status === 'failed') {
        return (
            <Button variant="outline" size="sm" onClick={retry}>
                Retry
            </Button>
        )
    }
    return (
        <>
            <div className="flex flex-col gap-2">
                <TrackedEntityName
                    id="sidebar-name"
                    attributes={parts.name}
                    className="text-2xl"
                />
                <TrackedEntityStatus />
            </div>
            <TrackedEntityActions className="grid grid-cols-2">
                {parts.actions.map((action, index) => (
                    <Button
                        key={action}
                        size="sm"
                        variant={index === 0 ? 'default' : 'outline'}
                        className={index === 0 ? 'col-span-2' : undefined}
                    >
                        {action}
                    </Button>
                ))}
            </TrackedEntityActions>
            <Section title="Safety">
                <TrackedEntityFacts className="flex-col items-start gap-y-2">
                    <TrackedEntityAttribute attribute={parts.fact} />
                    {parts.haemoglobin ? (
                        <ObservationInline
                            dataElement={parts.haemoglobin}
                            label="Haemoglobin"
                            unit="g/dL"
                        />
                    ) : null}
                </TrackedEntityFacts>
            </Section>
            <Section title="Identity">
                <TrackedEntityDate {...parts.date} />
                <TrackedEntityAttribute attribute={parts.identifier} />
                {parts.more.map((attribute) => (
                    <TrackedEntityAttribute
                        key={attribute}
                        attribute={attribute}
                    />
                ))}
            </Section>
            <Section title="Program">
                <TrackedEntityEnrollment />
                <TrackedEntityOwner />
            </Section>
            <Section title="Everything else">
                <TrackedEntityDetails />
            </Section>
        </>
    )
}

/** The parts as a page sidebar, with no banner, beside stand-ins for the rest of the page. */
export const SidebarCanvas = ({ trackedEntity, program, parts }: Props) => {
    const content = (
        <TrackedEntityHeaderProvider
            trackedEntity={trackedEntity}
            program={program}
        >
            <Sidebar parts={parts} />
        </TrackedEntityHeaderProvider>
    )
    return (
        <div className="flex w-full max-w-5xl gap-4">
            <aside
                aria-labelledby="sidebar-name"
                className="flex w-80 shrink-0 flex-col gap-4 rounded-dhis2-md border border-dhis2-border bg-dhis2-card p-4"
            >
                {parts.haemoglobin ? (
                    <ObservationsProvider
                        trackedEntity={trackedEntity}
                        program={program}
                    >
                        {content}
                    </ObservationsProvider>
                ) : (
                    content
                )}
            </aside>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
                {['Visits', 'Observations', 'Timeline'].map((title) => (
                    <div
                        key={title}
                        className="flex h-40 items-center justify-center rounded-dhis2-md border border-dashed border-dhis2-border-strong bg-dhis2-card text-sm text-dhis2-muted-foreground"
                    >
                        {title}
                    </div>
                ))}
            </div>
        </div>
    )
}
