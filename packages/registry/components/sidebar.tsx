'use client'

import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { IconPushLeft16, IconPushRight16 } from '@dhis2/ui-icons'
import * as React from 'react'
import { Button } from './button'
import { cn } from './cn'
import { Input } from './input'
import { Separator } from './separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './sheet'
import { useIsMobile } from './use-mobile'

/*
 * shadcn Sidebar (Base UI) on the DHIS2 theme roles: a light surface with a
 * hairline edge. It fills its SidebarProvider instead of the window, so it
 * sits below the DHIS2 header bar; give the provider a height. `side` follows
 * the text direction: left is where a line starts. The menu parts are in
 * sidebar-menu.
 */

const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

type SidebarContextProps = {
    state: 'expanded' | 'collapsed'
    open: boolean
    setOpen: (open: boolean) => void
    openMobile: boolean
    setOpenMobile: (open: boolean) => void
    isMobile: boolean
    toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
    const context = React.useContext(SidebarContext)
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider.')
    }

    return context
}

function SidebarProvider({
    defaultOpen = true,
    open: openProp,
    onOpenChange,
    className,
    children,
    ...props
}: React.ComponentProps<'div'> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
}) {
    const isMobile = useIsMobile()
    const [openMobile, setOpenMobile] = React.useState(false)
    const [localOpen, setLocalOpen] = React.useState(defaultOpen)
    const open = openProp ?? localOpen
    const setOpen = React.useCallback(
        (nextOpen: boolean) => {
            if (onOpenChange) {
                onOpenChange(nextOpen)
            } else {
                setLocalOpen(nextOpen)
            }
        },
        [onOpenChange]
    )

    const toggleSidebar = React.useCallback(() => {
        if (isMobile) {
            setOpenMobile((current) => !current)
        } else {
            setOpen(!open)
        }
    }, [isMobile, open, setOpen])

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
                (event.metaKey || event.ctrlKey)
            ) {
                event.preventDefault()
                toggleSidebar()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [toggleSidebar])

    // `data-state="expanded" | "collapsed"` lets the parts style themselves.
    const state = open ? 'expanded' : 'collapsed'

    const contextValue = React.useMemo<SidebarContextProps>(
        () => ({
            state,
            open,
            setOpen,
            isMobile,
            openMobile,
            setOpenMobile,
            toggleSidebar,
        }),
        [state, open, setOpen, isMobile, openMobile, toggleSidebar]
    )

    return (
        <SidebarContext.Provider value={contextValue}>
            <div
                data-slot="sidebar-wrapper"
                className={cn(
                    'group/sidebar-wrapper relative flex h-full min-h-0 w-full overflow-x-clip text-dhis2-foreground [--sidebar-width-icon:3rem] [--sidebar-width:16rem] has-data-[variant=inset]:bg-dhis2-background-subtle',
                    className
                )}
                {...props}
            >
                {children}
            </div>
        </SidebarContext.Provider>
    )
}

