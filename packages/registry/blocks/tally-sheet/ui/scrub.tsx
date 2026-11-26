import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { dhis2PortalRoot } from '@/components/dhis2/ui/portal-root'
import { MAX_COUNT } from '../store/store'
import { formatCount } from './format'

/** How long a press is held before sliding adjusts the count. */
export const HOLD_MS = 300
/** How far the pointer slides for each one added or taken off. */
export const STEP_PX = 12
const SLOP_PX = 8
const ROOM_ABOVE_PX = 40
const BUZZ_MS = 8
const PRESS_PX = 3
const LIFT_PX = 2

interface Press {
    pointer: number
    x: number
    y: number
    mirrored: boolean
    axis: Scrub['axis']
    from: number | undefined
    slid: boolean
    timer: ReturnType<typeof setTimeout> | undefined
}

export interface Scrub {
    /** What sliding would add, less than zero to take off; `undefined` when no slide is under way. */
    delta: number | undefined
    /** Where the button was when sliding began, for the readout. */
    anchor: DOMRect | undefined
    /** The way the slide is going, set by its first step: along the line, or up and down. */
    axis?: 'across' | 'up'
}

const slideOf = (held: Press, from: number, x: number, y: number) => {
    const across = (x - held.x) * (held.mirrored ? -1 : 1)
    const up = held.y - y
    if (
        held.axis === undefined &&
        Math.max(Math.abs(across), Math.abs(up)) >= STEP_PX
    ) {
        held.axis = Math.abs(across) >= Math.abs(up) ? 'across' : 'up'
    }
    if (held.axis === undefined) return 0
    const steps = Math.trunc((held.axis === 'up' ? up : across) / STEP_PX)
    if (steps !== 0) held.slid = true
    return Math.min(MAX_COUNT, Math.max(0, from + steps)) - from
}

const IDLE: Scrub = { delta: undefined, anchor: undefined }

/**
 * Hold, then slide: a press held still, by finger or mouse, turns sliding into adding and taking off, one
 * for each step slid. Letting go hands the difference to `commit`; Escape or a cancelled pointer drops it. A press
 * that never slides is still a tap, however long it is held, and `takeClick` says whether the click after a press
 * was the end of a slide; a key pressed with no press under way forgets a slide whose click never came, so the
 * key's own click still counts. Sliding along the line or upwards adds, and the first step settles which of the two the
 * slide follows, so a count at the edge of the screen still has somewhere to go. In a right-to-left page sliding
 * left adds. The pointer is captured from the press, so a
 * slide that leaves the button still ends on it. The press and the lift move the button by the same few pixels
 * whatever its width, through `--tally-press` and `--tally-lift`. `hold` is the button's ref: it listens for
 * touch moves from the start, since Safari lets only a listener that was there before the touch stop the scroll.
 */
