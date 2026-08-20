import type { SelectorBarItemProps } from '@dhis2/ui'
import type { FC } from 'react'

declare module '@dhis2/ui' {
    // @dhis2/ui 10.11 exports this component at runtime, but its upstream
    // selector-bar declaration currently exposes only SelectorBarItemProps.
    export const SelectorBarItem: FC<SelectorBarItemProps>

    // The runtime supports an accessible toolbar label, which is also absent
    // from the installed SelectorBarProps declaration.
    interface SelectorBarProps {
        ariaLabel?: string
    }
}
