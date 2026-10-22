import { createContext, useContext } from 'react'

interface SidebarContextValue {
    state: { collapsed: boolean }
    actions: { setCollapsed: (collapsed: boolean) => void }
    meta: { navigationId: string }
}

export const SidebarContext = createContext<SidebarContextValue | null>(null)

export const useSidebar = () => {
    const context = useContext(SidebarContext)

    if (!context) {
        throw new Error(
            'Sidebar components must be rendered inside SidebarProvider'
        )
    }

    return context
}
