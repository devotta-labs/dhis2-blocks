import i18n from '@dhis2/d2-i18n'
import React, { type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { useFinderSearch, type FinderSearchState } from '../hooks'

export type FinderHintProps = ComponentPropsWithoutRef<'p'>

const hintText = ({
    reason,
    missing,
    searchingBy,
}: FinderSearchState): string | undefined => {
    if (searchingBy) {
        return i18n.t('Searching by {{label}} only', {
            label: searchingBy,
            interpolation: { escapeValue: false },
        })
    }
    if (reason === 'two-ids') {
        return i18n.t('Search by one ID at a time')
    }
    if (reason === 'needs-more') {
        return missing === 1
            ? i18n.t('Add 1 more detail to search')
            : i18n.t('Add {{count}} more details to search', { count: missing })
    }
    return undefined
}

/** What the form still needs, or what it searches by. Renders nothing otherwise. */
export function FinderHint({ className, ...props }: FinderHintProps) {
    const text = hintText(useFinderSearch())
    if (!text) {
        return null
    }
    return (
        <p
            {...props}
            data-slot="finder-hint"
            className={cn('m-0 text-sm text-dhis2-grey-700', className)}
        >
            {text}
        </p>
    )
}
