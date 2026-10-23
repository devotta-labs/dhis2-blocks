import i18n from '@dhis2/d2-i18n'
import React, { type ComponentProps } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { useFinderSearch } from '../hooks'

export type FinderSubmitProps = Omit<ComponentProps<typeof Button>, 'type'>

/** The form's submit button, disabled until the form can search. */
export function FinderSubmit({
    children,
    disabled,
    ...props
}: FinderSubmitProps) {
    const { canSearch } = useFinderSearch()
    return (
        <Button
            {...props}
            type="submit"
            data-slot="finder-submit"
            disabled={disabled || !canSearch}
        >
            {children ?? i18n.t('Search')}
        </Button>
    )
}
