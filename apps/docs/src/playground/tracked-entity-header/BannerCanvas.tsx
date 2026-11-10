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
    TrackedEntityStatus,
} from '@/components/tracked-entity-header'
import { Button } from '@/components/dhis2/ui/button'
import type { ReactNode } from 'react'
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
}: {
    parts: Parts
    arrangement: LabSettings['arrangement']
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
                </TrackedEntityFacts>
                <TrackedEntityDetails />
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
}: Props) => (
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
                <Banner parts={parts} arrangement={settings.arrangement} />
            </TrackedEntityHeaderProvider>
        </WithObservations>
    </div>
)
