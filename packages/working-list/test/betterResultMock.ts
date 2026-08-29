class Ok<T> {
    readonly status = 'ok' as const
    constructor(readonly value: T) {}
    isOk() {
        return true
    }
    isErr() {
        return false
    }
}

class Err<E> {
    readonly status = 'error' as const
    constructor(readonly error: E) {}
    isOk() {
        return false
    }
    isErr() {
        return true
    }
}

function ok(): Ok<void>
function ok<T>(value: T): Ok<T>
function ok<T>(value?: T) {
    return new Ok(value)
}

export const Result = {
    ok,
    err<E>(error: E) {
        return new Err(error)
    },
    isOk(value: { status: string }) {
        return value.status === 'ok'
    },
    isError(value: { status: string }) {
        return value.status === 'error'
    },
}

interface TaggedErrorCandidate extends Error {
    _tag: string
}

const createTaggedError = (tag: string) =>
    class TaggedErrorBase extends Error {
        readonly _tag = tag

        constructor(properties: object & { message?: string }) {
            super(String(properties.message ?? tag))
            Object.assign(this, properties)
        }

        static is(value: TaggedErrorCandidate) {
            return value instanceof this
        }
    }

export const TaggedError = Object.assign(createTaggedError, {
    is(value: TaggedErrorCandidate) {
        return value instanceof Error && '_tag' in value
    },
})
