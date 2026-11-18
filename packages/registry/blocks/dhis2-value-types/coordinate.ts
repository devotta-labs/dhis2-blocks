import { canonicalNumber } from './numbers'

const COORDINATE = /^\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]$/

const COORDINATE_LIMITS = { latitude: 90, longitude: 180 }

/**
 * A typed latitude or longitude in the form numbers are stored in (`.5` is `0.5`, `5.` is `5`), or `undefined` when
 * it is not a number, as in a number cell, or lies outside its limit: 90 degrees for a latitude, 180 for a longitude.
 */
export const coordinateNumber = (
    axis: keyof typeof COORDINATE_LIMITS,
    text: string
): string | undefined => {
    const number = canonicalNumber(text.trim())
    return number !== undefined &&
        Math.abs(Number(number)) <= COORDINATE_LIMITS[axis]
        ? number
        : undefined
}

/** A stored `[lng,lat]` as its numbers, or `undefined` when it is not one or is past a limit. */
export const parseCoordinate = (
    value: string
): { longitude: string; latitude: string } | undefined => {
    const match = COORDINATE.exec(value)
    return match !== null &&
        Math.abs(Number(match[1])) <= COORDINATE_LIMITS.longitude &&
        Math.abs(Number(match[2])) <= COORDINATE_LIMITS.latitude
        ? { longitude: match[1], latitude: match[2] }
        : undefined
}

// One angle in degrees, minutes and seconds, or in decimal degrees.
const DEGREES = String.raw`(\d+(?:\.\d+)?)\s*°?\s*(?:(\d+(?:\.\d+)?)\s*['′’]\s*)?(?:(\d+(?:\.\d+)?)\s*(?:["″”]|''|′′))?`
const SEPARATOR = String.raw`\s*[,;]?\s*`
// Two angles, each with its hemisphere letter after it (`8°29'N 13°14'W`) or before it (`N 8°29' W 13°14'`).
const ANGLES = [
    new RegExp(
        String.raw`^${DEGREES}\s*([NSEW])${SEPARATOR}${DEGREES}\s*([NSEW])$`,
        'i'
    ),
    new RegExp(
        String.raw`^([NSEW])\s*${DEGREES}${SEPARATOR}([NSEW])\s*${DEGREES}$`,
        'i'
    ),
]
// "lat,lng" inside other text, such as the `@8.4871,-13.2356,15z` of a maps link; never a pair after `[`, which is
// GeoJSON's lng,lat.
const EMBEDDED = /(?<![\d.[-]\s*)(-?\d+\.\d+),\s*(-?\d+\.\d+)(?![\d.])/

const pair = (latitude: string | undefined, longitude: string | undefined) => {
    const lat = latitude && coordinateNumber('latitude', latitude)
    const lng = longitude && coordinateNumber('longitude', longitude)
    return lat && lng ? `[${lng},${lat}]` : undefined
}

/** One angle as signed decimal degrees and its axis, from its hemisphere letter. */
const angle = (
    letter: string,
    [degrees = '', minutes = '0', seconds = '0']: ReadonlyArray<
        string | undefined
    >
) => {
    if (Number(minutes) >= 60 || Number(seconds) >= 60) {
        return undefined
    }
    const value =
        Number(degrees) + Number(minutes) / 60 + Number(seconds) / 3600
    const hemisphere = letter.toUpperCase()
    const signed = hemisphere === 'S' || hemisphere === 'W' ? -value : value
    return {
        axis:
            hemisphere === 'N' || hemisphere === 'S' ? 'latitude' : 'longitude',
        // Six places is about 10 cm; more would only be noise of the conversion.
        number: String(Number(signed.toFixed(6))),
    }
}

/** Two angles with hemisphere letters, one a latitude and one a longitude, in either order. */
const anglesToStored = (text: string) => {
    const [after, before] = ANGLES.map((pattern) => pattern.exec(text))
    const angles =
        (after &&
            [after.slice(1, 5), after.slice(5, 9)].map((parts) =>
                angle(parts[3] ?? '', parts.slice(0, 3))
            )) ??
        (before &&
            [before.slice(1, 5), before.slice(5, 9)].map((parts) =>
                angle(parts[0] ?? '', parts.slice(1))
            ))
    const [first, second] = angles ?? []
    if (
        first === undefined ||
        second === undefined ||
        first.axis === second.axis
    ) {
        return undefined
    }
    const find = (axis: string) =>
        [first, second].find((each) => each.axis === axis)?.number
    return pair(find('latitude'), find('longitude'))
}

/**
 * A coordinate as `[lng,lat]`, typed or pasted as `lat, lng`, in the stored `[lng,lat]` order with brackets, in
 * degrees (with minutes and seconds) and hemisphere letters, or as a `lat,lng` pair of decimals inside other text such
 * as a maps link. Text that is none of these, or has a number outside its limit, comes back as typed, for
 * `checkStored` to refuse. Which number is which is never guessed from its size.
 */
export const coordinateToStored = (text: string): string => {
    const bracketed = text.startsWith('[') && text.endsWith(']')
    const parts = (bracketed ? text.slice(1, -1) : text).split(',')
    const [first, second] = parts
    const plain =
        parts.length === 2
            ? pair(bracketed ? second : first, bracketed ? first : second)
            : undefined
    // Only text with more than numbers in it holds a pair inside it: `8.1,1.2,3.3` is not one.
    const embedded = /[^\d\s.,+\-[\]]/.test(text) ? EMBEDDED.exec(text) : null
    return (
        plain ??
        (bracketed ? undefined : anglesToStored(text)) ??
        (embedded === null ? undefined : pair(embedded[1], embedded[2])) ??
        text
    )
}
