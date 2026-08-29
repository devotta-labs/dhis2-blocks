import type { SelectorBarItemProps } from '@dhis2/ui'
import type { FC } from 'react'

declare module '@dhis2/ui' {
    // @dhis2/ui exports this at runtime, but its selector-bar declaration omits it.
    export const SelectorBarItem: FC<SelectorBarItemProps>

    // The runtime supports this accessible toolbar label.
    interface SelectorBarProps {
        ariaLabel?: string
    }
}
