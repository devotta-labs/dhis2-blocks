import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

// Linux counts a processor's time in hundredths of a second.
const TICK_MS = 10
const EVERY_MS = 20

/** The processors this process may run on. */
const allowed = () => {
    const list =
        /^Cpus_allowed_list:\s+(\S+)/m.exec(
            readFileSync('/proc/self/status', 'utf8')
        )?.[1] ?? ''
    return list.split(',').flatMap((range) => {
        const [first = 0, last = first] = range.split('-').map(Number)
        return Array.from(
            { length: last - first + 1 },
            (_, index) => first + index
        )
    })
}

/**
 * Keeps one processor for the page's main thread alone, and answers which. On a virtual machine the hypervisor
 * takes processor time for its other guests, which stretches every time measured; with the thread alone on a
 * processor, what was taken from it can be read off that processor and left out. Nothing where that cannot be
 * told: not on Linux, or with one processor.
 */
const reserve = () => {
    if (!existsSync('/proc/stat')) {
        return undefined
    }
    const cores = allowed()
    const own = cores.at(-1)
    if (own === undefined || cores.length < 2) {
        return undefined
    }
    // The browser starts from this thread, and may run where this thread may.
    execFileSync(
        'taskset',
        ['-cp', cores.slice(0, -1).join(','), String(process.pid)],
        { stdio: 'ignore' }
    )
    return own
}

const CORE = reserve()

/** Moves a process's main thread to the processor kept for it; answers whether it could. */
export const pin = (process: number) => {
    if (CORE === undefined) {
        return false
    }
    execFileSync('taskset', ['-cp', String(CORE), String(process)], {
        stdio: 'ignore',
    })
    return true
}

type Reading = { at: number; workedMs: number; stolenMs: number }

const reading = (core: number): Reading => {
    const line =
        readFileSync('/proc/stat', 'utf8')
            .split('\n')
            .find((each) => each.startsWith(`cpu${core} `)) ?? ''
    const [user = 0, nice = 0, system = 0, , , irq = 0, soft = 0, stolen = 0] =
        line.split(/\s+/).slice(1).map(Number)
    return {
        at: Date.now(),
        workedMs: (user + nice + system + irq + soft) * TICK_MS,
        stolenMs: stolen * TICK_MS,
    }
}

/** Keeps reading what the kept processor did, so that what was stolen in any stretch of a run can be asked after. */
export const watch = () => {
    const readings: Reading[] = []
    const now = () => {
        if (CORE === undefined) {
            return Date.now()
        }
        const read = reading(CORE)
        readings.push(read)
        return read.at
    }
    now()
    const timer = setInterval(now, EVERY_MS)
    return {
        /** Reads the processor now, and answers when that was. */
        now,
        /**
         * Between two moments (milliseconds since 1970): the time stolen from the main thread, and the share that
         * is of the time it wanted the processor. Both zero where there is no telling.
         */
        between: (from: number, to: number) => {
            const at = (moment: number) =>
                readings.findLast((read) => read.at <= moment) ?? readings[0]
            const first = at(from)
            const last = at(to)
            if (first === undefined || last === undefined) {
                return { stolenMs: 0, share: 0 }
            }
            const stolenMs = last.stolenMs - first.stolenMs
            const wantedMs = stolenMs + last.workedMs - first.workedMs
            return { stolenMs, share: wantedMs > 0 ? stolenMs / wantedMs : 0 }
        },
        stop: () => clearInterval(timer),
    }
}

export type Clock = ReturnType<typeof watch>
