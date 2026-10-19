import { useState } from 'react'

/**
 * Keeps what is typed as a draft until it is finished: on blur or Enter it is validated and
 * committed. A blank draft (empty or only whitespace) commits `undefined`, so a value is never
 * stored as spaces. A draft that fails `validate` is kept, with the error, and nothing is
 * committed.
 *
 * By default the text is the value. `format` and `parse` map between the value and the text
 * shown, for a value typed in another form (a date in the system calendar).
 */
export const useTypedValue = ({
    value,
    onCommit,
    validate,
    format,
    parse,
}: {
    value: string | undefined
    onCommit(value: string | undefined): void
    /** Returns an untranslated error key, or `undefined` when the text is acceptable. */
    validate?: (text: string) => string | undefined
    /** The text to show for a value. */
    format?: (value: string) => string
    /** The value for finished, valid text. */
    parse?: (text: string) => string
}) => {
    const [draft, setDraft] = useState<string>()
    const [error, setError] = useState<string>()

    const finish = () => {
        if (draft === undefined) {
            return
        }
        const blank = draft.trim() === ''
        const text = validate === undefined ? draft : draft.trim()
        const problem = blank ? undefined : validate?.(text)
        if (problem !== undefined) {
            setError(problem)
            return
        }
        setError(undefined)
        setDraft(undefined)
        const next = blank ? undefined : (parse?.(text) ?? text)
        if (next !== value) {
            onCommit(next)
        }
    }

    const shown = value === undefined ? '' : (format?.(value) ?? value)
    return {
        text: draft ?? shown,
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
