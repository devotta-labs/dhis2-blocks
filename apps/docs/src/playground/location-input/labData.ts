import type { LocationOrgUnit } from '@/components/location-input'
import type { MapGeometry, MapTiles, Position } from '@/components/location-map'

/** A program stage's `featureType`: what the event's own location may be. */
export type FeatureType = 'POINT' | 'POLYGON' | 'MULTI_POLYGON' | 'NONE'

export interface LabSettings {
    /** Which use of the blocks is on show. */
    view: 'input' | 'map' | 'event'
    /** What the input or map captures. */
    capture: 'point' | 'area'
    /** The stage's feature type, for the event view. */
    featureType: FeatureType
    /** What is recorded when the canvas opens. */
    start: 'empty' | 'stored' | 'far' | 'holed'
    orgUnit: 'facility' | 'district' | 'none'
    /** Whether a point is checked against the org unit's distance. */
    check: boolean
    readOnly: boolean
    /** Whether the map panel has a place search. */
    search: boolean
    tiles: 'osm' | 'failing' | 'none'
    device: 'walk' | 'poor' | 'real' | 'blocked'
}

export const READ_ONLY_REASON = 'This event is completed'

/** A kilometre and a half: past this, a point is said to be far from its facility. */
export const WARN_KM = 1.5

const FACILITY: Position = [-11.4197, 8.1039]

export const ORG_UNITS = {
    facility: {
        name: 'Ngelehun CHC',
        geometry: { type: 'Point', coordinates: FACILITY },
    },
    // An outline made for the lab, not Badjia's real boundary.
    district: {
        name: 'Badjia',
        geometry: {
            type: 'Polygon',
            coordinates: [
                [
                    [-11.452, 8.084],
                    [-11.401, 8.079],
                    [-11.384, 8.098],
                    [-11.392, 8.127],
                    [-11.431, 8.134],
                    [-11.458, 8.112],
                    [-11.452, 8.084],
                ],
            ],
        },
    },
    none: undefined,
} satisfies Record<LabSettings['orgUnit'], LocationOrgUnit | undefined>

/** A household a few hundred metres from the facility. */
export const STORED_POINT: Position = [-11.4174, 8.1061]

/** The same point with latitude and longitude the wrong way round: the mistake the check is for. */
export const FAR_POINT: Position = [8.1061, -11.4174]

/** A plot north-east of the facility, walked clockwise, closed. */
export const STORED_AREA: MapGeometry = {
    type: 'Polygon',
    coordinates: [
        [
            [-11.4182, 8.1052],
            [-11.4168, 8.1058],
            [-11.4159, 8.1049],
            [-11.4164, 8.1038],
            [-11.4179, 8.1041],
            [-11.4182, 8.1052],
        ],
    ],
}

/** An area with a hole: shown and kept, never edited. */
export const HOLED_AREA: MapGeometry = {
    type: 'Polygon',
    coordinates: [
        [
            [-11.4186, 8.1036],
            [-11.4156, 8.1036],
            [-11.4156, 8.1062],
            [-11.4186, 8.1062],
            [-11.4186, 8.1036],
        ],
        [
            [-11.4176, 8.1045],
            [-11.4166, 8.1045],
            [-11.4166, 8.1054],
            [-11.4176, 8.1054],
            [-11.4176, 8.1045],
        ],
    ],
}

/** Where the simulated device is at each press: round a field west of the facility, then back to the start. */
export const WALK: Position[] = [
    [-11.4214, 8.1031],
    [-11.4203, 8.1034],
    [-11.4199, 8.1026],
    [-11.4205, 8.1019],
    [-11.4216, 8.1022],
]

export const TILES = {
    osm: {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution:
            '&copy; <a target="_blank" rel="noreferrer" href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    // A host that never answers, as a clinic with no connection sees it.
    failing: {
        url: 'https://tiles.invalid/{z}/{x}/{y}.png',
        attribution: 'Tiles that do not load',
    },
    none: null,
} satisfies Record<LabSettings['tiles'], MapTiles | null>
