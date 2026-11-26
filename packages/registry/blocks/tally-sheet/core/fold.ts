import type { TallyIndex } from './layout'
import type { TallyEntry } from './types'

interface Placed {
    id: string
    cell: number
    delta: number
    instant: number
}

interface Batch {
    key: string
    by: string | undefined
    ids: string[]
    instant: number
    latestId: string
}

const instantOf = (at: string) => {
    const instant = Date.parse(at)
    return Number.isNaN(instant) ? 0 : instant
}

const earlier = (
    a: { instant: number; id: string },
    b: { instant: number; id: string }
) => a.instant < b.instant || (a.instant === b.instant && a.id < b.id)

/**
 * A session's counts, kept as entries arrive. A cell's count is its entries taken in the order they were made, by
 * time and then id, each added to the count and the count never falling below zero: a correction that takes off more
 * than is there takes off what is there, and a tap made after it still counts. The order comes from the entries, not
 * from when they arrive, so each entry is counted once however often it is given and joined logs add up the same on
 * every device, an undo that arrives before its entry included. Entries for a row or options the layout does not have
 * are `unplaced`: counted nowhere. `latest` is what the next undo takes back: the action made last with something
 * left, of the device `by` names when it names one. `touched` says whether a cell has ever been given an entry.
 */
export const createFold = (index: TallyIndex) => {
    const counts = Array.from({ length: index.size }, () => 0)
    const live: Placed[][] = Array.from({ length: index.size }, () => [])
    const touched = new Set<number>()
    const rowTotals = index.rows.map(() => 0)
    const seen = new Set<string>()
    const placed = new Map<string, Placed>()
    const undone = new Set<string>()
    const batchAt = new Map<string, Batch>()
    let total = 0
    let unplaced = 0

    const stack = () => {
        const batches: Batch[] = []
        let inOrder = true
        return {
            push(batch: Batch) {
                const last = batches.at(-1)
                if (last && !earlier(orderOf(last), orderOf(batch))) {
                    inOrder = false
                }
                batches.push(batch)
            },
            moved() {
                inOrder = false
            },
            latest() {
                if (!inOrder) {
                    batches.sort((a, b) =>
                        earlier(orderOf(a), orderOf(b)) ? -1 : 1
                    )
                    inOrder = true
                }
                for (let at = batches.length - 1; at >= 0; at -= 1) {
                    const batch = batches[at]
                    if (!batch) continue
                    const left = batch.ids.filter((id) => !undone.has(id))
                    if (left.length > 0) return left
                }
                return []
            },
        }
    }
    const orderOf = (batch: Batch) => ({
        instant: batch.instant,
        id: batch.latestId,
    })
    const everyone = stack()
    const devices = new Map<string, ReturnType<typeof stack>>()
    const deviceOf = (by: string) => {
        const found = devices.get(by) ?? stack()
        devices.set(by, found)
        return found
    }

    const show = (cell: number, count: number) => {
        const change = count - (counts[cell] ?? 0)
        counts[cell] = count
        const row = Math.floor(cell / index.columns.length)
        rowTotals[row] = (rowTotals[row] ?? 0) + change
        total += change
    }

    const recount = (cell: number) => {
        let count = 0
        for (const { delta } of live[cell] ?? []) {
            count = Math.max(0, count + delta)
        }
        show(cell, count)
    }

    const add = (entry: Placed) => {
        const entries = live[entry.cell]
        if (!entries) return
        const last = entries.at(-1)
        if (!last || earlier(last, entry)) {
            entries.push(entry)
            show(
                entry.cell,
                Math.max(0, (counts[entry.cell] ?? 0) + entry.delta)
            )
            return
        }
        const at = entries.findIndex((each) => earlier(entry, each))
        entries.splice(at === -1 ? entries.length : at, 0, entry)
        recount(entry.cell)
    }

    const remove = (entry: Placed) => {
        const entries = live[entry.cell]
        const at = entries?.indexOf(entry) ?? -1
        if (!entries || at === -1) return
        entries.splice(at, 1)
        recount(entry.cell)
    }

    const place = (
        entry: Extract<TallyEntry, { kind: 'tap' | 'correction' }>
    ) => {
        const cell = index.cellOf(entry.row, entry.options)
        const delta = entry.kind === 'tap' ? 1 : entry.delta
        if (cell === undefined || !Number.isSafeInteger(delta)) {
            unplaced += 1
            return
        }
        const made = { id: entry.id, cell, delta, instant: instantOf(entry.at) }
        placed.set(entry.id, made)
        touched.add(cell)
        if (!undone.has(entry.id)) add(made)
        const key = entry.batch ?? entry.id
        const known = batchAt.get(key)
        if (known) {
            known.ids.push(entry.id)
            if (earlier(orderOf(known), made)) {
                known.instant = made.instant
                known.latestId = made.id
                everyone.moved()
                if (known.by !== undefined) deviceOf(known.by).moved()
            }
            return
        }
        const batch = {
            key,
            by: entry.by,
            ids: [entry.id],
            instant: made.instant,
            latestId: made.id,
        }
        batchAt.set(key, batch)
        everyone.push(batch)
        if (batch.by !== undefined) deviceOf(batch.by).push(batch)
    }

    const apply = (entry: TallyEntry) => {
        if (seen.has(entry.id)) return
        seen.add(entry.id)
        if (entry.kind !== 'undo') {
            place(entry)
            return
        }
        if (undone.has(entry.undoes)) return
        undone.add(entry.undoes)
        const target = placed.get(entry.undoes)
        if (target) remove(target)
    }

    return {
        take(entries: readonly TallyEntry[]) {
            for (const entry of entries) apply(entry)
        },
        countOf: (cell: number) => counts[cell] ?? 0,
        counts: () => [...counts],
        touched: (cell: number) => touched.has(cell),
        rowTotals: () => [...rowTotals],
        total: () => total,
        unplaced: () => unplaced,
        has: (id: string) => seen.has(id),
        latest(by?: string) {
            const ids =
                by === undefined ? everyone.latest() : deviceOf(by).latest()
            return ids.flatMap((id) => {
                const target = placed.get(id)
                return target ? [{ id, cell: target.cell }] : []
            })
        },
    }
}
