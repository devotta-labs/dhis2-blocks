import i18n from '@dhis2/d2-i18n'
import React, { type ComponentPropsWithoutRef } from 'react'
import { IconErrorFilled24 } from '@dhis2/ui-icons'
import { Alert, AlertTitle } from '@/components/dhis2/ui/alert'
import { cn } from '@/components/dhis2/ui/cn'
import { Spinner } from '@/components/dhis2/ui/spinner'
import { useFinderResults } from '../hooks'
import { useFinderContext } from '../provider/context'

export type FinderSearchingProps = ComponentPropsWithoutRef<'div'>
export type FinderEmptyProps = ComponentPropsWithoutRef<'div'>
export type FinderTooManyProps = ComponentPropsWithoutRef<'div'>
export type FinderErrorProps = ComponentPropsWithoutRef<'div'>

const STATE_TEXT = 'flex items-center gap-2 text-sm text-dhis2-grey-700'

/** Shown while a search runs. Children replace "Searching…". */
export function FinderSearching({
    className,
    children,
    ...props
}: FinderSearchingProps) {
    const active = useFinderResults().status === 'searching'
    return (
        <div
            role="status"
            aria-atomic="true"
            {...props}
            data-slot="finder-searching"
            className={cn(active ? STATE_TEXT : 'sr-only', className)}
        >
            {active &&
                (children ?? (
                    <>
                        <Spinner aria-hidden />
                        {i18n.t('Searching…')}
                    </>
                ))}
        </div>
    )
}

/** Shown when a search finds no one. Children replace "No one found". */
export function FinderEmpty({
    className,
    children,
    ...props
}: FinderEmptyProps) {
    const active = useFinderResults().status === 'empty'
    return (
        <div
            role="status"
            aria-atomic="true"
            {...props}
            data-slot="finder-empty"
            className={cn(active ? STATE_TEXT : 'sr-only', className)}
        >
            {active && (children ?? i18n.t('No one found'))}
        </div>
    )
}

/** Shown when a search matches more people than the program allows. */
export function FinderTooMany({
    className,
    children,
    ...props
}: FinderTooManyProps) {
    const active = useFinderResults().status === 'too-many'
    return (
        <div
            role="status"
            aria-atomic="true"
            {...props}
            data-slot="finder-too-many"
            className={cn(active ? STATE_TEXT : 'sr-only', className)}
        >
            {active &&
                (children ?? i18n.t('Too many matches. Add another detail.'))}
        </div>
    )
}

/**
 * Shown when the search or the program's metadata could not be loaded.
 * Children replace the message.
 */
export function FinderError({
    className,
    children,
    ...props
}: FinderErrorProps) {
    const { state } = useFinderContext()
    if (useFinderResults().status !== 'error') {
        return null
    }
    const text =
        state.status === 'error'
            ? i18n.t("The search couldn't be loaded")
            : i18n.t("The search couldn't be completed")
    return (
        <Alert
            variant="destructive"
            {...props}
            data-slot="finder-error"
            className={cn(className)}
        >
            <IconErrorFilled24 />
            <AlertTitle>{children ?? text}</AlertTitle>
        </Alert>
    )
}