function Sidebar({
    side = 'left',
    variant = 'sidebar',
    collapsible = 'offcanvas',
    mobileTitle = 'Navigation',
    className,
    children,
    ...props
}: React.ComponentPropsWithoutRef<'div'> & {
    side?: 'left' | 'right'
    variant?: 'sidebar' | 'floating' | 'inset'
    collapsible?: 'offcanvas' | 'icon' | 'none'
    /** Accessible name of the sheet the sidebar becomes on a narrow window. */
    mobileTitle?: string
}) {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

    if (collapsible === 'none') {
        return (
            <div
                data-slot="sidebar"
                className={cn(
                    'flex h-full w-(--sidebar-width) flex-col bg-dhis2-background-subtle text-dhis2-foreground',
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }

    if (isMobile) {
        return (
            <Sheet open={openMobile} onOpenChange={setOpenMobile}>
                <SheetContent
                    {...props}
                    data-sidebar="sidebar"
                    data-slot="sidebar"
                    data-mobile="true"
                    className="w-(--sidebar-width) gap-0 bg-dhis2-background-subtle p-0 text-dhis2-foreground [--sidebar-width:18rem]"
                    side={side}
                    showCloseButton={false}
                >
                    <SheetHeader className="sr-only">
                        <SheetTitle>{mobileTitle}</SheetTitle>
                    </SheetHeader>
                    <div className="flex size-full flex-col">{children}</div>
                </SheetContent>
            </Sheet>
        )
    }

    return (
        <div
            className="group peer hidden text-dhis2-foreground md:block"
            data-state={state}
            data-collapsible={state === 'collapsed' ? collapsible : ''}
            data-variant={variant}
            data-side={side}
            data-slot="sidebar"
        >
            {/* Holds the sidebar's width in the layout. */}
            <div
                data-slot="sidebar-gap"
                className={cn(
                    'relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear motion-reduce:transition-none',
                    'group-data-[collapsible=offcanvas]:w-0',
                    'group-data-[side=right]:rotate-180',
                    variant === 'floating' || variant === 'inset'
                        ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
                        : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)'
                )}
            />
            <div
                data-slot="sidebar-container"
                data-side={side}
                className={cn(
                    'absolute inset-y-0 z-10 hidden h-full w-(--sidebar-width) border-0 border-solid border-dhis2-border transition-[inset-inline-start,inset-inline-end,width] duration-200 ease-linear motion-reduce:transition-none data-[side=left]:start-0 data-[side=left]:group-data-[collapsible=offcanvas]:start-[calc(var(--sidebar-width)*-1)] data-[side=right]:end-0 data-[side=right]:group-data-[collapsible=offcanvas]:end-[calc(var(--sidebar-width)*-1)] md:flex',
                    variant === 'floating' || variant === 'inset'
                        ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
                        : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-e group-data-[side=right]:border-s',
                    className
                )}
                {...props}
            >
                <div
                    data-sidebar="sidebar"
                    data-slot="sidebar-inner"
                    className="flex size-full flex-col bg-dhis2-background-subtle group-data-[variant=floating]:rounded-dhis2-lg group-data-[variant=floating]:shadow-dhis2-card"
                >
                    {children}
                </div>
            </div>
        </div>
    )
}

function SidebarTrigger({
    className,
    onClick,
    label = 'Toggle sidebar',
    ...props
}: React.ComponentPropsWithoutRef<typeof Button> & {
    /** Accessible name of the button. */
    label?: string
}) {
    const { toggleSidebar, isMobile, open, openMobile } = useSidebar()
    const expanded = isMobile ? openMobile : open

    return (
        <Button
            data-sidebar="trigger"
            data-slot="sidebar-trigger"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-expanded={expanded}
            className={cn('rtl:-scale-x-100', className)}
            onClick={(event) => {
                onClick?.(event)
                toggleSidebar()
            }}
            {...props}
        >
            {expanded ? <IconPushLeft16 /> : <IconPushRight16 />}
        </Button>
    )
}

function SidebarRail({
    className,
    label = 'Toggle sidebar',
    ...props
}: React.ComponentProps<'button'> & {
    /** Accessible name and tooltip of the rail. */
    label?: string
}) {
    const { toggleSidebar } = useSidebar()

    return (
        <button
            type="button"
            data-sidebar="rail"
            data-slot="sidebar-rail"
            aria-label={label}
            tabIndex={-1}
            onClick={toggleSidebar}
            title={label}
            className={cn(
                'absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 border-0 bg-transparent p-0 transition-all ease-linear group-data-[side=left]:-end-4 group-data-[side=right]:start-0 rtl:translate-x-1/2 after:absolute after:inset-y-0 after:start-1/2 after:w-[2px] hover:after:bg-dhis2-border-strong motion-reduce:transition-none sm:flex',
                // The cursor points the way the sidebar will move: in when open, out when folded.
                'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize rtl:in-data-[side=left]:cursor-e-resize rtl:in-data-[side=right]:cursor-w-resize',
                '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize rtl:[[data-side=left][data-state=collapsed]_&]:cursor-w-resize rtl:[[data-side=right][data-state=collapsed]_&]:cursor-e-resize',
                'group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:start-full hover:group-data-[collapsible=offcanvas]:bg-dhis2-background-subtle',
                '[[data-side=left][data-collapsible=offcanvas]_&]:-end-2',
                '[[data-side=right][data-collapsible=offcanvas]_&]:-start-2',
                className
            )}
            {...props}
        />
    )
}

function SidebarInset({ className, ...props }: React.ComponentProps<'main'>) {
    return (
        <main
            data-slot="sidebar-inset"
            className={cn(
                'relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-auto bg-dhis2-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ms-0 md:peer-data-[variant=inset]:rounded-dhis2-lg md:peer-data-[variant=inset]:shadow-dhis2-card md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ms-2',
                className
            )}
            {...props}
        />
    )
}

function SidebarInput({
    className,
    ...props
}: React.ComponentPropsWithoutRef<typeof Input>) {
    return (
        <Input
            data-slot="sidebar-input"
            data-sidebar="input"
            className={cn('h-8 w-full py-0', className)}
            {...props}
        />
    )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="sidebar-header"
            data-sidebar="header"
            className={cn('flex flex-col gap-2 p-2', className)}
            {...props}
        />
    )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="sidebar-footer"
            data-sidebar="footer"
            className={cn('flex flex-col gap-2 p-2', className)}
            {...props}
        />
    )
}

