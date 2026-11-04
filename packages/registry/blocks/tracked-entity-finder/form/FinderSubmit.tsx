import i18n from '@dhis2/d2-i18n'
import React, { type ComponentPropsWithoutRef } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { useFinderSearch } from '../hooks'

export type FinderSubmitProps = Omit<
    ComponentPropsWithoutRef<typeof Button>,
    'type'
>

/**
 * The form's submit button, disabled until the form can search. With an
 * error in a field it stays enabled, so a click shows every error.
 */
export function FinderSubmit({
    children,
    disabled,
    ...props
}: FinderSubmitProps) {
    const { canSearch, reason } = useFinderSearch()
    return (
        <Button
            {...props}
            type="submit"
            data-slot="finder-submit"
            disabled={disabled || (!canSearch && reason !== 'has-errors')}
        >
            {children ?? i18n.t('Search')}
        </Button>
    )
}
