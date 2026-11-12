import i18n from '@dhis2/d2-i18n'
import React, { type ComponentPropsWithoutRef } from 'react'

export interface WorkingListToolbarProps extends ComponentPropsWithoutRef<'div'> {}

export const WorkingListToolbar = ({
    children,
    className,
    role = 'toolbar',
    'aria-label': ariaLabel,
    ...props
}: WorkingListToolbarProps) => {
    return (
        <div
            {...props}
            role={role}
            aria-label={ariaLabel ?? i18n.t('Working list controls')}
            className={`flex min-w-0 max-w-full items-center gap-1 border-b border-dhis2-border px-2 py-3 [@media(max-width:560px)]:flex-col [@media(max-width:560px)]:items-stretch${className ? ` ${className}` : ''}`}
            data-testid="working-list-toolbar"
        >
            {children}
        </div>
    )
}
