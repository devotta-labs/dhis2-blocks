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
    settings: Pick<LabSettings, 'arrangement' | 'width'>
}

/** The banner on its own, or with every part placed by hand. */
const Banner = ({
    parts,
    arrangement,
    onSelect,
}: {
    parts: Parts
    arrangement: LabSettings['arrangement']
    onSelect: (trackedEntity: string) => void
}) => (
    <TrackedEntityBanner>
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
        <div className={settings.width === 'narrow' ? 'max-w-sm' : 'max-w-4xl'}>
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
                    />
                </TrackedEntityHeaderProvider>
            </WithObservations>
            {opened ? (
                <p className="m-0 mt-2 text-xs text-dhis2-muted-foreground">
                    Host opens {opened}
                </p>
            ) : null}
        </div>
    )
}
