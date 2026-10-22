import * as React from 'react'
import { cn } from './cn'

/** shadcn Textarea restyled to match @dhis2/ui TextArea. */
// React 18 drops `ref` from function component props; shadcn targets React 19.
const Textarea = React.forwardRef<
    HTMLTextAreaElement,
    React.ComponentPropsWithoutRef<'textarea'>
>(({ className, ...props }, ref) => (
    <textarea
        ref={ref}
        data-slot="textarea"
        className={cn(
            'flex field-sizing-content min-h-16 w-full rounded-dhis2-sm border border-dhis2-input bg-white px-3 py-2.5 text-sm leading-4 text-dhis2-grey-900 shadow-[inset_0_0_1px_0_rgb(48_54_60/0.1)] outline-none placeholder:text-dhis2-grey-600 focus-visible:border-dhis2-ring focus-visible:shadow-[inset_0_0_0_2px_var(--color-dhis2-ring)] disabled:cursor-not-allowed disabled:bg-dhis2-grey-100 disabled:text-dhis2-grey-600 aria-invalid:border-dhis2-red-500',
            className
        )}
        {...props}
    />
))
Textarea.displayName = 'Textarea'

export { Textarea }
