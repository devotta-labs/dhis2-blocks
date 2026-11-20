export const recording = <T>() => {
    const values: T[] = []
    const waiters = new Map<number, Array<() => void>>()
    return {
        values,
        add(...entries: T[]) {
            values.push(...entries)
            for (const [count, resolve] of waiters) {
                if (values.length >= count) {
                    waiters.delete(count)
                    for (const done of resolve) {
                        done()
                    }
                }
            }
        },
        reached(count: number) {
            if (values.length >= count) {
                return Promise.resolve()
            }
            const { promise, resolve } = Promise.withResolvers<void>()
            const pending = waiters.get(count) ?? []
            pending.push(resolve)
            waiters.set(count, pending)
            return promise
        },
    }
}
