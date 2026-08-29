import type { ReactNode } from 'react'
import React from 'react'
import { SelectorBarItem } from '@dhis2/ui'

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

// SAFETY: The local augmentation exposes the verified runtime export; this widens stale optional/value props.
const CaptureSelectorBarItem =
    SelectorBarItem as React.ComponentType<SelectorBarItemRuntimeProps>

export { CaptureSelectorBarItem }

export const capitalizeFirst = (value: string) =>
    value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value

export const lowerCaseFirst = (value: string) =>
    value.length > 0 ? `${value[0].toLowerCase()}${value.slice(1)}` : value
