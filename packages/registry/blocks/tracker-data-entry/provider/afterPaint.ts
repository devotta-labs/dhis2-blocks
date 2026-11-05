// A hidden page paints no frames; its work waits this long instead.
const NO_FRAME_MS = 100

/** When the browser has painted. Tests hold it to control when deferred work runs. */
export const paintClock = {
    /** Calls `next` in a task after the next paint, or after 100 ms when no frame comes; returns how to cancel it. */
    wait(next: () => void): () => void {
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

// Work waiting for the next paint, run in the order it was asked for.
const waiting = new Set<() => void>()
let cancelWait: (() => void) | undefined

const drain = () => {
    cancelWait = undefined
    // Work added while draining (by the work before it) runs in this drain too.
    for (const work of waiting) {
        waiting.delete(work)
        try {
            work()
        } catch (error) {
            // One failing piece of work never holds back the rest, such as a change on its way to the outbox.
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
