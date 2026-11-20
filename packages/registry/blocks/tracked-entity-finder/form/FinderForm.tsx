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

                    if (event.defaultPrevented) {
                        return
                    }
                    event.preventDefault()
                    void form.handleSubmit()
                }}
            >
                {state.status === 'loading' && (
                    <Spinner label={i18n.t('Loading')} />
                )}
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
