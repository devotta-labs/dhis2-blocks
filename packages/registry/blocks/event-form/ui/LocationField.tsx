import { memo, useMemo } from 'react'
import { LocationInput } from '@/components/location-input'
import type {
    LocationInputProps,
    LocationOrgUnit,
} from '@/components/location-input'
import type { EventFormValue } from '../hooks/useEventForm'
import { locationLabel, readLocation } from '../lib/location'
import { LOCATION } from '../lib/validate'

interface LocationFieldProps {
    /** The control's id: `${formId}-geometry`. */
    id: string
    capture: 'point' | 'area'
    /** The geometry as the form holds it, GeoJSON written out. */
    value?: string
    orgUnit?: LocationOrgUnit
    serverErrors?: readonly string[]
    readOnly?: string
    /** `'held'`: locked only for now, so the buttons stay, unable to change it. */
    readOnlyReason: LocationInputProps['readOnlyReason']
    commit: EventFormValue['commit']
    /** How far from a point org unit, in kilometres, before a point is called far. */
    warnKm?: number
    tiles?: LocationInputProps['tiles']
}

/**
 * The event's own location, a point or an area as the stage's feature type asks, placed against the org unit. Not
 * required, and never held back for being far.
 */
export const LocationField = memo(
    ({
        id,
        capture,
        value,
        orgUnit,
        serverErrors,
        readOnly,
        readOnlyReason,
        commit,
        warnKm,
        tiles,
    }: LocationFieldProps) => {
        // Read once per change, so the field is given the same geometry while the form renders for other fields.
        const geometry = useMemo(() => readLocation(value), [value])
        const change = commit(LOCATION)
        return (
            <LocationInput
                id={id}
                label={locationLabel(capture)}
                capture={capture}
                value={geometry}
                // Typed text that is no location keeps the value, and the form holds Save back on its problem.
                onChange={(next, problem) =>
                    change(next === null ? null : JSON.stringify(next), problem)
                }
                orgUnit={orgUnit}
                warnKm={warnKm}
                tiles={tiles}
                readOnly={readOnly}
                readOnlyReason={readOnlyReason}
                messages={serverErrors?.map((text) => ({
                    tone: 'error',
                    text,
                }))}
            />
        )
    }
)
