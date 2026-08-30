import React, { type ComponentPropsWithoutRef } from 'react'
import { useWorkingListText } from '../WorkingListText'

export interface WorkingListToolbarProps extends ComponentPropsWithoutRef<'div'> {}

/**
 * Masthead control row. DHIS2 UI controls are flattened into typographic
 * chips so the borrowed buttons sit inside the editorial layout.
 */
const editorialControls =
    '[&_button]:rounded-none! [&_button]:border-transparent! [&_button]:border-b-[#8a3324]! [&_button]:bg-transparent! [&_button]:font-serif! [&_button]:text-[#2f2a24]! [&_button:hover]:bg-[#f1ead9]! [&_svg]:text-[#8a3324]! [&_input]:rounded-none! [&_input]:border-x-0! [&_input]:border-t-0! [&_input]:border-b! [&_input]:border-b-[#c8bdaf]! [&_input]:bg-transparent! [&_input]:font-serif! [&_input]:text-[#2f2a24]!'

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
            className={`flex min-w-0 max-w-full items-center gap-3 border-b border-[#e0d6c2] bg-transparent px-8 py-3 [@media(max-width:560px)]:flex-col [@media(max-width:560px)]:items-stretch ${editorialControls}${className ? ` ${className}` : ''}`}
            data-testid="working-list-toolbar"
        >
            {children}
        </div>
    )
}
