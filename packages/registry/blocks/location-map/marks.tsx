import L from 'leaflet'
import { rounded, type Position } from './geometry'

// Maps taken down, which a hot reload can still hand to an effect.
export const GONE = new WeakSet<L.Map>()

export const latLng = ([lng, lat]: readonly number[]) =>
    L.latLng(lat ?? 0, lng ?? 0)
/** Where a click or drag landed, in -180 to 180 even on a copy of the world beside the first. */
export const positionAt = (at: L.LatLng): Position => {
    const wrapped = at.wrap()
    return rounded([wrapped.lng, wrapped.lat])
}

// Drawn here, so no image has to be found by the bundler or fetched on a poor connection.
export const PIN = L.divIcon({
    className: '',
    iconSize: [0, 0],
    html: '<span class="location-pin"><svg viewBox="0 0 24 31" aria-hidden="true"><path d="M12 1C5.9 1 1 5.8 1 11.8 1 19.6 12 30 12 30s11-10.4 11-18.2C23 5.8 18.1 1 12 1Z" fill="currentColor" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="3.6" fill="#fff"/></svg></span>',
})

export const handleIcon = (number: number) =>
    L.divIcon({
        className: '',
        iconSize: [0, 0],
        html: `<span class="location-handle"><span><b>${number}</b></span></span>`,
    })

export const MIDPOINT = L.divIcon({
    className: '',
    iconSize: [0, 0],
    html: '<span class="location-midpoint"><span></span></span>',
})

const STEPS = new Map<string, readonly [number, number]>([
    ['ArrowUp', [0, -1]],
    ['ArrowDown', [0, 1]],
    ['ArrowLeft', [-1, 0]],
    ['ArrowRight', [1, 0]],
])

export const reducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Where a marker moved by an arrow key lands: 8 px a press, 40 with Shift. */
export const nudged = (map: L.Map, from: L.LatLng, event: KeyboardEvent) => {
    const step = STEPS.get(event.key)
    if (step === undefined) return undefined
    const size = event.shiftKey ? 40 : 8
    return map.containerPointToLatLng(
        map.latLngToContainerPoint(from).add([step[0] * size, step[1] * size])
    )
}

/** Shown while the map has keyboard focus: Enter places a point here. */
export const Crosshair = () => (
    <svg className="location-crosshair" viewBox="0 0 22 22" aria-hidden="true">
        <path
            d="M11 1v7M11 14v7M1 11h7M14 11h7"
            stroke="#fff"
            strokeWidth="4"
            strokeLinecap="round"
        />
        <path
            d="M11 1v7M11 14v7M1 11h7M14 11h7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
    </svg>
)
