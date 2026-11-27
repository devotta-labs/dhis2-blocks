import { z } from 'zod'
import { languageTags } from '@/components/dhis2-value-types'
import { rounded, type Position } from '@/components/location-map'

/** A place a search found. */
export interface PlaceResult {
    name: string
    /** Where it is: the rest of its address. */
    detail?: string
    position: Position
    /** Its extent, south-west then north-east, for the map to fit. */
    bounds?: readonly [Position, Position]
}

/** Finds places for the text typed in the map's search box. Called when the user presses Enter, never per key. */
export type PlaceSearch = (
    query: string,
    signal: AbortSignal
) => Promise<readonly PlaceResult[]>

const nominatimSchema = z.array(
    z.object({
        display_name: z.string(),
        name: z.string().optional(),
        lat: z.coerce.number(),
        lon: z.coerce.number(),
        // South, north, west, east.
        boundingbox: z
            .tuple([
                z.coerce.number(),
                z.coerce.number(),
                z.coerce.number(),
                z.coerce.number(),
            ])
            .optional(),
    })
)

/**
 * OpenStreetMap's public Nominatim server. Its usage policy allows a search when the user asks for one, about one a
 * second across all of an app's users, no searching as they type, and expects the app to be able to turn it off when
 * asked; the map already credits OpenStreetMap. Pass it as `search` only after reading that policy.
 */
export const nominatimSearch: PlaceSearch = async (query, signal) => {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.search = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        limit: '6',
        'accept-language': languageTags().join(',') || 'en',
    }).toString()
    const response = await fetch(url, { signal })
    if (!response.ok) throw new Error(`Nominatim answered ${response.status}`)
    return nominatimSchema
        .parse(await response.json())
        .map(({ display_name, name, lat, lon, boundingbox }) => {
            // Its address parts, once each where it repeats one beside it (`Sierra Leone, Sierra Leone`).
            const parts = display_name
                .split(', ')
                .filter((part, index, all) => part !== all[index - 1])
            const [first = display_name, ...rest] = parts
            const place: PlaceResult = {
                name: name || first,
                detail: (name && name !== first ? [first, ...rest] : rest).join(
                    ', '
                ),
                position: rounded([lon, lat]),
            }
            if (boundingbox) {
                const [south, north, west, east] = boundingbox
                place.bounds = [rounded([west, south]), rounded([east, north])]
            }
            return place
        })
}
