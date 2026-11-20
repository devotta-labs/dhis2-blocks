import { rowHeaderDomId } from '@/components/spreadsheet'

const NO_FRAME_MS = 100

/** When the browser has painted. Tests hold it to control when deferred work runs. */
export const paintClock = {
    /** Calls `next` in a task after the next paint, or after 100 ms when no frame comes; returns how to cancel it. */
    wait(next: () => void) {
        let task: ReturnType<typeof setTimeout> | undefined
        const frame = requestAnimationFrame(() => {
            clearTimeout(fallback)
            task = setTimeout(next)
        })
        const fallback = setTimeout(() => {
            cancelAnimationFrame(frame)
            next()
        }, NO_FRAME_MS)
        return () => {
            cancelAnimationFrame(frame)
            clearTimeout(fallback)
            clearTimeout(task)
        }
    },
}

const waiting = new Set<() => void>()
let cancelWait: (() => void) | undefined

const drain = () => {
    cancelWait = undefined
    for (const work of waiting) {
        waiting.delete(work)
        try {
            work()
        } catch (error) {
            reportError(error)
        }
    }
}

/**
 * Runs `work` in a task after the next paint, so the key or click that asked for it is painted first, after the work
 * asked for before it; returns how to cancel it.
 */
export const afterPaint = (work: () => void) => {
    waiting.add(work)
    cancelWait ??= paintClock.wait(drain)
    return () => {
        waiting.delete(work)
        if (waiting.size === 0) {
            cancelWait?.()
            cancelWait = undefined
        }
    }
}

/** Runs `work` when the browser is idle; returns how to cancel it. */
export const whenIdle = (work: () => void) => {
    if ('requestIdleCallback' in window) {
        const id = requestIdleCallback(work)
        return () => cancelIdleCallback(id)
    }
    const id = setTimeout(work)
    return () => clearTimeout(id)
}

export const soon = (work: () => void) => {
    const id = setTimeout(work)
    return () => clearTimeout(id)
}

/** Runs `work` and records how long it took as the performance measure `name`. */
export const measured = (name: string, work: () => void) => {
    const start = performance.now()
    work()
    performance.measure(name, { start })
}

/** Whether the row's header is in the window: its rows' rules run first. */
export const onScreen = (idScope: string, tableId: string, rowId: string) => {
    const box = document
        .getElementById(rowHeaderDomId(idScope, tableId, rowId))
        ?.getBoundingClientRect()
    return box !== undefined && box.bottom > 0 && box.top < window.innerHeight
}
