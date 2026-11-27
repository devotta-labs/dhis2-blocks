import type { Locator } from '@/components/location-input'
import { WALK, type LabSettings } from './labData'

// SAFETY: the fields read only `code` and compare it with the three constants beside it.
const DENIED = {
    code: 1,
    message: 'User denied Geolocation',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
} as GeolocationPositionError

/** How long the simulated walker takes between two stops of the route. */
const LEG_MS = 8000
/** How often a watched position is reported. */
const TICK_MS = 700
/** A fix settling as a phone's does: coarse at first, then close. */
const SETTLING_M = [48, 31, 18, 11, 7, 5]

const fix = (longitude: number, latitude: number, accuracy: number) =>
    // SAFETY: the fields read only `coords.longitude`, `latitude` and `accuracy`, and `timestamp`.
    ({
        timestamp: Date.now(),
        coords: { longitude, latitude, accuracy },
    }) as GeolocationPosition

/** Where the walker is `elapsed` milliseconds into the route, which loops. */
const walked = (elapsed: number): [number, number] => {
    const legs = elapsed / LEG_MS
    const from = WALK[Math.floor(legs) % WALK.length] ?? [0, 0]
    const to = WALK[(Math.floor(legs) + 1) % WALK.length] ?? from
    const along = legs % 1
    return [
        from[0] + (to[0] - from[0]) * along,
        from[1] + (to[1] - from[1]) * along,
    ]
}

/**
 * The device the fields ask for a location.
 *
 * `walk`: `getCurrentPosition` answers after a moment with the next stop of a route round a field, so a boundary can
 * be walked at a desk by pressing a button. `watchPosition` reports every 700 ms someone walking the same route, a
 * stop every 8 seconds, with an accuracy that settles from 48 m to 5 m and wobbles a little.
 * `poor`: the same, but the accuracy never gets better than about 60 m.
 * `blocked`: refuses, as a browser with the permission denied does.
 */
export const deviceFor = (device: LabSettings['device']): Locator => {
    if (device === 'real') return navigator.geolocation
    let stop = 0
    const watches = new Map<number, ReturnType<typeof setInterval>>()
    let nextWatch = 1
    // One walk for the device's life: a second watch carries on from where the walker is.
    let setOut: number | undefined
    const accuracyAt = (tick: number) => {
        const settled =
            device === 'poor'
                ? 60
                : (SETTLING_M[Math.min(tick, SETTLING_M.length - 1)] ?? 5)
        // A wobble that repeats, so a run looks the same every time.
        return (
            Math.round((settled + Math.sin(tick * 1.7) * settled * 0.12) * 10) /
            10
        )
    }
    return {
        getCurrentPosition: (found, refused) => {
            setTimeout(() => {
                if (device === 'blocked') {
                    refused?.(DENIED)
                    return
                }
                const [longitude, latitude] = WALK[stop % WALK.length] ?? [0, 0]
                stop += 1
                found(fix(longitude, latitude, device === 'poor' ? 60 : 6))
            }, 600)
        },
        watchPosition: (found, refused) => {
            const id = nextWatch
            nextWatch += 1
            setOut ??= Date.now()
            const started = setOut
            let tick = 0
            watches.set(
                id,
                setInterval(() => {
                    if (device === 'blocked') {
                        refused?.(DENIED)
                        return
                    }
                    const [longitude, latitude] = walked(Date.now() - started)
                    found(fix(longitude, latitude, accuracyAt(tick)))
                    tick += 1
                }, TICK_MS)
            )
            return id
        },
        clearWatch: (id) => {
            clearInterval(watches.get(id))
            watches.delete(id)
        },
    }
}
