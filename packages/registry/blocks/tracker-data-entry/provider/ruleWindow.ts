import type { StoreApi } from 'zustand/vanilla'
import type { DrawnRows } from '@/components/spreadsheet'
import { recordsOf } from '../model/types'
import type { TrackerRow } from '../model/types'
import { afterPaint, measured, onScreen, soon, whenIdle } from './afterPaint'

// Loading evaluates rows for about this long at once (a row at least), then for about a frame's time whenever the
// browser is idle, so it never blocks the page for long.
const FIRST_SLICE_MS = 100
const IDLE_SLICE_MS = 16

type Tables = ReadonlyArray<{ id: string; rows: ReadonlyArray<TrackerRow> }>

/** Where the grid says which rows it draws. */
export type Drawn = Pick<StoreApi<DrawnRows>, 'getState' | 'subscribe'>

/**
 * Reads the records of the rows the grid draws now, those in or near the view. Nothing while no grid draws the form:
 * it then has no window, and no row waits to enter one.
 */
const drawnRecordsOf = (drawn: Drawn | undefined) => {
    let indexed:
        | { tables: Tables; rows: Map<string, Map<string, TrackerRow>> }
        | undefined
    return (tables: Tables): ReadonlySet<string> | undefined => {
        const ids = drawn?.getState().rows
        if (ids === undefined || ids.size === 0) {
            return undefined
        }
        if (indexed?.tables !== tables) {
            indexed = {
                tables,
                rows: new Map(
                    tables.map(({ id, rows }) => [
                        id,
                        new Map(rows.map((row) => [row.id, row])),
                    ])
                ),
            }
        }
        const { rows } = indexed
        return new Set(
            [...ids].flatMap(([tableId, rowIds]) =>
                rowIds.flatMap((rowId) => {
                    const row = rows.get(tableId)?.get(rowId)
                    return row === undefined ? [] : recordsOf(row)
                })
            )
        )
    }
}

/**
 * The records whose rules wait behind those of the rows the grid draws: those outside the rows it draws now that
 * `held` does not keep, as the rules ran for them before or a person changed them. They run once the grid draws their
 * row, or when nothing else is left to run. While no grid draws the form, no more wait.
 */
export const ruleWindow = (
    drawn: Drawn | undefined,
    tables: () => Tables,
    held: (recordId: string) => boolean
) => {
    const drawnNow = drawnRecordsOf(drawn)
    const waiting = new Set<string>()
    // Those that came since the last paint: a row a person adds is drawn at once, and shows what its rules say with it.
    const added = new Set<string>()
    return {
        /** The records of `recordIds` that do not wait; the others wait from now on, those `isNew` as just added. */
        park(
            recordIds: ReadonlyArray<string>,
            isNew?: (recordId: string) => boolean
        ) {
            const window = drawnNow(tables())
            if (window === undefined) {
                return recordIds
            }
            const stay = recordIds.filter((id) => window.has(id) || held(id))
            if (stay.length === recordIds.length) {
                return recordIds
            }
            for (const id of recordIds) {
                if (!window.has(id) && !held(id)) {
                    waiting.add(id)
                    if (isNew?.(id) === true) {
                        added.add(id)
                    }
                }
            }
            if (added.size > 0) {
                afterPaint(() => added.clear())
            }
            return stay
        },
        /** The record's rules ran: it waits no more. */
        evaluated(recordId: string) {
            waiting.delete(recordId)
        },
        /** The records still waiting, in the order they began to. */
        left: (): ReadonlyArray<string> => [...waiting],
        isEmpty: () => waiting.size === 0,
        /** The waiting records the grid draws now, which wait no more: `now` those just added, `idle` the others. */
        entered() {
            const window = drawnNow(tables())
            const ids = [...waiting].filter((id) => window?.has(id) === true)
            ids.forEach((id) => waiting.delete(id))
            const now = ids.filter((id) => added.has(id))
            const idle = ids.filter((id) => !added.has(id))
            added.clear()
            return { now, idle }
        },
    }
}

