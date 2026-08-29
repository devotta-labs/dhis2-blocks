import type { ReactNode } from 'react'
import React from 'react'
import { SelectorBarItem as Dhis2SelectorBarItem } from '@dhis2/ui'

interface SelectorBarItemRuntimeProps {
    children?: ReactNode
    className?: string
    dataTest?: string
    disabled?: boolean
    displayOnly?: boolean
    label: string
    noValueMessage?: string
    open?: boolean
    setOpen?: (open: boolean) => void
    value?: ReactNode
    onClearSelectionClick?: () => void
}

// SAFETY: The runtime accepts the ReactNode value used by Capture, while the published type only accepts string.
const SelectorBarItem = Dhis2SelectorBarItem.bind(
    null
) as React.ComponentType<SelectorBarItemRuntimeProps>

export { SelectorBarItem }

export const capitalizeFirst = (value: string) =>
    value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value

export const lowerCaseFirst = (value: string) =>
    value.length > 0 ? `${value[0].toLowerCase()}${value.slice(1)}` : value
