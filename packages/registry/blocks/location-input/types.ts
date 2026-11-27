import type { ReactNode } from 'react'
import type {
    LocationGeometry,
    MapGeometry,
    MapTiles,
} from '@/components/location-map'
import type { PlaceSearch } from './search'

/** The org unit an event or person is at: shown on the map, offered as a place, and checked against. */
export interface LocationOrgUnit {
    name: string
    geometry?: MapGeometry
}

/** The device's location, as the browser gives it. Pass another to simulate one. */
export type Locator = Pick<
    Geolocation,
    'getCurrentPosition' | 'watchPosition' | 'clearWatch'
>

/** Text typed that is not a location: the value stays as it was, and the form can hold Save back on it. */
export interface LocationProblem {
    message: string
    /** What was typed. */
    text: string
}

export interface LocationInputProps {
    /** The field's label. */
    label: string
    /** What the field captures. */
    capture: 'point' | 'area'
    /** What is recorded. An area with holes or several parts is shown and kept, never edited. */
    value?: MapGeometry | null
    /** Called with each change; `null` clears it. Fewer than three points is not an area: nothing is sent until there are three. */
    onChange: (
        value: LocationGeometry | null,
        problem?: LocationProblem
    ) => void
    id?: string
    description?: string
    required?: boolean
    /** Why the field cannot be changed; absent means it can. */
    readOnly?: string
    /**
     * Where the `readOnly` reason is given: under the field (`'visible'`, the default), or only in the box's accessible
     * description (`'described'`), for a host that shows it another way, such as a marker in `labelAside`; Tab then
     * passes the box. `'held'` describes it too and keeps the field drawn as when it can be changed, its buttons there
     * but inert, for a host that locks it for a moment, such as while it saves, so nothing moves.
     */
    readOnlyReason?: 'visible' | 'described' | 'held'
    /** Shown on the label's row, after the label, such as a host's marker; not part of the box's name. */
    labelAside?: ReactNode
    /** A host's messages, shown under the field, such as a server's errors; an error marks the field invalid. */
    messages?: ReadonlyArray<{
        tone: 'error' | 'warning' | 'info'
        text: string
    }>
    /** The org unit: drawn on the map, offered as `At <name>` when it is a point, and what the location is checked against. */
    orgUnit?: LocationOrgUnit
    /** Kilometres from a point org unit before a point is called far. Absent, the distance is shown without a warning. */
    warnKm?: number
    /** The map's background. `null` draws none; absent, OpenStreetMap. */
    tiles?: MapTiles | null
    /** Where "my location" comes from; the browser's by default. */
    locator?: Locator
    /**
     * Finds places typed in the map's search box, which searches on Enter. Absent, there is no box. `nominatimSearch`
     * is one, on OpenStreetMap's public server; read its usage policy before passing it.
     */
    search?: PlaceSearch
}
