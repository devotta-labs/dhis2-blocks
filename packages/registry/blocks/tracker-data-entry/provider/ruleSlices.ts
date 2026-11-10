import type {
    EventsRules,
    EventsRulesEvaluation,
} from '@/components/program-rules'
import { recordsOf } from '../model/types'
import { measured, onScreen, soon, whenIdle } from './afterPaint'
import type { FormTables } from './openForm'

// Loading evaluates rows for about this long at once (a row at least), then for about a frame's time whenever the
// browser is idle, so it never blocks the page for long.
const FIRST_SLICE_MS = 100
const IDLE_SLICE_MS = 16
// Where the rules run in a worker, loading asks it for this many rows at a time, and it answers with those it got to
// in the first slice's time: the main thread only applies what they say.
const WORKER_ROWS = 50

interface SliceOptions {
    tables: FormTables['tables']
    /** Rows evaluated at least once: they run after the rows not evaluated yet. */
    seen: ReadonlySet<string>
    /** Starts the form's DOM ids. */
    idScope: string
    /**
     * Runs the rows' rules until `until` (a `performance.now()` time) passes, a row at least, and applies what they
     * say; a row in `known`, what the worker evaluated, is not evaluated again. Returns the rows it did not get to.
     */
    run(
        rowIds: ReadonlyArray<string>,
        until?: number,
        known?: EventsRulesEvaluation
    ): string[]
    /** The rules' `evaluateInBackground` on the rows as they are now, for the time given. */
    ask(
        rowIds: ReadonlyArray<string>,
        forMs: number
    ): ReturnType<NonNullable<EventsRules['evaluateInBackground']>>
    /** Starts noting the rows that change while the worker has them; the function returned stops, and says which. */
    watch(): () => ReadonlySet<string>
}

/**
 * Runs every row's rules once: the rows in view first for a slice of time, the rest in short slices when idle, or in a
 * worker where the rules have one, which leaves the main thread to apply what they say. Returns how to stop, and
 * whether a row still waits for its turn.
 */
export const runInSlices = ({
    tables,
    seen,
    idScope,
    run,
    ask,
    watch,
}: SliceOptions) => {
    let stopped = false
    // The records of the visible rows first, then the rest, in their rows' order. Rows evaluated before a reconnection
    // show their effects meanwhile: they run again after the rows not evaluated yet, in view and off screen alike, as
    // the people the rules have now can change them.
    const order = tables.flatMap(({ id: tableId, rows }) =>
        rows.flatMap((row) => {
            const visible = onScreen(idScope, tableId, row.id)
            return recordsOf(row).map((id) => ({ id, visible }))
        })
    )
    const ids = (keep: (entry: (typeof order)[number]) => boolean) =>
        order.filter(keep).map(({ id }) => id)
    const later = [
        ...ids(({ id, visible }) => !visible && !seen.has(id)),
        ...ids(({ id, visible }) => !visible && seen.has(id)),
    ]
    let rest = [
        ...ids(({ id, visible }) => visible && !seen.has(id)),
        ...ids(({ id, visible }) => visible && seen.has(id)),
        ...later,
    ]
    const start = performance.now()
    let inView = true
    const took = (left: string[]) => {
        rest = left
        // The rows in view are done, however many slices they took.
        if (inView && rest.length <= later.length) {
            inView = false
            performance.measure('data-entry:rules-visible', { start })
        }
    }
    const slice = (ms: number) => took(run(rest, performance.now() + ms))
    measured('data-entry:rules', () => slice(FIRST_SLICE_MS))
    let cancel = () => {}
    // Rows still in view take short slices one after another; the rest wait for idle time.
    const schedule = () => (inView ? soon : whenIdle)(nextSlice)
    /**
     * Asks the worker for the next rows and applies what it says when it answers, then asks again. False where no
     * worker is ready: the rows run here.
     */
    const askWorker = () => {
        const rowIds = rest.slice(0, WORKER_ROWS)
        const answer = ask(rowIds, FIRST_SLICE_MS)
        if (answer === undefined) {
            return false
        }
        const changed = watch()
        void answer.then((reply) => {
            const stale = changed()
            if (stopped) {
                return
            }
            if (reply !== undefined) {
                const { effects, failures } = reply.evaluation
                // A row that changed meanwhile runs here, on what it holds now.
                for (const rowId of stale) {
                    effects.delete(rowId)
                    failures.delete(rowId)
                }
                run(rowIds.slice(0, reply.done), Infinity, reply.evaluation)
                took(rest.slice(reply.done))
            }
            // A worker that failed leaves the rows to the slices here.
            if (rest.length > 0 && !askWorker()) {
                cancel = schedule()
            }
        })
        return true
    }
    const nextSlice = () => {
        if (!stopped && rest.length > 0 && !askWorker()) {
            slice(IDLE_SLICE_MS)
            cancel = schedule()
        }
    }
    cancel = schedule()
    return {
        stop: () => {
            stopped = true
            cancel()
        },
        waiting: (rowId: string) => rest.includes(rowId),
    }
}
