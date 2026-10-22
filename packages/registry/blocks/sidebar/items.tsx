import { Collapsible } from '@base-ui/react/collapsible'
import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { IconChevronDown16 } from '@dhis2/ui-icons'
import React, { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/components/dhis2/ui/cn'

const itemClassName =
    'relative flex min-h-10 w-full items-center gap-2 border-0 bg-transparent py-2 pe-2 ps-3 text-start text-base leading-6 text-inherit no-underline hover:bg-dhis2-grey-800 hover:underline focus-visible:bg-dhis2-grey-800 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dhis2-grey-050 disabled:cursor-not-allowed disabled:text-dhis2-grey-500 disabled:hover:bg-transparent disabled:hover:no-underline [&_svg]:shrink-0'

export function SidebarItems({
    className,
    ...props
}: ComponentPropsWithoutRef<'ul'>) {
    return (
        <ul {...props} className={cn('m-0 list-none px-0 py-2', className)} />
    )
}

export function SidebarItem(props: ComponentPropsWithoutRef<'li'>) {
    return <li {...props} />
}

export const SidebarLink = forwardRef<
    HTMLAnchorElement,
    useRender.ComponentProps<'a'>
>(({ className, render, ...props }, ref) =>
    useRender({
        defaultTagName: 'a',
        ref,
        render,
        props: mergeProps<'a'>(
            {
                className: cn(
                    itemClassName,
                    'aria-[current=page]:bg-dhis2-grey-800 aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-0 aria-[current=page]:before:start-0 aria-[current=page]:before:w-1.5 aria-[current=page]:before:bg-dhis2-teal-400',
                    className
                ),
            },
            props
        ),
        state: { slot: 'sidebar-link' },
    })
)
SidebarLink.displayName = 'SidebarLink'

export const SidebarButton = forwardRef<
    HTMLButtonElement,
    ComponentPropsWithoutRef<'button'>
>(({ className, ...props }, ref) => (
    <button
        type="button"
        {...props}
        ref={ref}
        data-slot="sidebar-button"
        className={cn(itemClassName, 'cursor-pointer', className)}
    />
))
SidebarButton.displayName = 'SidebarButton'

export function SidebarGroup(props: Omit<Collapsible.Root.Props, 'render'>) {
    return <Collapsible.Root {...props} render={<li />} />
}

export function SidebarGroupTrigger({
    className,
    children,
    ...props
}: ComponentPropsWithoutRef<'button'>) {
    return (
        <Collapsible.Trigger
            {...props}
            className={cn(itemClassName, 'group cursor-pointer', className)}
        >
            {children}
            <span
                aria-hidden="true"
                className="ms-auto flex transition-transform duration-100 group-data-panel-open:rotate-180 motion-reduce:transition-none"
            >
                <IconChevronDown16 />
            </span>
        </Collapsible.Trigger>
    )
}

export function SidebarGroupContent({
    className,
    ...props
}: Omit<Collapsible.Panel.Props, 'render' | 'className'> & {
    className?: string
}) {
    return (
        <Collapsible.Panel
            render={<ul />}
            {...props}
            className={cn(
                'm-0 ms-3 list-none border-s border-dhis2-grey-700 p-0',
                className
            )}
        />
    )
}
