import { Field as FieldPrimitive } from '@base-ui/react/field'
import * as React from 'react'
import { cn } from './cn'

/** shadcn Textarea restyled to match @dhis2/ui TextArea. Inside a `Field`, it takes the field's label, description, error and `invalid`. */
// React 18 drops `ref` from function component props; shadcn targets React 19.
const Textarea = React.forwardRef<
    HTMLTextAreaElement,
    React.ComponentPropsWithoutRef<'textarea'>
>(({ className, id, name, value, defaultValue, disabled, ...props }, ref) => (
    // Field.Control types its props for an input, so the textarea's own props go on the element.
    <FieldPrimitive.Control
        id={id}
        name={name}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        render={<textarea ref={ref} {...props} />}
        data-slot="textarea"
        className={cn(
            'flex field-sizing-content min-h-16 w-full rounded-dhis2-sm border border-dhis2-input bg-dhis2-background px-3 py-2.5 text-sm leading-4 text-dhis2-foreground shadow-[inset_0_0_1px_0_color-mix(in_srgb,var(--dhis2-foreground)_10%,transparent)] outline-none placeholder:text-dhis2-subtle-foreground focus-visible:border-dhis2-ring focus-visible:shadow-[inset_0_0_0_2px_var(--dhis2-ring)] forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-solid forced-colors:focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:bg-dhis2-muted disabled:text-dhis2-disabled-foreground aria-invalid:border-dhis2-destructive-border',
            className
        )}
    />
))
Textarea.displayName = 'Textarea'

export { Textarea }
