/**
 * What the event form performance specs install in the page before its own scripts run: Performance observers, a stamp
 * per input with the time its result was painted, milestones of the form opening, and a React render counter. It only
 * observes; the form's code is left as it is. The function is serialised into the page, so it imports nothing.
 */

export interface Stamp {
    type: string
    key?: string
    /** The input's `event.timeStamp`. */
    t: number
    frames: number
    /** After the first frame painted after the input. */
    paint?: number
    /** After the first painted frame where the probe held. */
    shown?: number
    /** After the tenth painted frame. */
    settled?: number
    active?: string
    activeLater?: string
    watchDy?: number
    watchDyLater?: number
}

interface Shift {
    start: number
    value: number
    recent: boolean
    sources: Array<{ node: string; dy: number }>
}

export interface Timed {
    name: string
    start: number
    duration: number
}

export interface Renders {
    on: boolean
    commits: number
    total: number
    byName: Record<string, number>
}

export type ProbeName =
    | 'always'
    | 'focusOn'
    | 'focusLabel'
    | 'present'
    | 'absent'
    | 'expanded'
    | 'buttonText'

interface Fiber {
    tag: number
    flags: number
    type: object | null
    memoizedProps: object | null
    memoizedState: object | null
    dependencies: object | null
    child: Fiber | null
    sibling: Fiber | null
}

interface FiberRoot {
    current: Fiber
}

interface Harness {
    stamps: Stamp[]
    events: Timed[]
    loafs: Timed[]
    longtasks: Timed[]
    shifts: Shift[]
    milestones: Record<string, number>
    probe: () => boolean
    watch?: Element
    frames?: number[]
    renders: Renders
    root?: FiberRoot
    setProbe(name: ProbeName, arg: string, watch: string): void
    prime(): void
    track(origin: number): void
}

declare global {
    interface Window {
        __efp: Harness
        __REACT_DEVTOOLS_GLOBAL_HOOK__?: object
    }
}

interface LayoutShift extends PerformanceEntry {
    value: number
    hadRecentInput: boolean
    sources: Array<{
        node: Node | null
        previousRect: DOMRectReadOnly
        currentRect: DOMRectReadOnly
    }>
}

