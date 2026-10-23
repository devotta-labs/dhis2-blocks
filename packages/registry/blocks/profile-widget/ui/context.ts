import { createContext, useContext } from 'react'

interface ProfileWidgetContextValue {
    state: { open: boolean }
    meta: {
        /** Generated id a `ProfileWidgetTitle` uses unless it is given its own */
        titleId: string
        /** Id of the mounted title (its own `id` or `titleId`), null without one */
        labelledBy: string | null
    }
    actions: {
        /** Called by the mounted title so the frame can point `aria-labelledby` at it */
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
