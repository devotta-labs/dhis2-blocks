import type { MapTiles } from './types'

/** OpenStreetMap's standard tiles: free, no key, attribution required, no bulk or offline use. */
export const OSM_TILES: MapTiles = {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
}
