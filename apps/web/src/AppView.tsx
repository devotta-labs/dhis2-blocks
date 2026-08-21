import React from 'react'

interface AppViewProps {
    AppShellComponent: React.ComponentType
}

export const AppView = ({ AppShellComponent }: AppViewProps) => (
    <AppShellComponent />
)
