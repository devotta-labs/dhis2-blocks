import React, { type ComponentPropsWithoutRef } from 'react'
import { useWorkingListText } from '../WorkingListText'

export interface WorkingListToolbarProps extends ComponentPropsWithoutRef<'div'> {}

/**
 * Command strip. DHIS2 UI controls are squared off and recoloured in place so
 * the borrowed buttons read as terminal commands.
 */
const terminalControls =
    '[&_button]:rounded-none! [&_button]:border-emerald-500/40! [&_button]:bg-transparent! [&_button]:font-mono! [&_button]:text-emerald-300! [&_button]:tracking-widest! [&_button:hover]:bg-emerald-400! [&_button:hover]:text-black! [&_svg]:text-emerald-400! [&_input]:rounded-none! [&_input]:border-emerald-500/40! [&_input]:bg-black! [&_input]:font-mono! [&_input]:text-emerald-200!'

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
            className={`flex min-w-0 max-w-full items-center gap-2 border-b border-dashed border-emerald-500/30 bg-emerald-500/[0.03] px-3 py-2 [@media(max-width:560px)]:flex-col [@media(max-width:560px)]:items-stretch ${terminalControls}${className ? ` ${className}` : ''}`}
            data-testid="working-list-toolbar"
        >
            <span
                aria-hidden="true"
                className="font-mono text-xs text-emerald-600"
            >
                $
            </span>
            {children}
        </div>
    )
}
