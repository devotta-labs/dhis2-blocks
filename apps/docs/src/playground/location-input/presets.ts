import type { LabSettings } from './labData'

export const DEFAULT_SETTINGS: LabSettings = {
    view: 'input',
    capture: 'point',
    featureType: 'POINT',
    start: 'empty',
    orgUnit: 'facility',
    check: true,
    readOnly: false,
    search: true,
    tiles: 'osm',
    device: 'walk',
}

export interface Preset {
    group: string
    name: string
    folded?: boolean
    settings: LabSettings
}

const preset = (
    group: string,
    name: string,
    changes: Partial<LabSettings> = {},
    folded = false
): Preset => ({
    group,
    name,
    folded,
    settings: { ...DEFAULT_SETTINGS, ...changes },
})

const edge = (name: string, changes: Partial<LabSettings>) =>
    preset('Location input', name, changes, true)

const AREA = { capture: 'area', orgUnit: 'district' } as const

/** The input's cases, the map on its own, and the event's own location; the cases kept for checking, folded. */
export const PRESETS: readonly Preset[] = [
    preset('Location input', 'Point'),
    preset('Location input', 'Area', AREA),
    preset('Location input', 'Stored point', { start: 'stored' }),
    preset('Location input', 'Stored area', { ...AREA, start: 'stored' }),
    preset('Location map', 'Point map', { view: 'map', start: 'stored' }),
    preset('Location map', 'Area map', {
        view: 'map',
        ...AREA,
        start: 'stored',
    }),
    preset('Event geometry', 'Point stage', { view: 'event' }),
    preset('Event geometry', 'Polygon stage', {
        view: 'event',
        featureType: 'POLYGON',
        orgUnit: 'district',
    }),
    preset('Event geometry', 'Multi-polygon stage', {
        view: 'event',
        featureType: 'MULTI_POLYGON',
        orgUnit: 'district',
        start: 'stored',
    }),
    preset('Event geometry', 'No location', {
        view: 'event',
        featureType: 'NONE',
    }),
    edge('Swapped latitude and longitude', { start: 'far' }),
    edge('Poor signal', { device: 'poor' }),
    edge('Location blocked', { device: 'blocked' }),
    edge('No map background', { start: 'stored', tiles: 'failing' }),
    edge('No search', { search: false }),
    edge('Read-only point', { start: 'stored', readOnly: true }),
    edge('Area with a hole', { ...AREA, start: 'holed' }),
    edge('Read-only area', { ...AREA, start: 'stored', readOnly: true }),
]
