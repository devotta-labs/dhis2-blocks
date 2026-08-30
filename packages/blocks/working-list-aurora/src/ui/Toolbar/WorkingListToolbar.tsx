import React, { type ComponentPropsWithoutRef } from 'react'
import { useWorkingListText } from '../WorkingListText'

export interface WorkingListToolbarProps extends ComponentPropsWithoutRef<'div'> {}

/**
 * Glass control rail. DHIS2 UI controls are inverted in place so the borrowed
 * buttons match the dark surface without forking every control component.
 */
const invertedControls =
    "[&_button]:rounded-full! [&_button]:border-white/15! [&_button]:bg-white/5! [&_button]:text-cyan-100! [&_button:hover]:border-cyan-300/60! [&_button:hover]:bg-cyan-400/15! [&_button:hover]:text-white! [&_svg]:text-cyan-200! [&_input]:rounded-full! [&_input]:border-white/15! [&_input]:bg-white/5! [&_input]:text-slate-100! [&_[data-test='dhis2-uicore-select-input']]:text-slate-100!"

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
            className={`flex min-w-0 max-w-full items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur [@media(max-width:560px)]:flex-col [@media(max-width:560px)]:items-stretch ${invertedControls}${className ? ` ${className}` : ''}`}
            data-testid="working-list-toolbar"
        >
            {children}
        </div>
    )
}
