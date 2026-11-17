/** What the page records about itself, read by the runner through `window.__perf`. */
type PagePerf = {
    longTasks: Array<{ start: number; duration: number }>
    /** Each key, click and paste: when the browser made the event, and when the frame after it was drawn. */
    inputs: Array<{ type: string; key: string; at: number; painted: number }>
    /** Each run of the rules an edit started, and when the frame showing what they did was drawn. */
    ruleRuns: Array<{ start: number; duration: number; painted: number }>
    largestPaint: number
    layoutShift: number
    /** Resolves once the next frame is drawn. */
    nextFrame: () => Promise<number>
    /** Scrolls the grid `step` pixels a frame for `frames` frames; resolves to the time each frame took. */
    scroll: (axis: 'x' | 'y', step: number, frames: number) => Promise<number[]>
    paste: (text: string) => void
    /** Resolves once the table has more rows than now and they are drawn. */
    rowsGrew: () => Promise<number>
}

declare global {
    interface Window {
        __perf: PagePerf
    }
}

/** Runs in the page before any of its scripts. It only observes: nothing here changes what the grid does. */
export const install = () => {
    // A message posted from an animation frame arrives once that frame is drawn.
    const afterFrame = (done: (at: number) => void) => {
        requestAnimationFrame(() => {
            const { port1, port2 } = new MessageChannel()
            port1.onmessage = () => done(performance.now())
            port2.postMessage(0)
        })
    }
    const perf: PagePerf = {
        longTasks: [],
        inputs: [],
        ruleRuns: [],
        largestPaint: 0,
        layoutShift: 0,
        nextFrame: () => new Promise((resolve) => afterFrame(resolve)),
        scroll: (axis, step, frames) =>
            new Promise((resolve) => {
                const region = document.querySelector('table')?.parentElement
                const took: number[] = []
                let last = 0
                const tick = (now: number) => {
                    if (last > 0) {
                        took.push(now - last)
                    }
                    last = now
                    if (region === null || region === undefined) {
                        resolve([])
                        return
                    }
                    if (took.length >= frames) {
                        resolve(took)
                        return
                    }
                    if (axis === 'y') {
                        region.scrollTop += step
                    } else {
                        region.scrollLeft += step
                    }
                    requestAnimationFrame(tick)
                }
                requestAnimationFrame(tick)
            }),
        paste: (text) => {
            const clipboardData = new DataTransfer()
            clipboardData.setData('text/plain', text)
            document.activeElement?.dispatchEvent(
                new ClipboardEvent('paste', {
                    clipboardData,
                    bubbles: true,
                    cancelable: true,
                })
            )
        },
        rowsGrew: () =>
            new Promise((resolve) => {
                const table = document.querySelector('table')
                const before = table?.getAttribute('aria-rowcount')
                if (table === null) {
                    resolve(0)
                    return
                }
                const observer = new MutationObserver(() => {
                    if (table.getAttribute('aria-rowcount') !== before) {
                        observer.disconnect()
                        afterFrame(resolve)
                    }
                })
                observer.observe(table, { attributeFilter: ['aria-rowcount'] })
            }),
    }
    window.__perf = perf
    const observe = (type: string, each: (entry: PerformanceEntry) => void) => {
        new PerformanceObserver((list) =>
            list.getEntries().forEach(each)
        ).observe({ type, buffered: true })
    }
    observe('longtask', ({ startTime, duration }) => {
        perf.longTasks.push({ start: startTime, duration })
    })
    observe('measure', ({ name, startTime, duration }) => {
        if (name === 'data-entry:rules-edit') {
            const run = { start: startTime, duration, painted: 0 }
            perf.ruleRuns.push(run)
            afterFrame((at) => {
                run.painted = at
            })
        }
    })
    observe('largest-contentful-paint', ({ startTime }) => {
        perf.largestPaint = startTime
    })
    observe('layout-shift', (entry) => {
        // SAFETY: layout-shift entries are LayoutShift, which TypeScript's DOM types do not have yet.
        const shift = entry as PerformanceEntry & {
            value: number
            hadRecentInput: boolean
        }
        if (!shift.hadRecentInput) {
            perf.layoutShift += shift.value
        }
    })
    for (const type of ['keydown', 'click', 'paste']) {
        window.addEventListener(
            type,
            (event) => {
                const input = {
                    type,
                    key: event instanceof KeyboardEvent ? event.key : '',
                    at: event.timeStamp,
                    painted: 0,
                }
                perf.inputs.push(input)
                afterFrame((at) => {
                    input.painted = at
                })
            },
            { capture: true }
        )
    }
}
