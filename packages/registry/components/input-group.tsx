'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { Button } from './button'
import { cn } from './cn'
import { Input } from './input'
import { Textarea } from './textarea'

/** shadcn InputGroup restyled to match the @dhis2/ui Input box. */
function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="input-group"
            role="group"
            className={cn(
                'group/input-group relative flex h-10 w-full min-w-0 items-center rounded-dhis2-sm border border-dhis2-input bg-white shadow-[inset_0_0_1px_0_rgb(48_54_60/0.1)] outline-none has-[[data-slot=input-group-control]:focus-visible]:border-dhis2-ring has-[[data-slot=input-group-control]:focus-visible]:shadow-[inset_0_0_0_2px_var(--color-dhis2-ring)] has-[[data-slot][aria-invalid=true]]:border-dhis2-red-500 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>textarea]:h-auto has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5',
                className
            )}
            {...props}
        />
    )
}

const inputGroupAddonVariants = cva(
    "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm text-dhis2-grey-600 select-none group-data-[disabled=true]/input-group:text-dhis2-grey-500 [&>svg]:fill-current [&>svg:not([class*='size-'])]:size-4",
    {
        variants: {
            align: {
                'inline-start': 'order-first pl-2 has-[>button]:-ml-1',
                'inline-end': 'order-last pr-2 has-[>button]:-mr-1',
                'block-start':
                    'order-first w-full justify-start px-3 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2',
                'block-end':
                    'order-last w-full justify-start px-3 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2',
            },
        },
        defaultVariants: {
            align: 'inline-start',
        },
    }
)

function InputGroupAddon({
    className,
    align = 'inline-start',
    ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>) {
    return (
        <div
            role="group"
            data-slot="input-group-addon"
            data-align={align}
            className={cn(inputGroupAddonVariants({ align }), className)}
            onClick={(event) => {
                if (
                    event.target instanceof Element &&
                    event.target.closest('button')
                ) {
                    return
                }
                event.currentTarget.parentElement
                    ?.querySelector('input')
                    ?.focus()
            }}
            {...props}
        />
    )
}

const inputGroupButtonVariants = cva(
    'flex items-center gap-2 text-sm shadow-none',
    {
        variants: {
            size: {
                xs: "h-6 gap-1 rounded-dhis2-sm px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
                sm: '',
                'icon-xs': 'size-6 rounded-dhis2-sm p-0 has-[>svg]:p-0',
                'icon-sm': 'size-8 p-0 has-[>svg]:p-0',
            },
        },
        defaultVariants: {
            size: 'xs',
        },
    }
)

const InputGroupButton = React.forwardRef<
    HTMLButtonElement,
    Omit<React.ComponentProps<typeof Button>, 'size' | 'type'> &
        VariantProps<typeof inputGroupButtonVariants> & {
            type?: 'button' | 'submit' | 'reset'
        }
>(
    (
        {
            className,
            type = 'button',
            variant = 'ghost',
            size = 'xs',
            ...props
        },
        ref
    ) => (
        <Button
            ref={ref}
            type={type}
            data-size={size}
            variant={variant}
            className={cn(inputGroupButtonVariants({ size }), className)}
            {...props}
        />
    )
)
InputGroupButton.displayName = 'InputGroupButton'

function InputGroupText({ className, ...props }: React.ComponentProps<'span'>) {
    return (
        <span
            className={cn(
                "flex items-center gap-2 text-sm text-dhis2-grey-600 [&_svg]:pointer-events-none [&_svg]:fill-current [&_svg:not([class*='size-'])]:size-4",
                className
            )}
            {...props}
        />
    )
}

const InputGroupInput = React.forwardRef<
    HTMLInputElement,
    React.ComponentPropsWithoutRef<typeof Input>
>(({ className, ...props }, ref) => (
    <Input
        ref={ref}
        data-slot="input-group-control"
        className={cn(
            'h-full flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:shadow-none aria-invalid:border-0',
            className
        )}
        {...props}
    />
))
InputGroupInput.displayName = 'InputGroupInput'

const InputGroupTextarea = React.forwardRef<
    HTMLTextAreaElement,
    React.ComponentPropsWithoutRef<typeof Textarea>
>(({ className, ...props }, ref) => (
    <Textarea
        ref={ref}
        data-slot="input-group-control"
        className={cn(
            'flex-1 resize-none rounded-none border-0 bg-transparent py-2 shadow-none focus-visible:shadow-none aria-invalid:border-0',
            className
        )}
        {...props}
    />
))
InputGroupTextarea.displayName = 'InputGroupTextarea'

export {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupText,
    InputGroupInput,
    InputGroupTextarea,
}
