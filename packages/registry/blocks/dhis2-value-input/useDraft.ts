import { useMemo, useRef, useState } from 'react'
import { parseTyped, typedText } from '@/components/dhis2-value-types'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import type { EditorProblem } from './editors/popupEditors'
import { useReported } from './useReported'

interface DraftOptions {
    field: Field
    settings: ValueSettings
    value: string | undefined
    onChange(value: string | null, problem?: EditorProblem): void
    /** A locked field drops what was typed and reports nothing. */
    readOnly: boolean
}

interface DraftState {
    fieldKey: string
    value: string | undefined
    text: string
    edited: boolean
    reported: EditorProblem | undefined
    fixed: boolean
}

/** What makes a field another field, or its text another text: its type, mask, options, calendar and date format. */
export const keyOf = (
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
    settings: ValueSettings,
    fieldKey: string
) => ({
    fieldKey,
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
    const fieldKey = useMemo(
        () => keyOf(field, settings),
        // oxlint-disable-next-line react-hooks/exhaustive-deps -- the parts `keyOf` reads; a host may build `field` and `settings` anew on every render
        [
            field.valueType,
            field.fieldMask,
            field.options,
            settings.calendar,
            settings.dateFormat,
        ]
    )
    const [state, setState] = useState<DraftState>(() =>
        fresh(field, value, settings, fieldKey)
    )
    const echo = useReported(value)
    let draft = state
    if (
        fieldKey !== state.fieldKey ||
        echo.isNew ||
        (readOnly && (state.edited || state.reported !== undefined))
    ) {
        draft = fresh(field, value, settings, fieldKey)
        setState(draft)
        echo.forget()
    }
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
            update(fresh(field, typed.value, settings, current.fieldKey))
            if (
                typed.value !== current.value ||
                current.reported !== undefined
            ) {
                echo.report(typed.value ?? null)
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
            echo.report(null)
            onChange(null, next)
        }
    }

    return {
        text: draft.text,
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
