import i18n from '@dhis2/d2-i18n'
import React, { type ComponentPropsWithoutRef } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { useFinderResults } from '../hooks'

export type FinderPaginationProps = ComponentPropsWithoutRef<'nav'>

/** Previous and next for the current results; nothing when there is one page. */
export function FinderPagination({
    className,
    ...props
}: FinderPaginationProps) {
    const { status, page, hasNext, hasPrevious, refreshing, next, previous } =
        useFinderResults()
    if (status !== 'results' || (!hasNext && !hasPrevious)) {
        return null
    }
    return (
        <nav
            aria-label={i18n.t('Results pages')}
            {...props}
            data-slot="finder-pagination"
            className={cn('flex items-center gap-2 text-sm', className)}
        >
            <Button
                variant="secondary"
                size="sm"
                disabled={!hasPrevious || refreshing}
                onClick={previous}
            >
                {i18n.t('Previous')}
            </Button>
            <span>{i18n.t('Page {{page}}', { page })}</span>
            <Button
                variant="secondary"
                size="sm"
                disabled={!hasNext || refreshing}
                onClick={next}
            >
                {i18n.t('Next')}
            </Button>
        </nav>
    )
}
