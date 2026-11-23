'use client'

import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from './cn'
import { useSidebar } from './sidebar'
import { Skeleton } from './skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
    return (
        <ul
            data-slot="sidebar-menu"
            data-sidebar="menu"
            className={cn(
                'm-0 flex w-full min-w-0 list-none flex-col gap-0 p-0',
                className
            )}
            {...props}
        />
    )
}

const SidebarMenuItem = React.forwardRef<
    HTMLLIElement,
    React.ComponentPropsWithoutRef<'li'>
>(({ className, ...props }, ref) => (
    <li
        ref={ref}
        data-slot="sidebar-menu-item"
        data-sidebar="menu-item"
        className={cn('group/menu-item relative', className)}
        {...props}
    />
))
SidebarMenuItem.displayName = 'SidebarMenuItem'

const sidebarMenuButtonVariants = cva(
    'peer/menu-button group/menu-button flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-dhis2-md border-0 bg-transparent p-2 text-start text-sm text-inherit no-underline outline-none transition-[width,height,padding] group-has-data-[sidebar=menu-action]/menu-item:pe-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-dhis2-accent hover:text-dhis2-accent-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dhis2-ring focus-visible:outline-solid active:bg-dhis2-accent active:text-dhis2-accent-foreground disabled:pointer-events-none disabled:text-dhis2-disabled-foreground aria-disabled:pointer-events-none aria-disabled:text-dhis2-disabled-foreground aria-[current=page]:bg-dhis2-accent aria-[current=page]:font-medium aria-[current=page]:text-dhis2-accent-foreground data-active:bg-dhis2-accent data-active:font-medium data-active:text-dhis2-accent-foreground motion-reduce:transition-none forced-colors:aria-[current=page]:outline-2 forced-colors:aria-[current=page]:-outline-offset-2 forced-colors:aria-[current=page]:outline-solid forced-colors:data-active:outline-2 forced-colors:data-active:-outline-offset-2 forced-colors:data-active:outline-solid [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate',
    {
        variants: {
            variant: {
                default: '',
                outline:
                    'bg-dhis2-background shadow-[0_0_0_1px_var(--dhis2-border)] hover:shadow-[0_0_0_1px_var(--dhis2-border-strong)]',
            },
            size: {
                default: 'h-8 text-sm',
                sm: 'h-7 text-xs',
                lg: 'h-12 text-sm group-data-[collapsible=icon]:p-0!',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
)

/**
 * The menu parts of the shadcn Sidebar (Base UI). A button or link is marked
 * as current with `isActive` or, as a router's NavLink does, with
 * `aria-current="page"`. Forced colours flatten its background, so there it
 * is outlined.
 */
const SidebarMenuButton = React.forwardRef<
    HTMLButtonElement,
    useRender.ComponentProps<'button'> & {
        isActive?: boolean
        /** Shown beside the button while the sidebar is collapsed to icons. */
        tooltip?: React.ReactNode
    } & VariantProps<typeof sidebarMenuButtonVariants>
>(
    (
        {
            render,
            isActive = false,
            variant = 'default',
            size = 'default',
            tooltip,
            className,
            ...props
        },
        ref
    ) => {
        const { isMobile, state } = useSidebar()
        const button = useRender({
            defaultTagName: 'button',
            ref,
            props: mergeProps<'button'>(
                {
                    className: cn(
                        sidebarMenuButtonVariants({ variant, size }),
                        className
                    ),
                },
                props
            ),
            render: tooltip ? <TooltipTrigger render={render} /> : render,
            state: {
                slot: 'sidebar-menu-button',
                sidebar: 'menu-button',
                size,
                active: isActive,
            },
        })

        if (!tooltip) {
            return button
        }

        return (
            <Tooltip>
                {button}
                <TooltipContent
                    side="inline-end"
                    align="center"
                    hidden={state !== 'collapsed' || isMobile}
                >
                    {tooltip}
                </TooltipContent>
            </Tooltip>
        )
    }
)
SidebarMenuButton.displayName = 'SidebarMenuButton'

function SidebarMenuAction({
    className,
    render,
    showOnHover = false,
    ...props
}: useRender.ComponentProps<'button'> & {
    showOnHover?: boolean
}) {
    return useRender({
        defaultTagName: 'button',
        props: mergeProps<'button'>(
            {
                className: cn(
                    'absolute end-1 top-1.5 flex aspect-square w-5 cursor-pointer items-center justify-center rounded-dhis2-md border-0 bg-transparent p-0 text-dhis2-foreground outline-none transition-transform group-data-[collapsible=icon]:hidden peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-dhis2-accent-strong focus-visible:outline-2 focus-visible:outline-dhis2-ring focus-visible:outline-solid motion-reduce:transition-none md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0',
                    showOnHover &&
                        'group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 aria-expanded:opacity-100 md:opacity-0',
                    className
                ),
            },
            props
        ),
        render,
        state: {
            slot: 'sidebar-menu-action',
            sidebar: 'menu-action',
        },
    })
}

function SidebarMenuBadge({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="sidebar-menu-badge"
            data-sidebar="menu-badge"
            className={cn(
                'pointer-events-none absolute end-1 flex h-5 min-w-5 items-center justify-center rounded-dhis2-md px-1 text-xs font-medium text-dhis2-muted-foreground tabular-nums select-none group-data-[collapsible=icon]:hidden peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1',
                className
            )}
            {...props}
        />
    )
}

function SidebarMenuSkeleton({
    className,
    showIcon = false,
    ...props
}: React.ComponentProps<'div'> & {
    showIcon?: boolean
}) {
    const [maxWidth] = React.useState(
        () => `${Math.floor(Math.random() * 40) + 50}%`
    )

    return (
        <div
            data-slot="sidebar-menu-skeleton"
            data-sidebar="menu-skeleton"
            className={cn(
                'flex h-8 items-center gap-2 rounded-dhis2-md px-2',
                className
            )}
            {...props}
        >
            {showIcon && (
                <Skeleton
                    className="size-4 rounded-dhis2-md"
                    data-sidebar="menu-skeleton-icon"
                />
            )}
            <Skeleton
                className="h-4 flex-1"
                data-sidebar="menu-skeleton-text"
                style={{ maxWidth }}
            />
        </div>
    )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<'ul'>) {
    return (
        <ul
            data-slot="sidebar-menu-sub"
            data-sidebar="menu-sub"
            className={cn(
                'mx-3.5 my-0 flex min-w-0 list-none flex-col gap-1 border-0 border-s border-solid border-dhis2-border px-2.5 py-0.5 group-data-[collapsible=icon]:hidden',
                className
            )}
            {...props}
        />
    )
}

function SidebarMenuSubItem({
    className,
    ...props
}: React.ComponentProps<'li'>) {
    return (
        <li
            data-slot="sidebar-menu-sub-item"
            data-sidebar="menu-sub-item"
            className={cn('group/menu-sub-item relative', className)}
            {...props}
        />
    )
}

const SidebarMenuSubButton = React.forwardRef<
    HTMLAnchorElement,
    useRender.ComponentProps<'a'> & {
        size?: 'sm' | 'md'
        isActive?: boolean
    }
>(({ render, size = 'md', isActive = false, className, ...props }, ref) =>
    useRender({
        defaultTagName: 'a',
        ref,
        props: mergeProps<'a'>(
            {
                className: cn(
                    'flex h-7 min-w-0 items-center gap-2 overflow-hidden rounded-dhis2-md px-2 text-dhis2-foreground no-underline outline-none group-data-[collapsible=icon]:hidden hover:bg-dhis2-accent hover:text-dhis2-accent-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dhis2-ring focus-visible:outline-solid active:bg-dhis2-accent aria-disabled:pointer-events-none aria-disabled:text-dhis2-disabled-foreground aria-[current=page]:bg-dhis2-accent aria-[current=page]:font-medium data-[size=md]:text-sm data-[size=sm]:text-xs data-active:bg-dhis2-accent data-active:font-medium forced-colors:aria-[current=page]:outline-2 forced-colors:aria-[current=page]:-outline-offset-2 forced-colors:aria-[current=page]:outline-solid forced-colors:data-active:outline-2 forced-colors:data-active:-outline-offset-2 forced-colors:data-active:outline-solid [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
                    className
                ),
            },
            props
        ),
        render,
        state: {
            slot: 'sidebar-menu-sub-button',
            sidebar: 'menu-sub-button',
            size,
            active: isActive,
        },
    })
)
SidebarMenuSubButton.displayName = 'SidebarMenuSubButton'

export {
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSkeleton,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
}
