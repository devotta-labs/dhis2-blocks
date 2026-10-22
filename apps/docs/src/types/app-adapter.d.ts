declare module '@dhis2/app-adapter' {
    import type { ComponentType, ReactNode } from 'react'

    interface AppAdapterProps {
        appName: string
        appVersion: string
        url?: string
        apiVersion?: number
        direction?: 'ltr' | 'rtl' | 'auto'
        pwaEnabled?: boolean
        plugin?: boolean
        connectionErrorFallback?: ReactNode
        loginApp?: boolean
        children?: ReactNode
    }

    const AppAdapter: ComponentType<AppAdapterProps>
    export default AppAdapter
    export type { AppAdapterProps }
}
