import i18n from '@dhis2/d2-i18n'
import { IconChevronLeft24 } from '@dhis2/ui-icons'
import React, {
    useId,
    useState,
    type ComponentPropsWithoutRef,
    type ReactNode,
} from 'react'
import { cn } from '@/registry/dhis2/ui/cn'
import { SidebarContext, useSidebar } from './context'

type CollapseState =
    | {
          collapsed: boolean
          onCollapsedChange: (collapsed: boolean) => void
          defaultCollapsed?: never
      }
    | {
          collapsed?: never
          defaultCollapsed?: boolean
          onCollapsedChange?: (collapsed: boolean) => void
      }

export type SidebarProviderProps = { children?: ReactNode } & CollapseState
export type SidebarProps = ComponentPropsWithoutRef<'aside'>

export function SidebarProvider({
    collapsed: controlledCollapsed,
    defaultCollapsed = false,
    onCollapsedChange,
    children,
}: SidebarProviderProps) {
    const [localCollapsed, setLocalCollapsed] = useState(defaultCollapsed)
    const collapsed = controlledCollapsed ?? localCollapsed
    const navigationId = useId()
    const setCollapsed = (nextCollapsed: boolean) => {
        if (controlledCollapsed === undefined) {
            setLocalCollapsed(nextCollapsed)
        }

        onCollapsedChange?.(nextCollapsed)
    }

    return (
        <SidebarContext.Provider
            value={{
                state: { collapsed },
                actions: { setCollapsed },
                meta: { navigationId },
            }}
        >
            {children}
        </SidebarContext.Provider>
    )
}

export function Sidebar({ className, ...props }: SidebarProps) {
    const { state } = useSidebar()

    return (
        <aside
            {...props}
            data-slot="sidebar"
            data-state={state.collapsed ? 'collapsed' : 'expanded'}
            className={cn(
                'relative flex min-h-13 w-full shrink-0 flex-col overflow-hidden bg-dhis2-grey-900 font-dhis2 text-dhis2-grey-300 transition-[width] duration-300 motion-reduce:transition-none md:w-60 md:data-[state=collapsed]:w-13',
                className
            )}
        />
    )
}

export function SidebarNavigation({
    className,
    ...props
}: Omit<ComponentPropsWithoutRef<'nav'>, 'id' | 'hidden'>) {
    const { state, meta } = useSidebar()

    return (
        <nav
            aria-label={i18n.t('Main navigation')}
            {...props}
            id={meta.navigationId}
            hidden={state.collapsed}
            data-slot="sidebar-navigation"
            className={cn(
                'min-h-0 flex-1 flex-col pb-13 md:w-60',
                state.collapsed ? 'hidden' : 'flex',
                className
            )}
        />
    )
}

export function SidebarHeader({
    className,
    ...props
}: ComponentPropsWithoutRef<'div'>) {
    return (
        <div
            {...props}
            data-slot="sidebar-header"
            className={cn('shrink-0 px-3 py-4', className)}
        />
    )
}

export function SidebarContent({
    className,
    ...props
}: ComponentPropsWithoutRef<'div'>) {
    return (
        <div
            {...props}
            data-slot="sidebar-content"
            className={cn('min-h-0 flex-1 overflow-y-auto', className)}
        />
    )
}

export function SidebarFooter({
    className,
    ...props
}: ComponentPropsWithoutRef<'div'>) {
    return (
        <div
            {...props}
            data-slot="sidebar-footer"
            className={cn(
                'mt-auto shrink-0 border-t border-dhis2-grey-700',
                className
            )}
        />
    )
}

export function SidebarToggle({
    className,
    onClick,
    collapseLabel = i18n.t('Collapse sidebar'),
    expandLabel = i18n.t('Expand sidebar'),
    ...props
}: Omit<ComponentPropsWithoutRef<'button'>, 'children'> & {
    collapseLabel?: string
    expandLabel?: string
}) {
    const { state, actions, meta } = useSidebar()
    const label = state.collapsed ? expandLabel : collapseLabel

    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            {...props}
            aria-controls={meta.navigationId}
            aria-expanded={!state.collapsed}
            data-slot="sidebar-toggle"
            className={cn(
                'absolute start-2 bottom-2 flex size-9 cursor-pointer items-center justify-center rounded-dhis2-md border-0 bg-dhis2-grey-800 text-dhis2-grey-050 hover:bg-dhis2-grey-700 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dhis2-grey-050 disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            onClick={(event) => {
                onClick?.(event)

                if (!event.defaultPrevented) {
                    actions.setCollapsed(!state.collapsed)
                }
            }}
        >
            <span
                aria-hidden="true"
                className={cn(
                    'flex transition-transform duration-300 motion-reduce:transition-none',
                    state.collapsed
                        ? '-rotate-90 md:rotate-180 rtl:md:rotate-0'
                        : 'rotate-90 md:rotate-0 rtl:md:rotate-180'
                )}
            >
                <IconChevronLeft24 />
            </span>
        </button>
    )
}
