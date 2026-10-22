import type { SidebarProps } from '../src'

export const uncontrolled: SidebarProps = { defaultCollapsed: true }

export const controlled: SidebarProps = {
    collapsed: true,
    onCollapsedChange: (_collapsed: boolean) => undefined,
}

// @ts-expect-error Controlled collapse requires a change handler.
export const missingHandler: SidebarProps = { collapsed: false }

// @ts-expect-error Controlled and uncontrolled collapse cannot be combined.
export const mixedControl: SidebarProps = {
    collapsed: true,
    defaultCollapsed: false,
    onCollapsedChange: () => undefined,
}
