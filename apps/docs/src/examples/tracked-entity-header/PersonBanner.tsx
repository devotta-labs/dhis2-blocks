import {
    ObservationInline,
    ObservationsProvider,
} from '@/components/observation-cards'
import {
    TrackedEntityAttribute,
    TrackedEntityBanner,
    TrackedEntityBorn,
    TrackedEntityDetails,
    TrackedEntityEnrollment,
    TrackedEntityFacts,
    TrackedEntityHeaderProvider,
    TrackedEntityName,
    TrackedEntityOwner,
    TrackedEntityStatus,
} from '@/components/tracked-entity-header'

/*
 * WHO RMNCH Tracker in the Sierra Leone demo database: person `Y8aEiTpHSSQ`
 * in program `WSGAb5XwJ3Y`. Replace with your program's uids. List a
 * program's attributes with:
 * GET /api/programs/<program>?fields=programTrackedEntityAttributes[displayInList,trackedEntityAttribute[id,displayName,valueType]]
 */
const PERSON = 'Y8aEiTpHSSQ'
const PROGRAM = 'WSGAb5XwJ3Y'
const FIRST_NAME = 'w75KJ2mc4zz'
const LAST_NAME = 'zDhUuAYrxNC'
const BIRTH_DATE = 'gHGyrwKPzej'
const UNIQUE_ID = 'lZGmxYbs97q'
const ALLERGIES = 'gu1fqsmoU8r'
/** A number from the person's visits. */
const HAEMOGLOBIN = 'vANAXwtLwcT'

/**
 * The default banner, then one composed from parts. The facts line reads the
 * person's events through `ObservationsProvider`; the banner needs none.
 */
export default function PersonBanner() {
    return (
        <ObservationsProvider trackedEntity={PERSON} program={PROGRAM}>
            <div className="grid gap-4">
                <TrackedEntityHeaderProvider
                    trackedEntity={PERSON}
                    program={PROGRAM}
                >
                    <TrackedEntityBanner />
                </TrackedEntityHeaderProvider>
                {/* One provider per banner: the details skip what any banner under a provider shows. */}
                <TrackedEntityHeaderProvider
                    trackedEntity={PERSON}
                    program={PROGRAM}
                >
                    <TrackedEntityBanner>
                        <TrackedEntityName
                            attributes={[FIRST_NAME, LAST_NAME]}
                        />
                        <TrackedEntityStatus />
                        <TrackedEntityBorn attribute={BIRTH_DATE} />
                        <TrackedEntityAttribute attribute={UNIQUE_ID} />
                        <TrackedEntityEnrollment />
                        <TrackedEntityOwner />
                        <TrackedEntityFacts>
                            <TrackedEntityAttribute attribute={ALLERGIES} />
                            <ObservationInline
                                dataElement={HAEMOGLOBIN}
                                label="Haemoglobin"
                                unit="g/dL"
                            />
                        </TrackedEntityFacts>
                        <TrackedEntityDetails />
                    </TrackedEntityBanner>
                </TrackedEntityHeaderProvider>
            </div>
        </ObservationsProvider>
    )
}
