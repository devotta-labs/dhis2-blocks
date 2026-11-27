import { AreaInput } from './AreaInput'
import { PointInput } from './PointInput'
import type { LocationInputProps } from './types'

/**
 * A location as one form field, the height of the others: a point typed, pasted, taken from the device or placed on
 * a map; or an area whose points are added where the user stands, pasted or drawn. The map opens from the
 * field, as a popover or, on a phone, a sheet.
 */
export const LocationInput = ({
    capture,
    warnKm,
    ...props
}: LocationInputProps) =>
    capture === 'point' ? (
        <PointInput {...props} warnKm={warnKm} />
    ) : (
        <AreaInput {...props} />
    )
