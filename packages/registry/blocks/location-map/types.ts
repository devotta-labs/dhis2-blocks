import type { LocationGeometry, MapGeometry, Position } from './geometry'

/** Where a map's background comes from: an XYZ tile template and the credit its provider asks for. */
export interface MapTiles {
    /** `https://…/{z}/{x}/{y}.png` */
    url: string
    /** Shown on the map; may hold links. */
    attribution: string
}

/** Something drawn for orientation, never edited: an org unit's point or boundary, a facility. */
export interface MapReference {
    /** Shown beside a point. */
    name?: string
    geometry: MapGeometry
}

/** Where the device is, drawn apart from what is recorded. */
export interface MapPosition {
    position: Position
    /** How far off it may be: a 68% radius, in metres. */
    accuracyM?: number
}

export interface LocationMapProps {
    /** What is recorded. An area with holes or several parts is shown and never edited. */
    value?: MapGeometry | null
    /** Absent, the map only shows. Present, a click, a drag or the keyboard changes the value. */
    onChange?: (value: LocationGeometry | null) => void
    /** What an empty map captures; otherwise what `value` is. */
    capture?: 'point' | 'area'
    /** Drawn quietly for orientation. */
    references?: readonly MapReference[]
    /** The device's own position. */
    here?: MapPosition
    /** The background. `null` draws none; absent, OpenStreetMap's standard tiles. */
    tiles?: MapTiles | null
    /**
     * The zoom level it opens at, from 0 (the world) to 19 (a building), centred on what it shows. Absent, it fits
     * what it shows: the value, else the references and `here`; a single point opens at 16.
     */
    zoom?: number
    /** Brought into view whenever it changes: one position close up, several fitted. */
    frame?: readonly Position[]
    /** The map's accessible name. */
    label?: string
    /** Size the map here; it fills what it is given. */
    className?: string
}
