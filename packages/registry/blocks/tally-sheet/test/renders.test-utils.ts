interface ComponentRef {
    name?: string
    type?: ComponentRef
    render?: ComponentRef
}

interface Fiber {
    tag: number
    type: ComponentRef | null
    flags: number
    child: Fiber | null
    sibling: Fiber | null
    alternate: Fiber | null
}

const FUNCTION_TAGS = new Set([0, 11, 14, 15])
const PERFORMED_WORK = 1

const nameOf = (type: ComponentRef | null) => {
    const inner = type?.type ?? type?.render ?? type
    return (inner?.name ?? '').replace(/\d+$/, '')
}

let rendered: string[] = []

const walk = (next: Fiber, previous: Fiber | null) => {
    if (
        FUNCTION_TAGS.has(next.tag) &&
        (previous === null || (next.flags & PERFORMED_WORK) !== 0)
    ) {
        rendered.push(nameOf(next.type))
    }
    if (previous !== null && next.child === previous.child) return
    for (let child = next.child; child !== null; child = child.sibling) {
        walk(child, child.alternate)
    }
}

Object.assign(globalThis, {
    __REACT_DEVTOOLS_GLOBAL_HOOK__: {
        supportsFiber: true,
        isDisabled: false,
        renderers: new Map(),
        inject: () => 1,
        onScheduleFiberRoot: () => {},
        onCommitFiberUnmount: () => {},
        onPostCommitFiberRoot: () => {},
        checkDCE: () => {},
        onCommitFiberRoot: (_id: number, root: { current: Fiber }) => {
            walk(root.current, root.current.alternate)
        },
    },
})

/** The names of the components that rendered while `act` ran, one per render. */
export const rendersDuring = async (act: () => Promise<void> | void) => {
    rendered = []
    await act()
    const seen = rendered
    rendered = []
    return seen
}
