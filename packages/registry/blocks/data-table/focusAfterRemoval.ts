import { useEffect, useRef, type RefObject } from 'react'

/** The "Filter" button, else the first filter chip. */
export const FILTER_FOCUS_TARGETS: readonly string[] = [
    '[data-slot="data-table-add-filter"]',
    '[data-slot="data-table-filter-chip"] [role="combobox"]',
]

/**
 * Focus left with an element that went away: on the next frame, moves it to
 * the first of `targets` in `root`, unless something else already has it.
 */
export const focusAfterRemoval = (
    root: HTMLElement | null,
    targets: readonly string[]
) => {
    const frame = requestAnimationFrame(() => {
        const active = document.activeElement
        if (active !== null && active !== document.body) return
        for (const selector of targets) {
            const target = root?.querySelector<HTMLElement>(selector)
            if (target !== null && target !== undefined) {
                target.focus()
                return
            }
        }
    })
    return () => cancelAnimationFrame(frame)
}

/** `focusAfterRemoval` each time `count` drops. Keep `targets` stable. */
export const useFocusAfterRemoval = (
    count: number,
    root: RefObject<HTMLElement | null>,
    targets: readonly string[]
) => {
    const previous = useRef(count)
    useEffect(() => {
        const removed = count < previous.current
        previous.current = count
        if (!removed) return
        return focusAfterRemoval(root.current, targets)
    }, [count, root, targets])
}
