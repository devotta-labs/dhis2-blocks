import * as React from 'react'
import { cn } from './cn'

/** shadcn Kbd: a key or shortcut as a small grey keycap, sized to sit inside a button or a line of text. */
function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
    return (
        <kbd
            data-slot="kbd"
            className={cn(
                'pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-dhis2-sm bg-dhis2-grey-200 px-1 font-sans text-xs font-medium tracking-normal text-dhis2-grey-700 select-none',
                className
            )}
            {...props}
        />
    )
}

export { Kbd }