function SidebarSeparator({
    className,
    ...props
}: React.ComponentProps<typeof Separator>) {
    return (
        <Separator
            data-slot="sidebar-separator"
            data-sidebar="separator"
            className={cn('mx-2 w-auto', className)}
            {...props}
        />
    )
}

function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="sidebar-content"
            data-sidebar="content"
            className={cn(
                'flex min-h-0 flex-1 flex-col gap-0 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
                className
            )}
            {...props}
        />
    )
}

// A Collapsible renders as a group, and passes it a ref.
const SidebarGroup = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        data-slot="sidebar-group"
        data-sidebar="group"
        className={cn('relative flex w-full min-w-0 flex-col p-2', className)}
        {...props}
    />
))
SidebarGroup.displayName = 'SidebarGroup'

function SidebarGroupLabel({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>) {
    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(
            {
                className: cn(
                    'flex h-8 shrink-0 items-center rounded-dhis2-md px-2 text-xs font-medium border-0 bg-transparent text-start text-dhis2-muted-foreground outline-none transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dhis2-ring focus-visible:outline-solid motion-reduce:transition-none [&>svg]:size-4 [&>svg]:shrink-0',
                    className
                ),
            },
            props
        ),
        render,
        state: {
            slot: 'sidebar-group-label',
            sidebar: 'group-label',
        },
    })
}

function SidebarGroupAction({
    className,
    render,
    ...props
}: useRender.ComponentProps<'button'>) {
    return useRender({
        defaultTagName: 'button',
        props: mergeProps<'button'>(
            {
                className: cn(
                    'absolute end-3 top-3.5 flex aspect-square w-5 cursor-pointer items-center justify-center rounded-dhis2-md border-0 bg-transparent p-0 text-dhis2-foreground outline-none transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 hover:bg-dhis2-accent hover:text-dhis2-accent-foreground focus-visible:outline-2 focus-visible:outline-dhis2-ring focus-visible:outline-solid motion-reduce:transition-none md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0',
                    className
                ),
            },
            props
        ),
        render,
        state: {
            slot: 'sidebar-group-action',
            sidebar: 'group-action',
        },
    })
}

function SidebarGroupContent({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="sidebar-group-content"
            data-sidebar="group-content"
            className={cn('w-full text-sm', className)}
            {...props}
        />
    )
}

export {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInput,
    SidebarInset,
    SidebarProvider,
    SidebarRail,
    SidebarSeparator,
    SidebarTrigger,
    useSidebar,
}
