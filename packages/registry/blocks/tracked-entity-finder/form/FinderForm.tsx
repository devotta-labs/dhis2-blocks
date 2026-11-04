import i18n from '@dhis2/d2-i18n'
import React, {
    useCallback,
    useLayoutEffect,
    useMemo,
    useState,
    type ComponentPropsWithoutRef,
} from 'react'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { cn } from '@/components/dhis2/ui/cn'
import { Spinner } from '@/components/dhis2/ui/spinner'
import { useStore } from '@tanstack/react-form'
import { useMetadataErrorMessage } from '../hooks'
import { FinderFormContext, useFinderContext } from '../provider/context'
import { evaluateForm } from '../rules/evaluateForm'
import type { FormField } from '../rules/types'
import { useFinderFormApi } from './finderFormApi'
import { MetadataErrorNotice } from './MetadataErrorNotice'

export type FinderFormProps = ComponentPropsWithoutRef<'form'>

interface Registration {
    key: string
    field: FormField
}

/** This form's fields, in the order they registered. */
const useRegistrations = () => {
    const [registrations, setRegistrations] = useState<readonly Registration[]>(
        []
    )
    const register = useCallback((key: string, field: FormField) => {
        setRegistrations((current) => [...current, { key, field }])
        return () =>
            setRegistrations((current) =>
                current.filter((entry) => entry.key !== key)
            )
    }, [])
    const fields = useMemo(
        () => Object.freeze(registrations.map(({ field }) => field)),
        [registrations]
    )
    return { fields, register }
}

/**
 * One search, and one TanStack form: the fields inside it hold their values
 * there, are validated by their Zod schemas, and are judged together under
 * the program's search rules. Enter submits.
 */
export function FinderForm({
    className,
    onSubmit,
    children,
    ...props
}: FinderFormProps) {
    const { state, actions } = useFinderContext()
    const { fields, register } = useRegistrations()
    const { model, status } = state
    // TanStack calls this once the fields' Zod schemas pass; the search rules
    // still decide whether the values make a search.
    const form = useFinderFormApi((values) => {
        const search =
            model && status === 'ready'
                ? evaluateForm(model, fields, values).search
                : undefined
        if (search) {
            actions.submit(search)
        }
    })
    const values = useStore(form.store, (formState) => formState.values)
    const submitted = useStore(
        form.store,
        (formState) => formState.submissionAttempts > 0
    )
    const verdict = useMemo(
        () => (model ? evaluateForm(model, fields, values) : undefined),
        [model, fields, values]
    )
    const formContext = useMemo(
        () => ({ form, register, submitted, verdict }),
        [form, register, submitted, verdict]
    )
    // Fields register in layout effects, which run before this form's own:
    // until then the form looks empty and must not be judged unusable.
    // This covers the form's own mount, not fields mounting later into an
    // already-mounted empty form.
    const [registered, setRegistered] = useState(false)
    useLayoutEffect(() => setRegistered(true), [])
    const metadataError = useMetadataErrorMessage(
        registered
            ? verdict?.metadataErrors.find(
                  ({ kind }) => kind === 'form-cannot-search'
              )
            : undefined
    )
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
                    // A consumer's preventDefault cancels the search too.
                    if (event.defaultPrevented) {
                        return
                    }
                    event.preventDefault()
                    void form.handleSubmit()
                }}
            >
                {state.status === 'loading' && <Spinner />}
                {state.status === 'error' && (
                    <ErrorAlert
                        title={i18n.t("The search couldn't be loaded")}
                    />
                )}
                {metadataError && (
                    <MetadataErrorNotice>{metadataError}</MetadataErrorNotice>
                )}
                {children}
            </form>
        </FinderFormContext.Provider>
    )
}
