import { useState } from 'react'

/**
 * Keeps what is typed as a draft until it is finished: on blur or Enter it is validated and
 * committed. An empty draft commits `undefined`. A draft that fails `validate` is kept, with the
 * error, and nothing is committed.
 */
export const useTypedValue = ({
    value,
    onCommit,
    validate,
}: {
    value: string | undefined
    onCommit(value: string | undefined): void
    /** Returns an untranslated error key, or `undefined` when the text is acceptable. */
    validate?: (text: string) => string | undefined
}) => {
    const [draft, setDraft] = useState<string>()
    const [error, setError] = useState<string>()

    const finish = () => {
        if (draft === undefined) {
            return
        }
        const text = validate === undefined ? draft : draft.trim()
        const problem = text === '' ? undefined : validate?.(text)
        if (problem !== undefined) {
            setError(problem)
            return
        }
        setError(undefined)
        setDraft(undefined)
        const next = text === '' ? undefined : text
        if (next !== value) {
            onCommit(next)
        }
    }

    return {
        text: draft ?? value ?? '',
        error,
        onChange: (text: string) => {
            setDraft(text)
            setError(undefined)
        },
        onBlur: finish,
        /** Enter finishes a single-line input. */
        onEnter: finish,
    }
}
