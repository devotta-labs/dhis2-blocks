import { Button } from '@/components/dhis2/ui/button'
import React from 'react'
import { page } from 'vitest/browser'
import {
    TrackedEntityActions,
    TrackedEntityAttribute,
    TrackedEntityBanner,
    TrackedEntityDate,
    TrackedEntityDetails,
    TrackedEntityEnrollment,
    TrackedEntityFacts,
    TrackedEntityName,
    TrackedEntityOwner,
    TrackedEntityStatus,
} from '..'
import {
    ALLERGIES,
    BIRTH_DATE,
    FIRST,
    LAST,
    type Edit,
    type RawPerson,
} from './valuePartsSupport'

export const UNIQUE_ID = 'lZGmxYbs97q'

export const banner = () => page.getByRole('region').element()

export const flags =
    (inactive: boolean, potentialDuplicate = false): Edit<RawPerson> =>
    (raw) => ({ ...raw, inactive, potentialDuplicate })

/** Every part placed by hand, with an action. */
export const Composed = () => (
    <TrackedEntityBanner>
        <TrackedEntityName attributes={[FIRST, LAST]} />
        <TrackedEntityStatus />
        <TrackedEntityDate attribute={BIRTH_DATE} />
        <TrackedEntityAttribute attribute={UNIQUE_ID} />
        <TrackedEntityActions>
            <Button>Record visit</Button>
        </TrackedEntityActions>
        <TrackedEntityFacts>
            <TrackedEntityAttribute attribute={ALLERGIES} />
            <TrackedEntityOwner />
            <TrackedEntityEnrollment />
        </TrackedEntityFacts>
        <TrackedEntityDetails />
    </TrackedEntityBanner>
)
