import {
    useEffect,
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

/** Fits `bounds` with padding; wheel zooms on the pointer, dragging pans, `fit` resets. */
export function useViewBox({ minX, minY, maxX, maxY }: Bounds) {
    // Keyed on the numbers, so an equal bounds object keeps the current zoom and pan.
    const fitted = useMemo<Box>(
        () => ({
            x: minX - PADDING,
            y: minY - PADDING,
            width: maxX - minX + 2 * PADDING,
            height: maxY - minY + 2 * PADDING,
        }),
        [minX, minY, maxX, maxY]
    )
    // The view belongs to one fit; new bounds start from their own fit.
    const [view, setView] = useState({ fitted, box: fitted })
    const box = view.fitted === fitted ? view.box : fitted

    // A callback ref, so the wheel listener follows the svg as it mounts and unmounts.
    const [svg, ref] = useState<SVGSVGElement | null>(null)
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
                const from = current.fitted === fitted ? current.box : fitted
                const width = clamp(
                    from.width *
                        (event.deltaY > 0 ? WHEEL_STEP : 1 / WHEEL_STEP),
                    fitted.width / MAX_ZOOM,
                    fitted.width / MIN_ZOOM
                )
                const k = width / from.width
                return {
                    fitted,
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
    }, [svg, fitted])

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
            const from = current.fitted === fitted ? current.box : fitted
            return {
                fitted,
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
        fit: () => setView({ fitted, box: fitted }),
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp: onPointerEnd,
            onPointerLeave: onPointerEnd,
            onClickCapture,
        },
    }
}
