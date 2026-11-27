import i18n from '@dhis2/d2-i18n'
import { useEffect, useRef, useState } from 'react'
import {
    formatDistance,
    rounded,
    type Position,
} from '@/components/location-map'
import { accuracyBand } from './text'
import type { Locator } from './types'

/** One position from the device, and how far off it may be: a 68% radius, in metres. */
export interface Fix {
    position: Position
    accuracyM: number
}

/** Stop as soon as a fix is this good. */
const GOOD_M = 10
/** Then take the best fix so far, if there is one. */
const SETTLE_MS = 10_000

const OPTIONS: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 30_000,
    maximumAge: 0,
}

const fixOf = ({ coords }: GeolocationPosition): Fix => ({
    position: rounded([coords.longitude, coords.latitude]),
    accuracyM: coords.accuracy,
})

/** A fix's accuracy in words, never colour alone: "Within 6 m, good". */
export const accuracyWords = (accuracyM: number) => {
    const quality = new Map([
        ['good', i18n.t('good')],
        ['fair', i18n.t('fair')],
        ['poor', i18n.t('poor')],
    ]).get(accuracyBand(accuracyM))
    return i18n.t('Within {{distance}}, {{quality}}', {
        distance: formatDistance(accuracyM / 1000),
        quality: quality ?? '',
    })
}

/** Why the device gave no location, and what to do instead. */
const refusal = (error: GeolocationPositionError) => {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return i18n.t(
                'Location is blocked for this site. Allow it in the browser’s site settings, or type the coordinates.'
            )
        case error.TIMEOUT:
            return i18n.t(
                'Finding your location took too long. Try again, or type the coordinates.'
            )
        default:
            return i18n.t(
                'Your device could not find your location. Try again, or type the coordinates.'
            )
    }
}

/** The location button's name: `idle` until pressed, then what a second press does. */
export const locateLabel = (
    { finding, accuracyM }: { finding: boolean; accuracyM?: number },
    idle: string
) => {
    if (!finding) return idle
    return accuracyM === undefined
        ? i18n.t('Stop finding your location')
        : i18n.t('Use the location found so far')
}

interface Watch {
    /** Absent until the device has said which watch this is. */
    id?: number
    timer?: ReturnType<typeof setTimeout>
    best?: Fix
    /** The wait ran out before any fix came: the first to come is taken. */
    late?: boolean
    found: (fix: Fix) => void
}

/**
 * The device's location, watched until a fix is within 10 m or for 10 seconds, keeping the best one: the browser's
 * first answer is often a coarse one from Wi-Fi. While finding, `accuracyM` is the best so far; `finish` takes it, or
 * stops asking when there is none yet, as while the browser waits for the user to allow it.
 */
export const useFix = (locator: Locator | undefined) => {
    const [finding, setFinding] = useState(false)
    const [accuracyM, setAccuracyM] = useState<number>()
    const watch = useRef<Watch>()
    const device = () =>
        locator ??
        ('geolocation' in navigator ? navigator.geolocation : undefined)

    const stop = () => {
        const now = watch.current
        if (now === undefined) return
        if (now.id !== undefined) device()?.clearWatch(now.id)
        clearTimeout(now.timer)
        watch.current = undefined
        setFinding(false)
        setAccuracyM(undefined)
    }

    /** Takes the best fix so far, if there is one, and stops. */
    const settle = () => {
        const now = watch.current
        if (now?.best === undefined) return
        stop()
        now.found(now.best)
    }

    /** Takes the best fix so far, or stops asking when there is none. */
    const finish = () => {
        if (watch.current?.best === undefined) stop()
        else settle()
    }

    const find = (
        found: (fix: Fix) => void,
        refused: (text: string) => void
    ) => {
        stop()
        const locating = device()
        if (locating === undefined) {
            refused(
                i18n.t(
                    'This browser cannot give your location. Type the coordinates.'
                )
            )
            return
        }
        // Set before asking, so an answer given at once is not lost, and an answer to an ask since stopped is ignored.
        const asking: Watch = { found }
        watch.current = asking
        setFinding(true)
        const id = locating.watchPosition(
            (reported) => {
                if (watch.current !== asking) return
                const fix = fixOf(reported)
                if (
                    asking.best === undefined ||
                    fix.accuracyM <= asking.best.accuracyM
                ) {
                    asking.best = fix
                    setAccuracyM(fix.accuracyM)
                }
                if (fix.accuracyM <= GOOD_M || asking.late) settle()
            },
            (error) => {
                if (watch.current !== asking) return
                if (asking.best !== undefined) {
                    settle()
                    return
                }
                stop()
                refused(refusal(error))
            },
            OPTIONS
        )
        if (watch.current !== asking) {
            // Already answered and stopped.
            locating.clearWatch(id)
            return
        }
        asking.id = id
        asking.timer = setTimeout(() => {
            if (asking.best === undefined) asking.late = true
            else settle()
        }, SETTLE_MS)
    }

    // A field taken off the page stops asking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => () => stop(), [])

    return { finding, accuracyM, find, finish }
}
