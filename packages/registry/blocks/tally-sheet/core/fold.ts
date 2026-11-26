import type { TallyIndex } from './layout'
import type { TallyEntry } from './types'

interface Placed {
    cell: number
    delta: number
}

interface Batch {
    key: string
    by: string | undefined
    ids: string[]
}

/**
 * A session's counts, kept as entries arrive. Each entry is counted once however often it is given and in whatever
 * order, an undo that arrives before its entry included, so joined logs add up the same on every device. A cell's sum
 * falls below zero only when joined logs lowered it twice. Entries for a row or options the layout does not have are
 * `unplaced`: counted nowhere. `latest` is what the next undo takes back: the latest action with something left, of
 * the device `by` names when it names one. A settle is never undone on its own. `touches` is how many entries have
 * changed a cell, the same on every device that has the same log.
 */
export const createFold = (index: TallyIndex) => {
    const sums = Array.from({ length: index.size }, () => 0)
    const touches = Array.from({ length: index.size }, () => 0)
    const rowTotals = index.rows.map(() => 0)
    const seen = new Set<string>()
    const placed = new Map<string, Placed>()
    const undone = new Set<string>()
    const batchAt = new Map<string, Batch>()
    let total = 0
    let unplaced = 0

    const stack = () => {
        const batches: Batch[] = []
        const held = new Set<Batch>()
        return {
            push(batch: Batch) {
                if (held.has(batch)) return
                held.add(batch)
                batches.push(batch)
            },
            latest() {
                for (let at = batches.length - 1; at >= 0; at -= 1) {
                    const batch = batches[at]
                    if (!batch) continue
                    const left = batch.ids.filter((id) => !undone.has(id))
                    if (left.length > 0) return left
                    if (at === batches.length - 1) {
                        batches.pop()
                        held.delete(batch)
                    }
                }
                return []
            },
        }
    }
    const everyone = stack()
    const devices = new Map<string, ReturnType<typeof stack>>()
    const deviceOf = (by: string) => {
        const found = devices.get(by) ?? stack()
        devices.set(by, found)
        return found
    }

    const add = (cell: number, delta: number) => {
        const before = Math.max(0, sums[cell] ?? 0)
        sums[cell] = (sums[cell] ?? 0) + delta
        touches[cell] = (touches[cell] ?? 0) + 1
        const change = Math.max(0, sums[cell] ?? 0) - before
        const row = Math.floor(cell / index.columns.length)
        rowTotals[row] = (rowTotals[row] ?? 0) + change
        total += change
    }

    const place = (
        entry: Extract<TallyEntry, { kind: 'tap' | 'correction' | 'settle' }>
    ) => {
        const cell = index.cellOf(entry.row, entry.options)
        const delta = entry.kind === 'tap' ? 1 : entry.delta
        if (cell === undefined || !Number.isSafeInteger(delta)) {
            unplaced += 1
            return
        }
        placed.set(entry.id, { cell, delta })
        if (!undone.has(entry.id)) add(cell, delta)
        if (entry.kind === 'settle') return
        const key = entry.batch ?? entry.id
        const batch = batchAt.get(key) ?? { key, by: entry.by, ids: [] }
        batchAt.set(key, batch)
        batch.ids.push(entry.id)
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
        if (target) add(target.cell, -target.delta)
    }

    return {
        take(entries: readonly TallyEntry[]) {
            for (const entry of entries) apply(entry)
        },
        sumOf: (cell: number) => sums[cell] ?? 0,
        touchesOf: (cell: number) => touches[cell] ?? 0,
        sums: () => [...sums],
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
