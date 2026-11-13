import { useState } from 'react'

/**
 * Whether the `value` the host gives is news (`isNew`: a rule assigned it), or one the control reported coming back.
 * The reports the host has still to give back are kept in order: one coming back, however late, takes those before
 * it with it, so the first of two quick commits coming back is not news either. `forget` drops them: the host saying
 * one again is then news.
 */
export const useReported = (value: string | undefined) => {
    const [state, setState] = useState<{
        given: string | undefined
        pending: ReadonlyArray<string | null>
    }>({ given: value, pending: [] })
    let isNew = false
    if (value !== state.given) {
        const at = state.pending.indexOf(value ?? null)
        isNew = at === -1
        setState({
            given: value,
            pending: isNew ? [] : state.pending.slice(at + 1),
        })
    }
    return {
        isNew,
        /** Call with each value reported to the host. */
        report: (next: string | null) =>
            setState((now) => ({
                ...now,
                // One the host holds already will not come back.
                pending:
                    next === (now.given ?? null) ? [] : [...now.pending, next],
            })),
        forget: () =>
            setState((now) =>
                now.pending.length === 0 ? now : { ...now, pending: [] }
            ),
    }
}