export const useScrub = (count: number, commit: (delta: number) => void) => {
    const press = useRef<Press>()
    const swallowClick = useRef(false)
    const [scrub, setScrub] = useState(IDLE)
    const latest = useRef({ count, commit })
    latest.current = { count, commit }

    const listening = useRef<HTMLElement | null>(null)
    const stopScroll = useCallback((event: TouchEvent) => {
        if (press.current?.from !== undefined) event.preventDefault()
    }, [])
    const hold = useCallback(
        (element: HTMLElement | null) => {
            listening.current?.removeEventListener('touchmove', stopScroll)
            listening.current = element
            element?.addEventListener('touchmove', stopScroll, {
                passive: false,
            })
        },
        [stopScroll]
    )

    const end = useCallback((element: HTMLElement) => {
        const held = press.current
        if (held === undefined) return
        clearTimeout(held.timer)
        if (element.hasPointerCapture(held.pointer)) {
            element.releasePointerCapture(held.pointer)
        }
        press.current = undefined
        setScrub((before) => (before.delta === undefined ? before : IDLE))
    }, [])

    const begin = useCallback((element: HTMLElement) => {
        const held = press.current
        if (held === undefined || held.from !== undefined) return
        clearTimeout(held.timer)
        held.from = latest.current.count
        navigator.vibrate?.(BUZZ_MS)
        setScrub({ delta: 0, anchor: element.getBoundingClientRect() })
    }, [])

    useEffect(
        () => () => {
            clearTimeout(press.current?.timer)
        },
        []
    )

    return {
        scrub,
        hold,
        takeClick: () => {
            const swallowed = swallowClick.current
            swallowClick.current = false
            return swallowed
        },
        handlers: {
            onPointerDown(event: PointerEvent<HTMLButtonElement>) {
                if (event.pointerType === 'mouse' && event.button !== 0) return
                const element = event.currentTarget
                swallowClick.current = false
                const { width } = element.getBoundingClientRect()
                element.style.setProperty(
                    '--tally-press',
                    String(1 - PRESS_PX / Math.max(width, PRESS_PX * 2))
                )
                element.style.setProperty(
                    '--tally-lift',
                    String(1 + LIFT_PX / Math.max(width, LIFT_PX))
                )
                try {
                    element.setPointerCapture(event.pointerId)
                } catch {
                    swallowClick.current = false
                }
                press.current = {
                    pointer: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    mirrored: getComputedStyle(element).direction === 'rtl',
                    axis: undefined,
                    from: undefined,
                    slid: false,
                    timer: setTimeout(() => begin(element), HOLD_MS),
                }
            },
            onPointerMove(event: PointerEvent<HTMLButtonElement>) {
                const held = press.current
                if (held === undefined || event.pointerId !== held.pointer) {
                    return
                }
                const across = event.clientX - held.x
                const down = event.clientY - held.y
                if (held.from === undefined) {
                    if (Math.hypot(across, down) > SLOP_PX) {
                        end(event.currentTarget)
                    }
                    return
                }
                const delta = slideOf(
                    held,
                    held.from,
                    event.clientX,
                    event.clientY
                )
                const { axis } = held
                setScrub((before) =>
                    before.delta === delta && before.axis === axis
                        ? before
                        : { ...before, delta, axis }
                )
            },
            onPointerUp(event: PointerEvent<HTMLButtonElement>) {
                const held = press.current
                if (held === undefined || event.pointerId !== held.pointer) {
                    return
                }
                if (held.from !== undefined) {
                    const delta = slideOf(
                        held,
                        held.from,
                        event.clientX,
                        event.clientY
                    )
                    if (held.slid) {
                        swallowClick.current = true
                        if (delta !== 0) latest.current.commit(delta)
                    }
                }
                end(event.currentTarget)
            },
            onPointerCancel(event: PointerEvent<HTMLButtonElement>) {
                end(event.currentTarget)
            },
            onLostPointerCapture(event: PointerEvent<HTMLButtonElement>) {
                if (press.current?.from !== undefined) end(event.currentTarget)
            },
            onContextMenu(event: { preventDefault(): void }) {
                if (press.current !== undefined) event.preventDefault()
            },
        },
        dropOnEscape(event: KeyboardEvent<HTMLButtonElement>) {
            if (event.key !== 'Escape' || press.current?.from === undefined) {
                if (press.current === undefined) swallowClick.current = false
                return false
            }
            swallowClick.current = true
            end(event.currentTarget)
            return true
        },
    }
}

const signed = (delta: number) =>
    delta < 0 ? `−${formatCount(-delta)}` : `+${formatCount(delta)}`

/**
 * What a slide has added or taken off so far, floating above the cell; nothing until it has changed the count. For
 * the eye only: the new count is announced when the slide is let go.
 */
export const ScrubReadout = ({ scrub }: { scrub: Scrub }) => {
    if (
        scrub.delta === undefined ||
        scrub.delta === 0 ||
        scrub.anchor === undefined
    ) {
        return null
    }
    const above = scrub.anchor.top > ROOM_ABOVE_PX
    return createPortal(
        <div
            aria-hidden="true"
            data-slot="tally-scrub-readout"
            className={`pointer-events-none fixed z-50 -translate-x-1/2 rounded-dhis2-md bg-dhis2-popover px-2 py-0.5 text-sm font-medium text-dhis2-muted-foreground tabular-nums shadow-dhis2-popover transition-[opacity,scale] duration-150 ease-out motion-reduce:transition-none starting:scale-95 starting:opacity-0 ${above ? 'origin-bottom -translate-y-full' : 'origin-top'}`}
            style={{
                left: scrub.anchor.left + scrub.anchor.width / 2,
                top: above ? scrub.anchor.top - 6 : scrub.anchor.bottom + 6,
            }}
        >
            {signed(scrub.delta)}
        </div>,
        dhis2PortalRoot() ?? document.body
    )
}