interface QueueOptions {
    tables: { getState(): { tables: Tables } }
    /** Starts the form's DOM ids. */
    idScope: string
    /** Rows evaluated at least once. */
    seen: ReadonlySet<string>
    lazy: ReturnType<typeof ruleWindow>
    /** Runs the rules of the records until `until` passes, a record at least; returns those it did not get to. */
    run(recordIds: ReadonlyArray<string>, until: number): ReadonlyArray<string>
}

/**
 * The records whose rules are yet to run, in slices of time: the visible rows' first, one slice after another, then
 * the rest when idle, in their rows' order: those the grid draws, then the others, so a row scrolled to never waits
 * behind one out of sight. Rows evaluated before a reconnection show their effects meanwhile: they run again after
 * the rows not evaluated yet, in view and off screen alike, as the people the rules have now can change them.
 */
export const ruleQueue = ({
    tables,
    idScope,
    seen,
    lazy,
    run,
}: QueueOptions) => {
    let stopped = false
    const order = tables.getState().tables.flatMap(({ id: tableId, rows }) =>
        rows.flatMap((row) => {
            const visible = onScreen(idScope, tableId, row.id)
            return recordsOf(row).map((id) => ({ id, visible }))
        })
    )
    const ids = (keep: (entry: (typeof order)[number]) => boolean) =>
        order.filter(keep).map(({ id }) => id)
    // In view when the rules connected, or added and drawn since: these do not wait for idle time.
    const first = new Set(ids(({ visible }) => visible))
    let rest: ReadonlyArray<string> = [
        ...ids(({ id, visible }) => visible && !seen.has(id)),
        ...ids(({ id, visible }) => visible && seen.has(id)),
        ...ids(({ id, visible }) => !visible && !seen.has(id)),
        ...ids(({ id, visible }) => !visible && seen.has(id)),
    ]
    const start = performance.now()
    let inView = true
    const slice = (ms: number) => {
        // A row the grid does not draw, or no longer, waits until it does, or until the drawn ones are done.
        rest = run(lazy.park(rest), performance.now() + ms)
        // The rows in view are done, however many slices they took.
        if (inView && !first.has(rest[0])) {
            inView = false
            performance.measure('data-entry:rules-visible', { start })
        }
    }
    // The rows out of sight, once no drawn row is left: every row's messages are known soon after the form opens.
    const sliceOfWaiting = (ms: number) => {
        const ids = lazy.left()
        const left = run(ids, performance.now() + ms)
        // One the rules did not answer for had its turn too.
        ids.slice(0, ids.length - left.length).forEach(lazy.evaluated)
    }
    let cancel: (() => void) | undefined
    // Rows still in view take short slices one after another; the rest wait for idle time.
    const schedule = () => {
        if (!stopped && (rest.length > 0 || !lazy.isEmpty())) {
            cancel ??= (inView ? soon : whenIdle)(nextSlice)
        }
    }
    const nextSlice = () => {
        cancel = undefined
        if (stopped) {
            return
        }
        if (rest.length > 0) {
            slice(IDLE_SLICE_MS)
        } else {
            sliceOfWaiting(IDLE_SLICE_MS)
        }
        schedule()
    }
    return {
        start() {
            measured('data-entry:rules', () => slice(FIRST_SLICE_MS))
            schedule()
        },
        /** Whether the record's rules are yet to run. */
        has: (recordId: string) => rest.includes(recordId),
        /** Records began to wait: they get their turn. */
        schedule,
        /**
         * The grid draws other rows: those that waited for it run when idle; a row just added, before the next paint,
         * so its rule effects never go missing for a frame.
         */
        drawn() {
            const { now, idle } = lazy.entered()
            now.forEach((id) => first.add(id))
            rest = [...now, ...rest, ...idle]
            if (now.length > 0) {
                queueMicrotask(() => {
                    if (!stopped) {
                        slice(FIRST_SLICE_MS)
                    }
                })
            }
            schedule()
        },
        stop() {
            stopped = true
            cancel?.()
        },
    }
}
