import { useRef, useState } from 'react'
import { parseTyped, typedText } from '@/components/dhis2-value-types'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import type { EditorProblem } from './editors/popupEditors'

interface DraftOptions {
    field: Field
    settings: ValueSettings
    value: string | undefined
    onChange(value: string | null, problem?: EditorProblem): void
    /** A locked field drops what was typed and reports nothing. */
    readOnly: boolean
}

interface DraftState {
    /** What makes the field another field, or its text another text, so a host may build both anew on every render. */
    fieldKey: string
    /** The `value` the host gave at the last render. */
    given: string | undefined
    /**
     * The value the host holds, as far as the control knows: the one it gave, or the one last reported (`undefined` for
     * `null`). The host giving it back, however late, is not a new value.
     */
    value: string | undefined
    text: string
    /** Typed since the text was last set from a value or reported. */
    edited: boolean
    /** The problem last reported, until a value is. */
    reported: EditorProblem | undefined
    /** The text has been valid since the problem was reported, which stays hidden until the next commit. */
    fixed: boolean
}

const keyOf = (
    { valueType, fieldMask, options }: Field,
    { calendar, dateFormat }: ValueSettings
) =>
    JSON.stringify([
        valueType,
        fieldMask,
        options?.map(({ code }) => code),
        calendar,
        dateFormat,
    ])

const fresh = (
    field: Field,
    value: string | undefined,
    settings: ValueSettings
): DraftState => ({
    fieldKey: keyOf(field, settings),
    given: value,
    value,
    text: value === undefined ? '' : typedText(field, value, settings),
    edited: false,
    reported: undefined,
    fixed: false,
})

const sameProblem = (a: EditorProblem | undefined, b: EditorProblem) =>
    a?.message === b.message && a.text === b.text

/**
 * The text typed in a field, reported through `onChange` only on `commit`, once for each new value or problem. A
 * `value` from the host that is not the one last reported (a rule assigned it), another `field`, or another calendar or
 * date format, replaces the text and drops the problem; the host saying back what was reported, at once or later, does
 * not.
 * A reported problem shows until the text is valid or committed again: it is not replaced while typing, and once the
 * text has been valid it stays hidden until the next commit.
 */
export const useDraft = ({
    field,
    settings,
    value,
    onChange,
    readOnly,
}: DraftOptions) => {
    const [state, setState] = useState(() => fresh(field, value, settings))
    let draft = state
    if (
        keyOf(field, settings) !== state.fieldKey ||
        (value !== state.given && value !== state.value) ||
        (readOnly && (state.edited || state.reported !== undefined))
    ) {
        draft = fresh(field, value, settings)
        setState(draft)
    } else if (value !== state.given) {
        draft = { ...state, given: value }
        setState(draft)
    }
    // A commit's result, before React renders it: a blur that a handler further up the same Enter causes runs the
    // commit of the render before, and must see that it is done.
    const latest = useRef(draft)
    latest.current = draft

    const update = (next: DraftState) => {
        latest.current = next
        setState(next)
    }

    const commit = () => {
        const current = latest.current
        if (!current.edited) {
            return
        }
        const typed = parseTyped(field, current.text, settings)
        if (typed.ok) {
            update({
                ...fresh(field, typed.value, settings),
                given: current.given,
            })
            if (
                typed.value !== current.value ||
                current.reported !== undefined
            ) {
                onChange(typed.value ?? null)
            }
            return
        }
        const next = { message: typed.problem.message, text: current.text }
        update({
            ...current,
            value: undefined,
            edited: false,
            reported: next,
            fixed: false,
        })
        if (!sameProblem(current.reported, next)) {
            onChange(null, next)
        }
    }

    return {
        text: draft.text,
        /** The problem to show: the one reported, until the text is valid. */
        problem: draft.fixed ? undefined : draft.reported,
        change: (text: string) => {
            const current = latest.current
            update({
                ...current,
                text,
                edited: true,
                fixed:
                    current.fixed ||
                    (current.reported !== undefined &&
                        parseTyped(field, text, settings).ok),
            })
        },
        commit,
    }
}