export const instrument = () => {
    const P: Harness = {
        stamps: [],
        events: [],
        loafs: [],
        longtasks: [],
        shifts: [],
        milestones: {},
        probe: () => true,
        renders: {
            on: location.hash.includes('count'),
            commits: 0,
            total: 0,
            byName: {},
        },
        setProbe: () => {},
        prime: () => {},
        track: () => {},
    }
    window.__efp = P
    const observe = (
        type: string,
        sink: (entry: PerformanceEntry) => void,
        durationThreshold?: number
    ) => {
        const options = { type, buffered: true, durationThreshold }
        try {
            new PerformanceObserver((list) =>
                list.getEntries().forEach(sink)
            ).observe(options)
        } catch {}
    }
    const timed = (list: Timed[]) => (entry: PerformanceEntry) =>
        list.push({
            name: entry.name,
            start: entry.startTime,
            duration: entry.duration,
        })
    observe('event', timed(P.events), 16)
    observe('long-animation-frame', timed(P.loafs))
    observe('longtask', timed(P.longtasks))
    const describe = (node: Node | null) => {
        const element =
            node instanceof Element ? node : (node?.parentElement ?? null)
        if (element === null) {
            return '?'
        }
        const label = element
            .closest('[data-slot=field], fieldset')
            ?.querySelector('label, legend, [data-slot=field-legend]')
            ?.textContent?.trim()
        const text = label ?? (element.textContent ?? '').trim()
        return `${element.tagName.toLowerCase()} "${text.slice(0, 40)}"`
    }
    observe('layout-shift', (entry) => {
        // SAFETY: the observer was asked for `layout-shift` entries only.
        const shift = entry as LayoutShift
        P.shifts.push({
            start: shift.startTime,
            value: shift.value,
            recent: shift.hadRecentInput,
            sources: shift.sources.map((source) => ({
                node: describe(source.node),
                dy: Math.round(source.currentRect.y - source.previousRect.y),
            })),
        })
    })

    const shortId = (element: Element | null) =>
        element?.id
            ? element.id.replace(/^.*?-/, '')
            : `${element?.tagName.toLowerCase()} "${(element?.textContent ?? '').slice(0, 30)}"`
    const isField = (element: Element | null, id: string) =>
        element?.id.endsWith(`-${id}`) === true
    const hiddenToggle = () =>
        [...document.querySelectorAll('form button[aria-expanded]')].find(
            (button) => button.textContent?.includes('hidden by rules')
        )
    P.setProbe = (name, arg, watch) => {
        const probes = {
            always: () => true,
            focusOn: () => isField(document.activeElement, arg),
            focusLabel: () =>
                document.activeElement?.getAttribute('aria-label') === arg,
            present: () => document.querySelector(arg) !== null,
            absent: () => document.querySelector(arg) === null,
            expanded: () =>
                hiddenToggle()?.getAttribute('aria-expanded') === arg,
            buttonText: () =>
                [...document.querySelectorAll('form button')].some(
                    (button) => button.textContent === arg
                ),
        } satisfies Record<ProbeName, () => boolean>
        P.probe = probes[name]
        P.watch = (watch && document.querySelector(watch)) || undefined
    }

    const afterPaint = (callback: (now: number) => void) =>
        requestAnimationFrame(() => {
            const channel = new MessageChannel()
            channel.port1.onmessage = () => callback(performance.now())
            channel.port2.postMessage(null)
        })
    const stamp = (event: Event) => {
        const s: Stamp = {
            type: event.type,
            key: event instanceof KeyboardEvent ? event.key : undefined,
            t: event.timeStamp,
            frames: 0,
        }
        P.stamps.push(s)
        const { watch, probe } = P
        const before = watch?.getBoundingClientRect().y
        const moved = () =>
            watch === undefined || before === undefined
                ? undefined
                : watch.getBoundingClientRect().y - before
        const check = (now: number) => {
            s.frames += 1
            s.paint ??= now
            if (s.shown === undefined && probe()) {
                s.shown = now
                s.active = shortId(document.activeElement)
                s.watchDy = moved()
            }
            if (s.frames === 10) {
                s.settled = now
                s.activeLater = shortId(document.activeElement)
                s.watchDyLater = moved()
            }
            if (s.frames < 10 || (s.shown === undefined && s.frames < 120)) {
                afterPaint(check)
            }
        }
        afterPaint(check)
    }
    addEventListener('keydown', stamp, true)
    addEventListener('click', stamp, true)

    const date = () =>
        document.querySelector<HTMLInputElement>(
            'form input[id$="-occurredAt"]'
        )
    const conditions = {
        skeleton: () =>
            [...document.querySelectorAll('[role=status]')].some((status) =>
                status.textContent?.includes('Loading the form')
            ),
        form: () => date() !== null,
        editable: () => date()?.readOnly === false,
    }
    P.track = (origin) => {
        P.milestones = {}
        const poll = (now: number) => {
            for (const [name, holds] of Object.entries(conditions)) {
                if (P.milestones[name] === undefined && holds()) {
                    P.milestones[name] = now - origin
                }
            }
            if (P.milestones.editable === undefined && now - origin < 60_000) {
                afterPaint(poll)
            }
        }
        afterPaint(poll)
    }
    addEventListener('DOMContentLoaded', () => P.track(0))

    const FINGERPRINTS: ReadonlyArray<readonly [string, string]> = [
        ['ValueInput', '-message-'],
        ['FormField', '.storedFile'],
        ['EventFormFields', '{{section}}'],
        ['Why', 'Why? {{label}}'],
    ]
    const names = new WeakMap<object, string>()
    const nameOf = ({ type }: Fiber) => {
        if (!(type instanceof Function)) {
            return ''
        }
        let name = names.get(type)
        if (name === undefined) {
            const source = Function.prototype.toString.call(type)
            name =
                FINGERPRINTS.find(([, mark]) => source.includes(mark))?.[0] ??
                ''
            names.set(type, name)
        }
        return name
    }
    const seen = new WeakMap<Fiber, Array<object | null>>()
    const walk = (root: FiberRoot, count: boolean) => {
        const stack = [root.current]
        for (let fiber = stack.pop(); fiber; fiber = stack.pop()) {
            if ([0, 1, 11, 15].includes(fiber.tag) && (fiber.flags & 1) === 1) {
                const token = [
                    fiber.memoizedProps,
                    fiber.memoizedState,
                    fiber.dependencies,
                ]
                const last = seen.get(fiber)
                if (!last || last.some((part, at) => part !== token[at])) {
                    seen.set(fiber, token)
                    if (count) {
                        P.renders.total += 1
                        const name = nameOf(fiber)
                        if (name !== '') {
                            P.renders.byName[name] =
                                (P.renders.byName[name] ?? 0) + 1
                        }
                    }
                }
            }
            if (fiber.sibling) stack.push(fiber.sibling)
            if (fiber.child) stack.push(fiber.child)
        }
    }
    P.prime = () => {
        if (P.root) walk(P.root, false)
    }
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        supportsFiber: true,
        isDisabled: false,
        renderers: new Map(),
        inject: () => 1,
        checkDCE: () => {},
        onScheduleFiberRoot: () => {},
        onCommitFiberUnmount: () => {},
        onPostCommitFiberRoot: () => {},
        onCommitFiberRoot: (_renderer: number, root: FiberRoot) => {
            P.root = root
            if (P.renders.on) {
                P.renders.commits += 1
                walk(root, true)
            }
        },
    }
}
