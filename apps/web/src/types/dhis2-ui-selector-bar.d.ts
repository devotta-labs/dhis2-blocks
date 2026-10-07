import type { SelectorBarItemProps } from '@dhis2/ui'
import type { FC } from 'react'

declare module '@dhis2/ui' {
    export const SelectorBarItem: FC<SelectorBarItemProps>

    interface MenuItemProps {
        ariaLabel?: string
    }

    interface SelectorBarProps {
        ariaLabel?: string
    }
}
