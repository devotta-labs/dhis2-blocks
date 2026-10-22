import type { SidebarProviderProps } from '../src'

export const uncontrolled: SidebarProviderProps = { defaultCollapsed: true }

export const controlled: SidebarProviderProps = {
    collapsed: true,
    onCollapsedChange: (_collapsed: boolean) => undefined,
}

// @ts-expect-error Controlled collapse requires a change handler.
export const missingHandler: SidebarProviderProps = { collapsed: false }

// @ts-expect-error Controlled and uncontrolled collapse cannot be combined.
export const mixedControl: SidebarProviderProps = {
    collapsed: true,
    defaultCollapsed: false,
    onCollapsedChange: () => undefined,
}
