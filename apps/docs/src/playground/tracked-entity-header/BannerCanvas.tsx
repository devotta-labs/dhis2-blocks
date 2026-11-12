import {
    ObservationInline,
    ObservationsProvider,
} from '@/components/observation-cards'
import {
    TrackedEntityActions,
    TrackedEntityAttribute,
    TrackedEntityBanner,
    TrackedEntityDate,
    TrackedEntityDetails,
    TrackedEntityEnrollment,
    TrackedEntityFacts,
    TrackedEntityHeaderProvider,
    TrackedEntityName,
    TrackedEntityOwner,
    TrackedEntityRelationship,
    TrackedEntityRelationships,
    TrackedEntityStatus,
} from '@/components/tracked-entity-header'
import { Button } from '@/components/dhis2/ui/button'
import { useState, type ReactNode } from 'react'
import type { LabSettings } from './labData'
import type { Parts } from './labSubjects'

interface Props {
    trackedEntity: string
    program: string
    parts: Parts
    settings: Pick<LabSettings, 'arrangement' | 'width' | 'frame'>
}

// The banner draws no edge; the host adds one, and matches the padding to its page.
const FRAMES = {
    card: 'rounded-dhis2-md border border-dhis2-border-strong',
    page: 'border-b border-dhis2-border-strong px-6',
}

// A stand-in for the host's page, so the bar shows across its top.
const PAGE =
    'overflow-hidden rounded-dhis2-md border border-dhis2-border bg-dhis2-background'

/** The banner on its own, or with every part placed by hand. */
const Banner = ({
    parts,
    arrangement,
    onSelect,
    className,
}: {
    parts: Parts
    arrangement: LabSettings['arrangement']
    onSelect: (trackedEntity: string) => void
    className: string
}) => (
    <TrackedEntityBanner className={className}>
        {arrangement === 'composed' ? (
            <>
                <TrackedEntityName attributes={parts.name} />
                <TrackedEntityStatus />
                <TrackedEntityDate {...parts.date} />
                <TrackedEntityAttribute attribute={parts.identifier} />
                {parts.more.map((attribute) => (
                    <TrackedEntityAttribute
                        key={attribute}
                        attribute={attribute}
                    />
                ))}
                <TrackedEntityEnrollment />
                <TrackedEntityOwner />
                <TrackedEntityActions>
                    {parts.actions.map((action) => (
                        <Button key={action} variant="outline" size="sm">
                            {action}
                        </Button>
                    ))}
                </TrackedEntityActions>
                <TrackedEntityFacts>
                    <TrackedEntityAttribute attribute={parts.fact} />
                    {parts.haemoglobin ? (
                        <ObservationInline
                            dataElement={parts.haemoglobin}
                            unit="g/dL"
                        />
                    ) : null}
                    {parts.relationships?.key ? (
                        <TrackedEntityRelationship
                            {...parts.relationships.key}
                            href={(id) => `#${id}`}
                            onSelect={onSelect}
                        />
                    ) : null}
                </TrackedEntityFacts>
                <TrackedEntityDetails />
                {parts.relationships ? (
                    <TrackedEntityRelationships
                        labels={parts.relationships.labels}
                        href={(id) => `#${id}`}
                        onSelect={onSelect}
                        moreHref={(type) => `#cases-${type}`}
                    />
                ) : null}
            </>
        ) : null}
    </TrackedEntityBanner>
)

/** The facts line reads the person's visits, so only a person with one needs the observations loaded. */
const WithObservations = ({
    trackedEntity,
    program,
    needed,
    children,
}: Pick<Props, 'trackedEntity' | 'program'> & {
    needed: boolean
    children: ReactNode
}) =>
    needed ? (
        <ObservationsProvider trackedEntity={trackedEntity} program={program}>
            {children}
        </ObservationsProvider>
    ) : (
        children
    )

export const BannerCanvas = ({
    trackedEntity,
    program,
    parts,
    settings,
}: Props) => {
    const [opened, setOpened] = useState<string>()
    return (
        <div
            className={`${settings.width === 'narrow' ? 'max-w-sm' : 'max-w-4xl'} ${settings.frame === 'page' ? PAGE : ''}`}
        >
            <WithObservations
                trackedEntity={trackedEntity}
                program={program}
                needed={parts.haemoglobin !== undefined}
            >
                <TrackedEntityHeaderProvider
                    trackedEntity={trackedEntity}
                    program={program}
                >
                    <Banner
                        parts={parts}
                        arrangement={settings.arrangement}
                        onSelect={setOpened}
                        className={FRAMES[settings.frame]}
                    />
                </TrackedEntityHeaderProvider>
            </WithObservations>
            {settings.frame === 'page' ? (
                <p className="m-0 px-6 py-8 text-sm text-dhis2-muted-foreground">
                    The rest of the page
                </p>
            ) : null}
            {opened ? (
                <p className="m-0 mt-2 text-xs text-dhis2-muted-foreground">
                    Host opens {opened}
                </p>
            ) : null}
        </div>
    )
}
