import i18n from '@dhis2/d2-i18n'
import React, { useId, useMemo, type ComponentPropsWithoutRef } from 'react'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { cn } from '@/components/dhis2/ui/cn'
import { Spinner } from '@/components/dhis2/ui/spinner'
import { useProblemMessage } from '../hooks'
import { FinderFormContext, useFinderContext } from '../provider/context'
import { evaluateForm, findRangeConflicts } from '../rules/evaluateForm'
import type { FormField } from '../rules/types'
import { ConfigError } from './ConfigError'

export type FinderFormProps = ComponentPropsWithoutRef<'form'>

const NO_FIELDS: readonly FormField[] = Object.freeze([])

/**
 * Adds the other match for attributes composed both ways anywhere under the
 * provider, so this form reports the conflict even if it holds only one.
 */
const withConflicts = (
    fields: readonly FormField[],
    conflicts: readonly string[]
): readonly FormField[] => {
    const composed = new Set(
        fields.map(({ attribute, match }) => `${match}:${attribute}`)
    )
    const added: FormField[] = []
    for (const { attribute, match } of fields) {
        const opposite = match === 'range' ? 'exact' : 'range'
        const key = `${opposite}:${attribute}`
        if (conflicts.includes(attribute) && !composed.has(key)) {
            composed.add(key)
            added.push({ attribute, match: opposite })
        }
    }
    return added.length ? [...fields, ...added] : fields
}

/**
 * One search: the fields inside it are judged together under the program's
 * search rules. Enter submits.
 */
export function FinderForm({
    className,
    onSubmit,
    children,
    ...props
}: FinderFormProps) {
    const { state, actions } = useFinderContext()
    const formId = useId()
    const fields = state.forms[formId] ?? NO_FIELDS
    const conflicts = useMemo(
        () => findRangeConflicts(state.fields),
        [state.fields]
    )
    const verdict = useMemo(
        () =>
            state.model
                ? evaluateForm(
                      state.model,
                      withConflicts(fields, conflicts),
                      state.values
                  )
                : undefined,
        [state.model, fields, conflicts, state.values]
    )
    const formContext = useMemo(
        () => ({ formId, fields, verdict }),
        [formId, fields, verdict]
    )
    const problem = useProblemMessage(
        verdict?.problems.find(({ kind }) => kind === 'form-cannot-search')
    )
    const search = state.status === 'ready' ? verdict?.search : undefined

    return (
        <FinderFormContext.Provider value={formContext}>
            <form
                noValidate
                aria-busy={state.status === 'loading'}
                {...props}
                data-slot="finder-form"
                className={cn('flex flex-col gap-4', className)}
                onSubmit={(event) => {
                    onSubmit?.(event)
                    event.preventDefault()
                    if (search) {
                        actions.submit(search)
                    }
                }}
            >
                {state.status === 'loading' && <Spinner />}
                {state.status === 'error' && (
                    <ErrorAlert
                        title={i18n.t("The search couldn't be loaded")}
                    />
                )}
                {problem && <ConfigError>{problem}</ConfigError>}
                {children}
            </form>
        </FinderFormContext.Provider>
    )
}
