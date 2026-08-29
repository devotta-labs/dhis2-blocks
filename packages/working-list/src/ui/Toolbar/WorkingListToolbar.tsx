import React, { type ComponentPropsWithoutRef } from 'react'
import { useWorkingListText } from '../WorkingListText'

export interface WorkingListToolbarProps extends ComponentPropsWithoutRef<'div'> {}

export const WorkingListToolbar = ({
    children,
    className,
    role = 'toolbar',
    'aria-label': ariaLabel,
    ...props
}: WorkingListToolbarProps) => {
    const translate = useWorkingListText()

    return (
        <div
            {...props}
            role={role}
            aria-label={ariaLabel ?? translate('Working list controls')}
            className={`flex min-w-0 max-w-full items-center gap-1 border-b border-[#e8edf2] px-2 py-3 [@media(max-width:560px)]:flex-col [@media(max-width:560px)]:items-stretch [&_[data-test='configure-columns']]:h-8 [&_[data-test^='more-filters-']]:h-8${className ? ` ${className}` : ''}`}
            data-testid="working-list-toolbar"
        >
            {children}
        </div>
    )
}
