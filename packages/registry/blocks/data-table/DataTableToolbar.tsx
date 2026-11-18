import i18n from '@dhis2/d2-i18n'
import { cn } from '@/components/dhis2/ui/cn'
import type { ComponentProps } from 'react'

/** The row above the table that holds search, filters and the other tools. */
export const DataTableToolbar = ({
    className,
    'aria-label': ariaLabel,
    ...props
}: ComponentProps<'div'>) => (
    <div
        {...props}
        role="toolbar"
        aria-label={ariaLabel ?? i18n.t('Table tools')}
        data-slot="data-table-toolbar"
        className={cn(
            'flex min-w-0 flex-wrap items-center gap-2 border-b border-dhis2-border px-3 py-2',
            className
        )}
    />
)
