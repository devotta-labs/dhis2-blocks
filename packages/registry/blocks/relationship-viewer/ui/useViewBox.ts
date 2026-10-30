import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
} from 'react'
import type { Bounds } from '../layout/web'

const PADDING = 24
const MIN_ZOOM = 0.2
const MAX_ZOOM = 5
const WHEEL_STEP = 1.1
// A pointer that moves further than this between down and up is a pan, not a click.
const CLICK_SLOP = 3

interface Box {
    x: number
    y: number
    width: number
    height: number
}

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value))

/**
 * Fits `bounds` with padding; wheel zooms on the pointer, dragging pans, `fit` resets.
 * A zoom or pan holds until `scene` changes, so redrawing the same scene (a stack opening, a resize) keeps the view.
 */
export function useViewBox<Scene>(
    { minX, minY, maxX, maxY }: Bounds,
    scene: Scene
) {
    // A callback ref, so the wheel listener follows the svg as it mounts and unmounts.
    const [svg, ref] = useState<SVGSVGElement | null>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })
    // Measured before paint, so the first frame is already the fitted view.
    useLayoutEffect(() => {
        if (!svg) return undefined
        const measure = () =>
            setSize({ width: svg.clientWidth, height: svg.clientHeight })
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(svg)
        return () => observer.disconnect()
    }, [svg])

    // Keyed on the numbers, so an equal bounds object keeps the current zoom and pan.
    const fitted = useMemo<Box>(() => {
        const width = maxX - minX + 2 * PADDING
        const height = maxY - minY + 2 * PADDING
        // Never enlarge past the drawn size: a small graph sits at 1:1, centred.
        const boxWidth = Math.max(width, size.width)
        const boxHeight = Math.max(height, size.height)
        return {
            x: minX - PADDING - (boxWidth - width) / 2,
            y: minY - PADDING - (boxHeight - height) / 2,
            width: boxWidth,
            height: boxHeight,
        }
    }, [minX, minY, maxX, maxY, size.width, size.height])
    // Undefined box: follow the fit.
    const [view, setView] = useState<{ scene: Scene; box?: Box }>({ scene })
    const box = (view.scene === scene && view.box) || fitted

    // What was last painted. Once a scene is on screen, a new drawing in it (an expand, a stack opening) keeps that
    // view instead of refitting; a new scene, a resize or Fit refits.
    const painted = useRef<{ scene: Scene; box: Box }>()
    useEffect(() => {
        painted.current = { scene, box }
    })
    useLayoutEffect(() => {
        const last = painted.current
        if (last?.scene === scene && !(view.scene === scene && view.box)) {
            setView({ scene, box: last.box })
        }
        // Only a new drawing holds the view: not the view's own changes, and not a resize.
    }, [minX, minY, maxX, maxY])

    const drag = useRef<{
        startX: number
        startY: number
        x: number
        y: number
    }>()
    const panned = useRef(false)

    useEffect(() => {
        if (!svg) return undefined
        // React's wheel listener is passive, so it cannot stop the page scrolling.
        const onWheel = (event: WheelEvent) => {
            const matrix = svg.getScreenCTM()
            if (!matrix) return
            event.preventDefault()
            const point = new DOMPoint(
                event.clientX,
                event.clientY
            ).matrixTransform(matrix.inverse())
            setView((current) => {
                const from = (current.scene === scene && current.box) || fitted
                const width = clamp(
                    from.width *
                        (event.deltaY > 0 ? WHEEL_STEP : 1 / WHEEL_STEP),
                    fitted.width / MAX_ZOOM,
                    fitted.width / MIN_ZOOM
                )
                const k = width / from.width
                return {
                    scene,
                    box: {
                        x: point.x - (point.x - from.x) * k,
                        y: point.y - (point.y - from.y) * k,
                        width,
                        height: from.height * k,
                    },
                }
            })
        }
        svg.addEventListener('wheel', onWheel, { passive: false })
        return () => svg.removeEventListener('wheel', onWheel)
    }, [svg, fitted, scene])

    const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
        const { clientX: x, clientY: y } = event
        drag.current = { startX: x, startY: y, x, y }
        panned.current = false
    }
    const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
        const last = drag.current
        const scale = svg?.getScreenCTM()?.a
        if (!last || !scale || event.buttons !== 1) return
        const { clientX: x, clientY: y } = event
        if (
            !panned.current &&
            Math.hypot(x - last.startX, y - last.startY) <= CLICK_SLOP
        ) {
            return
        }
        panned.current = true
        drag.current = { ...last, x, y }
        const dx = (x - last.x) / scale
        const dy = (y - last.y) / scale
        setView((current) => {
            const from = (current.scene === scene && current.box) || fitted
            return {
                scene,
                box: { ...from, x: from.x - dx, y: from.y - dy },
            }
        })
    }
    const onPointerEnd = () => {
        drag.current = undefined
    }
    // A pan ends over whatever was grabbed; swallow that click so it does not select, expand or retry.
    const onClickCapture = (event: ReactMouseEvent<SVGSVGElement>) => {
        if (!panned.current) return
        panned.current = false
        event.stopPropagation()
    }

    return {
        ref,
        viewBox: `${box.x} ${box.y} ${box.width} ${box.height}`,
        fit: () => setView({ scene }),
        /** Moves the view by (dx, dy), so a point that moved by that much stays put on screen. */
        shift: (dx: number, dy: number) =>
            setView((current) => {
                const from = (current.scene === scene && current.box) || fitted
                return {
                    scene,
                    box: { ...from, x: from.x + dx, y: from.y + dy },
                }
            }),
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp: onPointerEnd,
            onPointerLeave: onPointerEnd,
            onClickCapture,
        },
    }
}
