import { useEffect, useRef, useState } from 'react'
import { changedAtEnd, type MapGeometry, type Position } from './geometry'

/**
 * An area's corners while it has fewer than three: not yet an area to send, so the map keeps them until it is. They
 * go when a different value arrives; a form with `onCornersChange` keeps them itself and passes them back.
 */
export const useDraftCorners = (value: MapGeometry | null | undefined) => {
    const [draft, setDraft] = useState<Position[]>()
    // What the map last sent, so the value coming back is not taken for a new one.
    const sentValue = useRef<string>()
    const valueKey = JSON.stringify(value ?? null)
    useEffect(() => {
        if (valueKey !== sentValue.current) setDraft(undefined)
    }, [valueKey])
    return { draft, setDraft, sentValue }
}

/**
 * Whether an area is closed. One that arrives whole is; one being drawn closes when its first corner is clicked, and
 * under three points it is being drawn again. A boundary the map has had closed is closed when it comes back, as by
 * an undo, and so is one that arrives from outside, as by a paste, unless it only gained or lost a point at its end.
 */
export const useClosedArea = (ring: readonly Position[], ringKey: string) => {
    const [closed, setClosed] = useState(ring.length >= 3)
    // The corners the map last sent, so a change it made is not taken for one from outside.
    const sentKey = useRef<string>()
    const closedKeys = useRef(new Set<string>())
    const previousRing = useRef(ring)
    useEffect(() => {
        const before = previousRing.current
        previousRing.current = ring
        if (ring.length < 3) setClosed(false)
        else if (closedKeys.current.has(ringKey)) setClosed(true)
        else if (ringKey !== sentKey.current && !changedAtEnd(before, ring)) {
            setClosed(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ringKey])
    useEffect(() => {
        if (closed && ring.length >= 3) closedKeys.current.add(ringKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [closed, ringKey])
    return { closed, setClosed, sentKey }
}
