import { createContext, useContext } from 'react'

interface ProfileWidgetContextValue {
    state: { open: boolean }
    meta: {
        titleId: string
        labelledBy: string | null
    }
    actions: {
        setLabelledBy: (id: string | null) => void
    }
}

export const ProfileWidgetContext =
    createContext<ProfileWidgetContextValue | null>(null)

export const useProfileWidget = () => {
    const context = useContext(ProfileWidgetContext)

    if (!context) {
        throw new Error(
            'ProfileWidget parts must be rendered inside ProfileWidget'
        )
    }

    return context
}
